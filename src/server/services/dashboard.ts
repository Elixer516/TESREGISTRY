/** Per-role dashboard payloads. The role decides the shape, not the caller. */

import { DAY_LABELS, auditActionLabel } from '@/types';
import type { ClassSchedule, DayCode } from '@/types';
import type { DashboardPayload, RegistrarDashboard, TraineeDashboard } from '@/types/views';
import { ApiError, notFound } from '@/lib/api-error';
import { fullName } from '@/lib/format';
import { timeToMinutes } from '@/lib/schedule-time';
import { db } from '../repositories/db';
import {
  activeSemester,
  facultyDisplayName,
  toScheduleView,
  toSemesterView,
  toStudentView,
  toUserView,
} from '../repositories/lookups';
import { requireSession } from '../auth';
import { unreadCount } from './notifications';

export function getDashboard(): DashboardPayload {
  const user = requireSession();
  switch (user.role) {
    case 'REGISTRAR':
      return registrarDashboard();
    case 'TRAINEE':
      return traineeDashboard(user.studentId, user.id);
    default:
      throw new ApiError(400, 'BAD_REQUEST', 'Unknown role.');
  }
}

function registrarDashboard(): RegistrarDashboard {
  const active = activeSemester();
  const enrolledIds = active
    ? new Set(
        db.enrollments
          .filter((e) => e.semesterId === active.id && e.status !== 'DROPPED')
          .map((e) => e.studentId),
      )
    : new Set<string>();

  const recentlyEnrolled = [...db.enrollments]
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))
    .slice(0, 6)
    .map((enrollment) => {
      const student = db.students.find((s) => s.id === enrollment.studentId);
      const program = student ? db.programs.find((p) => p.id === student.programId) : undefined;
      const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
      return {
        enrollmentId: enrollment.id,
        studentName: student ? fullName(student) : 'Unknown student',
        studentNumber: student?.studentNumber ?? '—',
        programCode: program?.code ?? '—',
        termLabel: semester ? toSemesterView(semester).label : '—',
        enrolledAt: enrollment.enrolledAt,
        units: enrollment.totalUnits,
      };
    });

  return {
    kind: 'REGISTRAR',
    stats: [
      {
        key: 'total',
        label: 'Total students',
        value: db.students.length,
        hint: 'Every application and enrolled student on file.',
      },
      {
        key: 'enrolled',
        label: 'Currently enrolled',
        value: enrolledIds.size,
        hint: active ? `Active term: ${toSemesterView(active).label}` : 'No active term set.',
      },
      {
        key: 'pending',
        label: 'Pending applications',
        value: db.students.filter((s) => s.status === 'PENDING').length,
        hint: 'Awaiting approval and curriculum assignment.',
      },
      {
        key: 'published',
        label: 'Published schedules',
        value: db.classSchedules.filter((s) => s.status === 'PUBLISHED').length,
        hint: `${db.classSchedules.filter((s) => s.status === 'DRAFT').length} still in draft.`,
      },
    ],
    recentlyEnrolled,
    activeTerm: active ? toSemesterView(active) : null,
    pendingApplications: db.students
      .filter((s) => s.status === 'PENDING')
      .slice(0, 5)
      .map(toStudentView),
    recentSchedules: [...db.classSchedules]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map(toScheduleView),
    pendingAccounts: db.users
      .filter((u) => u.status === 'PENDING')
      .map(toUserView)
      .slice(0, 5),
    recentActivity: db.auditLogs.slice(0, 8).map((r) => ({
      id: r.id,
      action: r.action,
      actionLabel: auditActionLabel(r.action),
      recordType: r.recordType,
      recordId: r.recordId,
      userLabel: r.userLabel,
      detail: r.detail,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt,
    })),
  };
}

const DAY_ORDER: DayCode[] = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'];

function traineeDashboard(studentId: string | null, userId: string): TraineeDashboard {
  if (!studentId) throw notFound('This account is not linked to a student record.');
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw notFound('Your student record could not be found.');

  const active = activeSemester();
  const enrollment = active
    ? db.enrollments.find((e) => e.studentId === studentId && e.semesterId === active.id)
    : undefined;
  const rows = enrollment
    ? db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollment.id)
    : [];

  const schedules: ClassSchedule[] = [];
  for (const row of rows) {
    if (!row.classScheduleId) continue;
    const schedule = db.classSchedules.find((s) => s.id === row.classScheduleId);
    if (schedule && schedule.status === 'PUBLISHED') schedules.push(schedule);
  }

  // "Next" is the earliest slot in the week grid — this build has no real clock
  // to chase, so week order is the honest interpretation.
  let next: TraineeDashboard['nextClass'] = null;
  let bestKey = Number.POSITIVE_INFINITY;
  for (const schedule of schedules) {
    for (const day of schedule.days) {
      const key = DAY_ORDER.indexOf(day) * 10_000 + timeToMinutes(schedule.startTime);
      if (key < bestKey) {
        bestKey = key;
        const view = toScheduleView(schedule);
        next = {
          subjectCode: view.subjectCode,
          subjectTitle: view.subjectTitle,
          dayLabel: DAY_LABELS[day],
          timeRange: view.timeRange,
          room: schedule.room,
          trainerName: facultyDisplayName(schedule.facultyId),
        };
      }
    }
  }

  const program = db.programs.find((p) => p.id === student.programId);
  const section = student.sectionId
    ? db.sections.find((s) => s.id === student.sectionId)
    : undefined;

  return {
    kind: 'TRAINEE',
    student: toStudentView(student),
    programName: program?.name ?? '—',
    sectionCode: section?.code ?? null,
    activeTerm: active ? toSemesterView(active) : null,
    nextClass: next,
    enrolledUnits: enrollment?.totalUnits ?? 0,
    subjectCount: rows.length,
    unreadNotifications: unreadCount(userId),
  };
}
