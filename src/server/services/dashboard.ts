/** Per-role dashboard payloads. The role decides the shape, not the caller. */

import { DAY_LABELS, auditActionLabel } from '@/types';
import type { ClassSchedule, DayCode } from '@/types';
import type { DashboardPayload, RegistrarDashboard, TraineeDashboard } from '@/types/views';
import { ApiError, notFound } from '@/lib/api-error';
import { fullName } from '@/lib/format';
import { timeToMinutes } from '@/lib/schedule-time';
import { db } from '../repositories/db';
import {
  facultyDisplayName,
  toScheduleView,
  toSemesterView,
  toStudentView,
  toUserView,
} from '../repositories/lookups';
import { requireSession } from '../auth';

export function getDashboard(): DashboardPayload {
  const user = requireSession();
  switch (user.role) {
    case 'REGISTRAR':
      return registrarDashboard();
    case 'TRAINEE':
      return traineeDashboard(user.studentId);
    default:
      throw new ApiError(400, 'BAD_REQUEST', 'Unknown role.');
  }
}

function registrarDashboard(): RegistrarDashboard {
  // Several semesters are open at once — one per diploma and year level — so
  // "currently enrolled" spans all of them rather than whichever single one
  // a global lookup happened to return.
  const openSemesterIds = new Set(db.semesters.filter((s) => s.isActive).map((s) => s.id));
  const enrolledIds = new Set(
    db.enrollments
      .filter((e) => openSemesterIds.has(e.semesterId) && e.status !== 'DROPPED')
      .map((e) => e.studentId),
  );
  const openSemesters = db.semesters.filter((s) => s.isActive);
  const active = openSemesters[0];

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
        hint:
          openSemesters.length > 0
            ? `Across ${openSemesters.length} open semester${openSemesters.length === 1 ? '' : 's'}.`
            : 'No semester is open.',
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

function traineeDashboard(studentId: string | null): TraineeDashboard {
  if (!studentId) throw notFound('This account is not linked to a student record.');
  const student = db.students.find((s) => s.id === studentId);
  if (!student) throw notFound('Your student record could not be found.');

  // A trainee sits in exactly one diploma at one year level, so their open
  // semester is unambiguous once both are supplied.
  const active = db.semesters.find(
    (s) => s.isActive && s.programId === student.programId && s.yearLevel === student.yearLevel,
  );
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
  };
}
