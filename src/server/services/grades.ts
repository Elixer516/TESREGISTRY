/**
 * Grade encoding — two workflows over the same rules.
 *
 *  · by class   — the full roster of one class schedule
 *  · by student — only the subjects that student is actually enrolled in
 *
 * Both go through `applyGrade`, so the rules cannot drift apart: the term must
 * be active, a trainer may only touch their own classes, the grade must be
 * 1.00–5.00 or INC, and the subject must belong to a real enrollment.
 */

import type { EnrollmentSubject, User } from '@/types';
import type {
  ClassRoster,
  ClassRosterRow,
  StudentGradeRow,
  StudentGradeSheet,
} from '@/types/views';
import { ApiError, badRequest, forbidden, notFound, validationFailed } from '@/lib/api-error';
import { db, nowIso } from '../repositories/db';
import {
  findEnrollment,
  getSchedule,
  getSemester,
  getStudent,
  scheduleLabelFor,
  toScheduleView,
  toSemesterView,
  toStudentView,
} from '../repositories/lookups';
import { requireRole } from '../auth';
import { deriveGradeStatus, gradeRemarks, parseGrade } from './grade-rules';
import { recordAudit } from './audit';

export interface GradeEntry {
  enrollmentSubjectId: string;
  finalGrade: string | null;
}

/* ---------------------------------------------------------------- */
/* Guards                                                            */
/* ---------------------------------------------------------------- */

function assertTermActive(semesterId: string): void {
  const semester = getSemester(semesterId);
  if (!semester.isActive) {
    const view = toSemesterView(semester);
    throw new ApiError(
      409,
      'TERM_INACTIVE',
      `${view.label} is not the active term. Grade encoding is only open for the active term — the Registrar can activate it under School Years & Terms.`,
    );
  }
}

/** A trainer may only encode for classes they are assigned to. */
function assertMayEncodeForSchedule(actor: User, scheduleId: string | null): void {
  if (actor.role === 'REGISTRAR') return;
  if (actor.role !== 'TRAINER') {
    throw forbidden('Only the Registrar or the assigned trainer may encode grades.');
  }
  if (!scheduleId) {
    throw forbidden(
      'This subject is not attached to a class schedule, so it can only be encoded by the Registrar.',
    );
  }
  const schedule = getSchedule(scheduleId);
  if (!actor.facultyId || schedule.facultyId !== actor.facultyId) {
    throw forbidden('You are not the assigned trainer for that class.');
  }
}

function semesterIdOf(row: EnrollmentSubject): string {
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  if (!enrollment) throw notFound('That enrolled subject has no parent enrollment.');
  return enrollment.semesterId;
}

/* ---------------------------------------------------------------- */
/* Workflow 1 — by class                                             */
/* ---------------------------------------------------------------- */

export function getClassRoster(scheduleId: string): ClassRoster {
  const actor = requireRole('REGISTRAR', 'TRAINER');
  const schedule = getSchedule(scheduleId);
  const view = toScheduleView(schedule);
  const semester = getSemester(schedule.semesterId);

  let blockedReason: string | null = null;
  if (!semester.isActive) {
    blockedReason = `${toSemesterView(semester).label} is not the active term, so grades are read-only.`;
  } else if (actor.role === 'TRAINER' && schedule.facultyId !== actor.facultyId) {
    blockedReason = 'You are not the assigned trainer for this class.';
  }

  const rows: ClassRosterRow[] = db.enrollmentSubjects
    .filter((es) => es.classScheduleId === scheduleId)
    .map((es) => {
      const enrollment = db.enrollments.find((e) => e.id === es.enrollmentId);
      const student = enrollment
        ? db.students.find((s) => s.id === enrollment.studentId)
        : undefined;
      return {
        enrollmentSubjectId: es.id,
        studentId: student?.id ?? '',
        studentNumber: student?.studentNumber ?? '—',
        studentName: student ? `${student.lastName}, ${student.firstName}` : 'Unknown student',
        units: es.units,
        finalGrade: es.finalGrade,
        completionGrade: es.completionGrade,
        gradeStatus: es.gradeStatus,
        remarks: gradeRemarks(es.finalGrade, es.completionGrade),
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    schedule: view,
    canEncode: blockedReason === null,
    encodingBlockedReason: blockedReason,
    rows,
  };
}

/** Classes the signed-in user may pick from in the class search modal. */
export function encodableClasses(semesterId: string): ReturnType<typeof toScheduleView>[] {
  const actor = requireRole('REGISTRAR', 'TRAINER');
  return db.classSchedules
    .filter((s) => {
      if (s.semesterId !== semesterId) return false;
      if (s.status !== 'PUBLISHED') return false;
      if (actor.role === 'TRAINER') return s.facultyId === actor.facultyId;
      return true;
    })
    .map(toScheduleView)
    .sort(
      (a, b) =>
        a.sectionCode.localeCompare(b.sectionCode) || a.subjectCode.localeCompare(b.subjectCode),
    );
}

/* ---------------------------------------------------------------- */
/* Workflow 2 — by student                                           */
/* ---------------------------------------------------------------- */

export function getStudentGradeSheet(
  studentId: string,
  semesterId: string,
): StudentGradeSheet {
  const actor = requireRole('REGISTRAR', 'TRAINER');
  const student = getStudent(studentId);
  const semester = getSemester(semesterId);
  const enrollment = findEnrollment(studentId, semesterId);

  let blockedReason: string | null = null;
  if (!enrollment) {
    blockedReason = `${student.firstName} ${student.lastName} is not enrolled for ${
      toSemesterView(semester).label
    }.`;
  } else if (!semester.isActive) {
    blockedReason = `${toSemesterView(semester).label} is not the active term, so grades are read-only.`;
  }

  const rows: StudentGradeRow[] = enrollment
    ? db.enrollmentSubjects
        .filter((es) => es.enrollmentId === enrollment.id)
        .map((es) => {
          const subject = db.subjects.find((s) => s.id === es.subjectId);
          return {
            enrollmentSubjectId: es.id,
            subjectCode: subject?.code ?? '—',
            subjectTitle: subject?.title ?? 'Unknown subject',
            units: es.units,
            finalGrade: es.finalGrade,
            completionGrade: es.completionGrade,
            gradeStatus: es.gradeStatus,
            remarks: gradeRemarks(es.finalGrade, es.completionGrade),
            scheduleLabel: scheduleLabelFor(es.classScheduleId),
          };
        })
        .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode))
    : [];

  // A trainer only sees rows for classes they handle.
  const visibleRows =
    actor.role === 'TRAINER'
      ? rows.filter((row) => {
          const es = db.enrollmentSubjects.find((e) => e.id === row.enrollmentSubjectId);
          if (!es?.classScheduleId) return false;
          const schedule = db.classSchedules.find((s) => s.id === es.classScheduleId);
          return schedule?.facultyId === actor.facultyId;
        })
      : rows;

  return {
    student: toStudentView(student),
    semester: toSemesterView(semester),
    enrollmentId: enrollment?.id ?? null,
    canEncode: blockedReason === null,
    encodingBlockedReason: blockedReason,
    rows: visibleRows,
  };
}

/* ---------------------------------------------------------------- */
/* The single write path                                             */
/* ---------------------------------------------------------------- */

function applyGrade(actor: User, entry: GradeEntry): EnrollmentSubject {
  const row = db.enrollmentSubjects.find((es) => es.id === entry.enrollmentSubjectId);
  if (!row) {
    throw notFound(
      'That subject is not on the student’s enrollment, so no grade can be recorded for it.',
    );
  }

  assertTermActive(semesterIdOf(row));
  assertMayEncodeForSchedule(actor, row.classScheduleId);

  const parsed = parseGrade(entry.finalGrade);
  if (!parsed.ok) throw validationFailed(parsed.message);

  const before = { ...row };
  row.finalGrade = parsed.value;

  // Clearing a grade clears any completion riding on it — an INC that no
  // longer exists cannot have been completed.
  if (parsed.value === null || parsed.value !== 'INC') {
    row.completionGrade = null;
  }

  row.gradeStatus = deriveGradeStatus(row.finalGrade, row.completionGrade);
  row.gradedAt = parsed.value ? nowIso() : null;
  row.gradedByUserId = parsed.value ? actor.id : null;

  const subject = db.subjects.find((s) => s.id === row.subjectId);
  recordAudit({
    action: 'GRADE_ENCODED',
    recordType: 'EnrollmentSubject',
    recordId: row.id,
    actor,
    detail: `${subject?.code ?? 'Subject'}: ${before.finalGrade ?? 'blank'} → ${
      row.finalGrade ?? 'blank'
    }.`,
    before,
    after: { ...row },
  });

  return row;
}

export function saveGrades(entries: GradeEntry[]): number {
  const actor = requireRole('REGISTRAR', 'TRAINER');
  if (entries.length === 0) throw badRequest('There is nothing to save.');

  // Validate the whole batch before writing any of it.
  const problems: string[] = [];
  for (const entry of entries) {
    const parsed = parseGrade(entry.finalGrade);
    if (!parsed.ok) problems.push(parsed.message);
  }
  if (problems.length > 0) {
    throw validationFailed(
      `${problems.length} grade${problems.length === 1 ? '' : 's'} rejected. Nothing was saved.`,
      { details: problems },
    );
  }

  for (const entry of entries) applyGrade(actor, entry);

  if (entries.length > 1) {
    recordAudit({
      action: 'GRADE_BULK_ENCODED',
      recordType: 'EnrollmentSubject',
      recordId: entries.map((e) => e.enrollmentSubjectId).join(','),
      actor,
      detail: `${entries.length} grades saved in one batch.`,
    });
  }

  return entries.length;
}
