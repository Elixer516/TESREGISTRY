/**
 * "My" queries — the signed-in user's own records.
 *
 * A trainee reaches their data only through these functions, and every one of
 * them resolves the student id from the session rather than from an argument.
 */

import type { ClassSchedule } from '@/types';
import type { ClassScheduleView, GradeEvaluationForm, ScheduleAssessmentResult } from '@/types/views';
import { notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { toScheduleView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { getGradeEvaluation } from './grade-evaluation';
import { computeScheduleAssessment } from './gsa';

/**
 * The trainee's own open semester.
 *
 * Semesters belong to a diploma and a year level, and a trainee sits in
 * exactly one of each — so this is unambiguous, where a global lookup would
 * have returned some other diploma's calendar.
 */
function myOpenSemester(studentId: string) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return undefined;
  return db.semesters.find(
    (s) => s.isActive && s.programId === student.programId && s.yearLevel === student.yearLevel,
  );
}

function myStudentId(): string {
  const user = requireRole('TRAINEE');
  if (!user.studentId) {
    throw notFound('This account is not linked to a student record.');
  }
  return user.studentId;
}

/** The trainee's own published schedule for the active term. */
export function myWeeklySchedule(): ClassScheduleView[] {
  const studentId = myStudentId();
  const active = myOpenSemester(studentId);
  if (!active) return [];

  const enrollment = db.enrollments.find(
    (e) => e.studentId === studentId && e.semesterId === active.id,
  );
  if (!enrollment) return [];

  const schedules: ClassSchedule[] = [];
  for (const row of db.enrollmentSubjects) {
    if (row.enrollmentId !== enrollment.id || !row.classScheduleId) continue;
    const schedule = db.classSchedules.find((s) => s.id === row.classScheduleId);
    if (schedule && schedule.status === 'PUBLISHED') schedules.push(schedule);
  }
  return schedules.map(toScheduleView);
}

/**
 * A trainee sees exactly the evaluation the registrar sees for them. One
 * derivation, so the two can never disagree about their own grades.
 */
export function myGradeEvaluation(): GradeEvaluationForm {
  return getGradeEvaluation(myStudentId());
}

/** The trainee's own General Schedule and Assessment for the active term. */
export function myScheduleAssessment(): ScheduleAssessmentResult {
  const studentId = myStudentId();
  return computeScheduleAssessment(studentId);
}

export function myStudentIdOrThrow(): string {
  return myStudentId();
}

/* ---------------------------------------------------------------- */
/* Notifications — scoped to the recipient, for every role           */
/* ---------------------------------------------------------------- */




