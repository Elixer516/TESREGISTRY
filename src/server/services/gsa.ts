/**
 * The General Schedule and Assessment.
 *
 * One trainee's currently open semester: the subjects they are enrolled in,
 * the units those carry, and the class schedule behind each. It is a
 * statement of what they are studying right now, not a record of results —
 * grades belong to the Grade Evaluation Form.
 *
 * The semester resolves against the trainee's own diploma and year level.
 * Semesters are per-diploma, so a global "active semester" would be the wrong
 * question: a Year 1 IT trainee and a Year 3 HRT trainee are both current,
 * in different semesters, at the same moment.
 */

import type { ScheduleAssessmentResult } from '@/types/views';
import { ApiError } from '@/lib/api-error';
import { db, findById } from '../repositories/db';
import {
  enrollmentSubjectsFor,
  findEnrollment,
  getStudent,
  toEnrollmentSubjectView,
  toScheduleView,
  toSemesterView,
  toStudentView,
} from '../repositories/lookups';
import { currentUser } from '../auth';

export function computeScheduleAssessment(studentId: string): ScheduleAssessmentResult {
  const user = currentUser();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first.');
  if (user.role === 'TRAINEE' && user.studentId !== studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only view your own schedule and assessment.');
  }
  if (user.role !== 'REGISTRAR' && user.role !== 'TRAINEE') {
    throw new ApiError(403, 'FORBIDDEN', 'Only the Registrar may generate this document.');
  }

  const student = toStudentView(getStudent(studentId));
  const active = db.semesters.find(
    (s) =>
      s.isActive && s.programId === student.programId && s.yearLevel === student.yearLevel,
  );
  const term = active ? toSemesterView(active) : null;
  const enrollment = active ? findEnrollment(studentId, active.id) : undefined;

  if (!enrollment) {
    return { student, term, enrollmentStatus: null, totalUnits: 0, subjects: [], schedules: [] };
  }

  const rows = enrollmentSubjectsFor(enrollment.id);
  const subjects = rows.map(toEnrollmentSubjectView);
  const schedules = rows
    .map((row) =>
      row.classScheduleId ? findById(db.classSchedules, row.classScheduleId) : undefined,
    )
    .filter((schedule): schedule is NonNullable<typeof schedule> => Boolean(schedule))
    .map(toScheduleView);

  return {
    student,
    term,
    enrollmentStatus: enrollment.status,
    totalUnits: enrollment.totalUnits,
    subjects,
    schedules,
  };
}
