/**
 * Enrollment.
 *
 * One enrollment per student per term, enforced here rather than merely
 * discouraged in the UI. Everything is validated before anything is written,
 * so an enrollment either lands whole or not at all.
 */

import type { Enrollment, EnrollmentSubject } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type {
  EnrollableSubject,
  EnrollmentOptions,
  EnrollmentView,
} from '@/types/views';
import { badRequest, duplicate, validationFailed } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import {
  allGradedRowsFor,
  findEnrollment,
  getSemester,
  getStudent,
  scheduleLabelFor,
  toSemesterView,
  toStudentView,
} from '../repositories/lookups';
import { requireRole } from '../auth';
import { isPassing } from './grade-rules';
import { recordAudit } from './audit';

/**
 * What the student may take this term: their curriculum's subjects for the
 * matching year level and term, annotated with anything already passed.
 */
export function getEnrollmentOptions(
  studentId: string,
  semesterId: string,
): EnrollmentOptions {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const semester = getSemester(semesterId);
  const studentView = toStudentView(student);
  const semesterView = toSemesterView(semester);

  let blockedReason: string | null = null;
  if (!student.curriculumId) {
    blockedReason =
      'This student has no curriculum assigned. Approve the application (which assigns one) before enrolling them.';
  } else if (student.status === 'PENDING' || student.status === 'REJECTED') {
    blockedReason = 'Only approved students can be enrolled.';
  } else if (student.status === 'GRADUATED') {
    blockedReason = 'This student has already graduated.';
  } else if (student.status === 'DROPPED') {
    blockedReason = 'This student is marked as dropped. Reinstate them before enrolling.';
  }

  const existing = findEnrollment(studentId, semesterId);
  if (existing && !blockedReason) {
    blockedReason = `${studentView.fullName} is already enrolled for ${semesterView.label}. A student may only hold one enrollment per term.`;
  }

  const gradedRows = allGradedRowsFor(studentId);
  const passedSubjectIds = new Map<string, string>();
  for (const row of gradedRows) {
    const effective = row.finalGrade === 'INC' ? row.completionGrade : row.finalGrade;
    if (isPassing(effective)) passedSubjectIds.set(row.subjectId, effective ?? '');
  }

  const mappings = student.curriculumId
    ? db.programSubjects.filter(
        (ps) =>
          ps.curriculumId === student.curriculumId &&
          ps.semesterPeriod === semester.semesterPeriod &&
          ps.yearLevel === semester.yearLevel,
      )
    : [];

  const subjects: EnrollableSubject[] = mappings.map((mapping) => {
    const subject = db.subjects.find((s) => s.id === mapping.subjectId);
    const schedule = db.classSchedules.find(
      (s) =>
        s.semesterId === semesterId &&
        s.subjectId === mapping.subjectId &&
        s.sectionId === student.sectionId &&
        s.status === 'PUBLISHED',
    );
    const passedWith = passedSubjectIds.get(mapping.subjectId) ?? null;

    let disabledReason: string | null = null;
    if (passedWith) disabledReason = `Already passed with ${passedWith}.`;
    else if (subject && !subject.isActive) disabledReason = 'This subject is deactivated.';

    return {
      subjectId: mapping.subjectId,
      code: subject?.code ?? '—',
      title: subject?.title ?? 'Unknown subject',
      units: subject?.units ?? 0,
      yearLevel: mapping.yearLevel,
      semesterPeriod: mapping.semesterPeriod,
      classScheduleId: schedule?.id ?? null,
      scheduleLabel: schedule ? scheduleLabelFor(schedule.id) : null,
      alreadyPassed: Boolean(passedWith),
      previousGrade: passedWith,
      disabledReason,
    };
  });

  subjects.sort((a, b) => a.code.localeCompare(b.code));

  return {
    student: studentView,
    semester: semesterView,
    subjects,
    existingEnrollmentId: existing?.id ?? null,
    blockedReason,
  };
}

export interface GateCheck {
  cleared: boolean;
  message: string;
  /** Subjects still without an approved grade. Empty when cleared. */
  outstanding: string[];
}

/**
 * The V8 gate: a 3-Year Diploma trainee moving into Year 2 or Year 3 needs
 * last year's grades approved first.
 *
 * Checked PER TRAINEE rather than per grading sheet. A sheet covers a whole
 * section, so gating on the sheet would let one slow trainer freeze an entire
 * cohort's enrollment — this asks only whether *this* trainee's own rows came
 * back approved.
 *
 * Free Training and Short Term courses are exempt: they are single-semester
 * competency courses with no year to progress from.
 */
export function checkPreviousYearGrades(studentId: string, targetYearLevel: number): GateCheck {
  const student = getStudent(studentId);
  const program = db.programs.find((p) => p.id === student.programId);

  if (!program || program.programType !== 'DIPLOMA' || targetYearLevel < 2) {
    return { cleared: true, message: '', outstanding: [] };
  }

  const previousYear = targetYearLevel - 1;
  const previousSemesterIds = new Set(
    db.semesters
      .filter((s) => s.programId === student.programId && s.yearLevel === previousYear)
      .map((s) => s.id),
  );
  const previousEnrollments = db.enrollments.filter(
    (e) => e.studentId === studentId && previousSemesterIds.has(e.semesterId),
  );

  // Nothing on file for last year at all — a transferee, or a record encoded
  // mid-programme. Not this gate's business to refuse.
  if (previousEnrollments.length === 0) {
    return { cleared: true, message: '', outstanding: [] };
  }

  const enrollmentIds = new Set(previousEnrollments.map((e) => e.id));
  const outstanding: string[] = [];
  for (const row of db.enrollmentSubjects) {
    if (!enrollmentIds.has(row.enrollmentId)) continue;
    const effective = row.finalGrade === 'INC' ? row.completionGrade : row.finalGrade;
    if (effective) continue;
    const subject = db.subjects.find((s) => s.id === row.subjectId);
    outstanding.push(subject?.code ?? row.subjectId);
  }

  if (outstanding.length === 0) {
    return { cleared: true, message: '', outstanding: [] };
  }
  return {
    cleared: false,
    outstanding,
    message:
      `${student.firstName} ${student.lastName} cannot enrol into Year ${targetYearLevel} yet — ` +
      `their Year ${previousYear} grades are not all in. Still outstanding: ${outstanding.join(', ')}. ` +
      `The trainer must submit the grading sheet, and the registrar approve it, before this enrollment ` +
      `proceeds without an override.`,
  };
}

export function createEnrollment(
  studentId: string,
  semesterId: string,
  subjectIds: string[],
  /**
   * Set to bypass the previous-year grade gate. The reason is required and
   * goes to the audit trail — the exception exists, but never silently.
   */
  gateOverrideReason?: string,
): EnrollmentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const semester = getSemester(semesterId);
  const semesterView = toSemesterView(semester);

  /* --- Validate everything up front. Nothing is written until it all passes. --- */

  if (!student.curriculumId) {
    throw badRequest(
      'This student has no curriculum assigned. Approve the application first — approval is what assigns the curriculum.',
    );
  }
  if (student.status === 'PENDING' || student.status === 'REJECTED') {
    throw badRequest('Only approved students can be enrolled.');
  }
  if (findEnrollment(studentId, semesterId)) {
    throw duplicate(
      `${student.firstName} ${student.lastName} already has an enrollment for ${semesterView.label}. One enrollment per student per semester.`,
    );
  }

  const gate = checkPreviousYearGrades(studentId, semester.yearLevel);
  if (!gate.cleared) {
    const reason = gateOverrideReason?.trim() ?? '';
    if (!reason) throw badRequest(gate.message);
    recordAudit({
      action: 'ENROLLMENT_GATE_OVERRIDDEN',
      recordType: 'Student',
      recordId: student.id,
      actor,
      detail: `Previous-year grade gate overridden for ${student.firstName} ${student.lastName} into ${semesterView.label}. Reason: ${reason}`,
      before: { blockedBy: gate.message },
    });
  }
  if (subjectIds.length === 0) {
    throw badRequest('Select at least one subject.');
  }

  const uniqueIds = [...new Set(subjectIds)];
  if (uniqueIds.length !== subjectIds.length) {
    throw badRequest('The same subject was selected more than once.');
  }

  const options = getEnrollmentOptions(studentId, semesterId);
  const allowed = new Map(options.subjects.map((s) => [s.subjectId, s]));
  const problems: string[] = [];

  for (const subjectId of uniqueIds) {
    const candidate = allowed.get(subjectId);
    if (!candidate) {
      const subject = db.subjects.find((s) => s.id === subjectId);
      problems.push(
        `${subject?.code ?? subjectId} is not part of this student’s curriculum for ${semesterView.label}, Year ${student.yearLevel}.`,
      );
      continue;
    }
    if (candidate.alreadyPassed) {
      problems.push(`${candidate.code} was already passed with ${candidate.previousGrade}.`);
    }
  }

  if (problems.length > 0) {
    throw validationFailed(
      'This enrollment was not saved — nothing was committed.',
      { details: problems },
    );
  }

  /* --- Commit. --- */

  const enrollmentId = nextId('enr');
  const rows: EnrollmentSubject[] = uniqueIds.map((subjectId) => {
    const candidate = allowed.get(subjectId);
    const subject = db.subjects.find((s) => s.id === subjectId);
    return {
      id: nextId('es'),
      enrollmentId,
      subjectId,
      classScheduleId: candidate?.classScheduleId ?? null,
      // Units are snapshotted here. If the catalog later re-values the subject,
      // this enrollment keeps the units it was made with.
      units: subject?.units ?? 0,
      finalGrade: null,
      completionGrade: null,
      gradeStatus: 'ENROLLED_NOT_GRADED',
      gradedAt: null,
      gradedByUserId: null,
    };
  });

  const enrollment: Enrollment = {
    id: enrollmentId,
    studentId,
    semesterId,
    enrolledAt: nowIso(),
    status: 'ENROLLED',
    totalUnits: rows.reduce((sum, r) => sum + r.units, 0),
  };

  db.enrollments.push(enrollment);
  db.enrollmentSubjects.push(...rows);

  if (student.status === 'APPROVED') {
    student.status = 'ACTIVE';
    student.updatedAt = nowIso();
  }

  recordAudit({
    action: 'ENROLLMENT_CREATED',
    recordType: 'Enrollment',
    recordId: enrollment.id,
    actor,
    detail: `${student.firstName} ${student.lastName} enrolled in ${rows.length} subject${
      rows.length === 1 ? '' : 's'
    } (${enrollment.totalUnits} units) for ${semesterView.label}.`,
    after: { ...enrollment, subjectIds: uniqueIds },
  });

  return toEnrollmentView(enrollment);
}

export function toEnrollmentView(enrollment: Enrollment): EnrollmentView {
  const student = db.students.find((s) => s.id === enrollment.studentId);
  const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
  const year = semester
    ? db.academicYears.find((y) => y.id === semester.academicYearId)
    : undefined;
  return {
    ...enrollment,
    studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown student',
    studentNumber: student?.studentNumber ?? '—',
    academicYearLabel: year?.label ?? '—',
    semesterPeriod: semester?.semesterPeriod ?? 'FIRST',
    yearLevel: semester?.yearLevel ?? 1,
    termLabel: semester
      ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod)
      : '—',
    subjectCount: db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollment.id)
      .length,
  };
}

export interface EnrollmentFilters {
  semesterId?: string;
  studentId?: string;
  query?: string;
}

export function listEnrollments(filters: EnrollmentFilters = {}): EnrollmentView[] {
  requireRole('REGISTRAR');
  let rows = [...db.enrollments];
  if (filters.semesterId) rows = rows.filter((e) => e.semesterId === filters.semesterId);
  if (filters.studentId) rows = rows.filter((e) => e.studentId === filters.studentId);

  let views = rows.map(toEnrollmentView);
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    views = views.filter((v) =>
      `${v.studentName} ${v.studentNumber}`.toLowerCase().includes(needle),
    );
  }
  return views.sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
}

export function dropEnrollment(enrollmentId: string, reason: string): EnrollmentView {
  const actor = requireRole('REGISTRAR');
  const enrollment = db.enrollments.find((e) => e.id === enrollmentId);
  if (!enrollment) throw badRequest('That enrollment could not be found.');
  if (enrollment.status === 'DROPPED') {
    throw badRequest('This enrollment has already been dropped.');
  }

  const before = { ...enrollment };
  enrollment.status = 'DROPPED';

  recordAudit({
    action: 'ENROLLMENT_DROPPED',
    recordType: 'Enrollment',
    recordId: enrollment.id,
    actor,
    detail: reason.trim() || 'Enrollment dropped.',
    before,
    after: { ...enrollment },
  });
  return toEnrollmentView(enrollment);
}
