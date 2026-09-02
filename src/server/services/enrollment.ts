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
  enrollmentSubjectsFor,
  findEnrollment,
  getSemester,
  getStudent,
  scheduleLabelFor,
  toEnrollmentSubjectView,
  toSemesterView,
  toStudentView,
} from '../repositories/lookups';
import { requireRole } from '../auth';
import { effectiveGrade, isPassing } from './grade-rules';
import { recordAudit } from './audit';
import { reconcileGradingSheetRoster } from './grading-sheets';

/**
 * What the student may take this term: their curriculum's subjects for the
 * matching year level and term, annotated with anything already passed.
 */
/**
 * Whether one prerequisite subject has been satisfied, and if not, why.
 *
 * The distinction that matters is between a grade that exists and a grade
 * that counts. An INC is a real, recorded grade — it is simply not a pass,
 * and until it is resolved it says the work was never finished. Treating it
 * as "has a grade, therefore done" is exactly how a trainee ends up in the
 * second half of a chain having never completed the first.
 *
 * A resolved INC is judged on its completion grade, which is the whole point
 * of resolving one: it is the grade that says what they eventually achieved.
 *
 * Reuses `isPassing` and `effectiveGrade` from grade-rules rather than
 * restating the cutoff, so this cannot drift from what the transcript,
 * the GWA and the Grade Evaluation Form all consider a pass.
 */
type PrerequisiteOutcome =
  | { satisfied: true }
  | { satisfied: false; reason: string };

function checkPrerequisite(
  gradedRows: EnrollmentSubject[],
  enrolledSubjectIds: Set<string>,
  prerequisiteSubjectId: string,
): PrerequisiteOutcome {
  const subject = db.subjects.find((s) => s.id === prerequisiteSubjectId);
  const code = subject?.code ?? 'a required subject';

  // The most recent attempt is the one that counts — a retake supersedes the
  // failure that made it necessary.
  const attempts = gradedRows.filter((row) => row.subjectId === prerequisiteSubjectId);
  const latest = attempts[attempts.length - 1];

  if (!latest) {
    if (enrolledSubjectIds.has(prerequisiteSubjectId)) {
      return {
        satisfied: false,
        reason: `${code} is still being taken and has no grade yet`,
      };
    }
    return { satisfied: false, reason: `${code} has not been taken` };
  }

  if (latest.finalGrade === null) {
    return { satisfied: false, reason: `${code} has no grade yet` };
  }

  if (latest.finalGrade === 'INC' && !latest.completionGrade) {
    return { satisfied: false, reason: `${code} is INC and has not been resolved` };
  }

  const effective = effectiveGrade(latest.finalGrade, latest.completionGrade);
  if (isPassing(effective)) return { satisfied: true };

  return { satisfied: false, reason: `${code} was not passed (${effective ?? latest.finalGrade})` };
}

export function getEnrollmentOptions(
  studentId: string,
  semesterId: string,
): EnrollmentOptions {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const semester = getSemester(semesterId);
  const studentView = toStudentView(student);
  const semesterView = toSemesterView(semester);

  // A semester belongs to exactly one Diploma. Enrolling into one that is
  // not the student's own would attach their record to a curriculum,
  // section and set of published classes that were never theirs — the UI
  // now locks the Diploma the moment a student is chosen, so this is a
  // defence against a mismatched semesterId reaching here at all, not a
  // business rule a registrar is meant to see and work around.
  if (semester.programId !== student.programId) {
    throw badRequest(
      `${studentView.fullName} is enrolled under ${studentView.programCode}. Choose a semester belonging to that Diploma, not ${semesterView.programCode}.`,
    );
  }

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
  // Subjects they are taking at this moment: a prerequisite still in progress
  // reads differently from one never attempted, and both block.
  const currentlyEnrolledSubjectIds = new Set(
    db.enrollments
      .filter((e) => e.studentId === studentId)
      .flatMap((e) => db.enrollmentSubjects.filter((es) => es.enrollmentId === e.id))
      .map((es) => es.subjectId),
  );
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

    // Every prerequisite is reported, not just the first one to fail, so the
    // registrar sees the whole of what is outstanding instead of clearing one
    // and discovering another.
    const unmet = mapping.prerequisiteSubjectIds
      .map((id) => checkPrerequisite(gradedRows, currentlyEnrolledSubjectIds, id))
      .filter((outcome): outcome is { satisfied: false; reason: string } => !outcome.satisfied)
      .map((outcome) => outcome.reason);

    const standingShort =
      mapping.prerequisiteStanding !== null && student.yearLevel < mapping.prerequisiteStanding
        ? `${mapping.prerequisiteStanding}${mapping.prerequisiteStanding === 2 ? 'nd' : mapping.prerequisiteStanding === 3 ? 'rd' : 'th'} year standing is required (currently Year ${student.yearLevel})`
        : null;

    const blockers = [...unmet, ...(standingShort ? [standingShort] : [])];

    let disabledReason: string | null = null;
    if (passedWith) disabledReason = `Already passed with ${passedWith}.`;
    else if (subject && !subject.isActive) disabledReason = 'This subject is deactivated.';
    else if (blockers.length > 0) {
      disabledReason =
        blockers.length === 1
          ? `Cannot enroll: ${blockers[0]}.`
          : `Cannot enroll: ${blockers.join('; ')}.`;
    }

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

  // What they are already taking this semester. The registrar needs to see
  // the current state before changing it — "already enrolled" on its own does
  // not say in what.
  const currentSubjects = existing
    ? enrollmentSubjectsFor(existing.id).map(toEnrollmentSubjectView)
    : [];
  const currentUnits = currentSubjects.reduce((total, row) => total + row.units, 0);

  // Surfaced separately from blockedReason so the page can offer an override,
  // which a hard block does not allow.
  const gate = checkPrecedingSemester(studentId, semesterId);

  return {
    student: studentView,
    semester: semesterView,
    subjects,
    existingEnrollmentId: existing?.id ?? null,
    currentSubjects,
    currentUnits,
    gateCleared: gate.cleared,
    gateMessage: gate.message,
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
 * The enrolment gate: a trainee's IMMEDIATELY PRECEDING semester must be
 * fully graded before they enrol into the next one.
 *
 * V9 changed this from a year-to-year rule. Two reasons. It covers the year
 * boundary anyway — Year 2 First Semester's predecessor is Year 1 Second —
 * while also catching the far commoner case of moving between the two
 * semesters of one year. And a year-to-year rule cannot be exercised at all
 * with a single school year on file, which is what the centre now runs.
 *
 * Checked PER TRAINEE, not per grading sheet. A sheet covers a whole section,
 * so gating on the sheet would let one slow trainer freeze an entire cohort —
 * this asks only whether *this* trainee's own rows came back graded.
 */
export function checkPrecedingSemester(studentId: string, targetSemesterId: string): GateCheck {
  const student = getStudent(studentId);
  const program = db.programs.find((p) => p.id === student.programId);
  const target = db.semesters.find((s) => s.id === targetSemesterId);
  if (!program || !target) return { cleared: true, message: '', outstanding: [] };

  // What comes immediately before the target, within the same diploma.
  const preceding =
    target.semesterPeriod === 'SECOND'
      ? db.semesters.find(
          (s) =>
            s.programId === target.programId &&
            s.yearLevel === target.yearLevel &&
            s.semesterPeriod === 'FIRST',
        )
      : target.yearLevel > 1
        ? db.semesters.find(
            (s) =>
              s.programId === target.programId &&
              s.yearLevel === target.yearLevel - 1 &&
              s.semesterPeriod === 'SECOND',
          )
        : undefined;

  // Year 1 First Semester has no predecessor — nothing to be outstanding.
  if (!preceding) return { cleared: true, message: '', outstanding: [] };

  const previous = db.enrollments.find(
    (e) => e.studentId === studentId && e.semesterId === preceding.id,
  );
  // Never enrolled in it — a transferee, or a record encoded mid-programme.
  // Not this gate's business to refuse.
  if (!previous) return { cleared: true, message: '', outstanding: [] };

  const outstanding: string[] = [];
  for (const row of db.enrollmentSubjects) {
    if (row.enrollmentId !== previous.id) continue;
    const effective = row.finalGrade === 'INC' ? row.completionGrade : row.finalGrade;
    if (effective) continue;
    const subject = db.subjects.find((s) => s.id === row.subjectId);
    outstanding.push(subject?.code ?? row.subjectId);
  }

  if (outstanding.length === 0) return { cleared: true, message: '', outstanding: [] };

  const precedingLabel = semesterPeriodLabel(preceding.yearLevel, preceding.semesterPeriod);
  return {
    cleared: false,
    outstanding,
    message:
      `Sequential Enrollment is not open for ${student.firstName} ${student.lastName} yet — their ${precedingLabel} ` +
      `grades are not all in. Still outstanding: ${outstanding.join(', ')}. The trainer must ` +
      `submit the grading sheet and the registrar approve it, or the registrar overrides with ` +
      `a reason.`,
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

  if (semester.programId !== student.programId) {
    throw badRequest(
      `${student.firstName} ${student.lastName} is enrolled under a different Diploma than ${semesterView.programCode}.`,
    );
  }
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

  const gate = checkPrecedingSemester(studentId, semesterId);
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
    // `disabledReason` covers everything the options list already worked out —
    // already passed, deactivated, prerequisites unmet. Checking it here rather
    // than re-deriving each case means the screen and the server can never
    // disagree about why a subject is refused, and a request that bypasses the
    // UI entirely is refused on the same grounds and in the same words.
    if (candidate.disabledReason) {
      problems.push(`${candidate.code} — ${candidate.disabledReason}`);
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
      enrolledAt: nowIso(),
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

  // A trainee joining a class whose sheet has already been reviewed would
  // otherwise be unreachable: the sheet is locked to the trainer and does not
  // list them. This puts them on it and hands it back.
  for (const classScheduleId of new Set(
    rows.map((r) => r.classScheduleId).filter((id): id is string => Boolean(id)),
  )) {
    reconcileGradingSheetRoster(classScheduleId, actor);
  }

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

/**
 * Drops one subject from an existing enrollment, for a selection mistake —
 * the wrong box ticked, a subject picked twice under different names — that
 * the registrar catches before it has gone anywhere.
 *
 * Refused once the subject carries a grade. At that point it is no longer a
 * selection to undo; it is part of the trainee's record, and removing it
 * would silently erase a grade that has already been reviewed and approved.
 * Correcting a grade that is already on file is a Grade Evaluation job, not
 * this one.
 *
 * Drops the row, not the whole enrollment — `dropEnrollment` below is for
 * the trainee leaving the term entirely; this is for one line item being
 * wrong while everything else about the enrollment stays exactly as it was.
 */
export function dropEnrollmentSubject(
  enrollmentSubjectId: string,
  reason: string,
): EnrollmentView {
  const actor = requireRole('REGISTRAR');
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw badRequest('A reason is required.');

  const index = db.enrollmentSubjects.findIndex((es) => es.id === enrollmentSubjectId);
  if (index === -1) throw badRequest('That enrolled subject could not be found.');
  const row = db.enrollmentSubjects[index];

  if (row.finalGrade !== null) {
    throw badRequest(
      'This subject already has a grade on record, so it can no longer be dropped as a selection mistake. Correct the grade under Grade Evaluation instead.',
    );
  }

  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  if (!enrollment) throw badRequest('The enrollment behind this subject could not be found.');

  const student = db.students.find((s) => s.id === enrollment.studentId);
  const subject = db.subjects.find((s) => s.id === row.subjectId);
  const semester = db.semesters.find((s) => s.id === enrollment.semesterId);

  const droppedFromClass = row.classScheduleId;
  db.enrollmentSubjects.splice(index, 1);
  enrollment.totalUnits = Math.max(0, enrollment.totalUnits - row.units);
  // Take them off any sheet that already lists them, so a dropped subject
  // does not leave a name the trainer can no longer account for.
  if (droppedFromClass) reconcileGradingSheetRoster(droppedFromClass, actor);

  recordAudit({
    action: 'ENROLLMENT_SUBJECT_DROPPED',
    recordType: 'EnrollmentSubject',
    recordId: enrollmentSubjectId,
    actor,
    detail:
      `${subject?.code ?? row.subjectId} dropped from ` +
      `${student ? `${student.firstName} ${student.lastName}` : 'a student'}'s enrollment` +
      (semester ? ` for ${semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod)}` : '') +
      `. Reason: ${trimmedReason}`,
    before: { subjectId: row.subjectId, units: row.units },
  });

  return toEnrollmentView(enrollment);
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
