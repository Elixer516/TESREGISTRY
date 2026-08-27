/**
 * "My" queries — the signed-in user's own records.
 *
 * A trainee reaches their data only through these functions, and every one of
 * them resolves the student id from the session rather than from an argument.
 */

import type { ClassSchedule, Notification } from '@/types';
import type { AcademicRecordView, ClassScheduleView, ScheduleAssessmentResult } from '@/types/views';
import { ApiError, notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { toScheduleView } from '../repositories/lookups';
import { requireRole, requireSession } from '../auth';
import { buildAcademicRecord } from './records';
import { computeScheduleAssessment } from './documents';
import { listNotifications, unreadCount } from './notifications';

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

export function myAcademicRecord(): AcademicRecordView {
  const studentId = myStudentId();
  return buildAcademicRecord(studentId);
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

export function myNotifications(): Notification[] {
  const user = requireSession();
  return listNotifications(user.id);
}

export function myUnreadCount(): number {
  const user = requireSession();
  return unreadCount(user.id);
}

export function markNotificationRead(id: string): Notification[] {
  const user = requireSession();
  const notification = db.notifications.find((n) => n.id === id);
  if (!notification) throw notFound('That notification could not be found.');
  if (notification.userId !== user.id) {
    throw new ApiError(403, 'FORBIDDEN', 'That notification belongs to another account.');
  }
  notification.isRead = true;
  return listNotifications(user.id);
}

export function markAllNotificationsRead(): Notification[] {
  const user = requireSession();
  for (const notification of db.notifications) {
    if (notification.userId === user.id) notification.isRead = true;
  }
  return listNotifications(user.id);
}
