/**
 * "My" queries — the signed-in user's own records.
 *
 * A trainee reaches their data only through these functions, and every one of
 * them resolves the student id from the session rather than from an argument.
 */

import type { ClassSchedule, Notification } from '@/types';
import type { AcademicRecordView, ClassScheduleView } from '@/types/views';
import { ApiError, notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { activeSemester, toScheduleView } from '../repositories/lookups';
import { requireRole, requireSession } from '../auth';
import { buildAcademicRecord } from './records';
import { listNotifications, unreadCount } from './notifications';

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
  const active = activeSemester();
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
