/** Per-role dashboard payloads. The role decides the shape, not the caller. */

import { DAY_LABELS, auditActionLabel } from '@/types';
import type { ClassSchedule, DayCode } from '@/types';
import type {
  AdminDashboard,
  DashboardPayload,
  RegistrarDashboard,
  TraineeDashboard,
  TrainerDashboard,
  TrainingDashboard,
} from '@/types/views';
import { ApiError, notFound } from '@/lib/api-error';
import { fullName } from '@/lib/format';
import { formatTimeRange, timeToMinutes } from '@/lib/schedule-time';
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
    case 'TRAINING_OFFICER':
      return trainingDashboard();
    case 'TRAINER':
      return trainerDashboard(user.facultyId);
    case 'IT_ADMIN':
      return adminDashboard();
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
        key: 'dropped',
        label: 'Dropped',
        value: db.students.filter((s) => s.status === 'DROPPED').length,
        hint: 'Students who left before completing.',
      },
    ],
    recentlyEnrolled,
    activeTerm: active ? toSemesterView(active) : null,
    pendingApplications: db.students
      .filter((s) => s.status === 'PENDING')
      .slice(0, 5)
      .map(toStudentView),
  };
}

function trainingDashboard(): TrainingDashboard {
  const active = activeSemester();
  return {
    kind: 'TRAINING_OFFICER',
    stats: [
      {
        key: 'programs',
        label: 'Programs',
        value: db.programs.filter((p) => p.isActive).length,
        hint: 'Active qualifications offered by the centre.',
      },
      {
        key: 'published',
        label: 'Published schedules',
        value: db.classSchedules.filter((s) => s.status === 'PUBLISHED').length,
        hint: `${db.classSchedules.filter((s) => s.status === 'DRAFT').length} still in draft.`,
      },
      {
        key: 'faculty',
        label: 'Faculty',
        value: db.faculty.filter((f) => f.isActive).length,
        hint: 'Trainers and instructors on record.',
      },
      {
        key: 'availability',
        label: 'Availability submissions',
        value: db.trainerAvailability.filter((a) => a.status === 'SUBMITTED').length,
        hint: 'Awaiting review by the Training Department.',
      },
    ],
    recentSchedules: [...db.classSchedules]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map(toScheduleView),
    pendingAvailability: db.trainerAvailability
      .filter((a) => a.status === 'SUBMITTED')
      .slice(0, 5)
      .map((row) => {
        const faculty = db.faculty.find((f) => f.id === row.facultyId);
        const semester = db.semesters.find((s) => s.id === row.semesterId);
        return {
          id: row.id,
          facultyId: row.facultyId,
          facultyName: faculty ? `${faculty.firstName} ${faculty.lastName}` : 'Unknown trainer',
          employeeId: faculty?.employeeId ?? '—',
          department: faculty?.department ?? '—',
          semesterId: row.semesterId,
          semesterLabel: semester ? toSemesterView(semester).label : '—',
          days: row.days,
          dayPattern: row.days.join(''),
          startTime: row.startTime,
          endTime: row.endTime,
          timeRange: formatTimeRange(row.startTime, row.endTime),
          notes: row.notes,
          status: row.status,
          submittedAt: row.submittedAt,
          reviewedByName: null,
          reviewedAt: row.reviewedAt,
        };
      }),
    activeTerm: active ? toSemesterView(active) : null,
  };
}

function trainerDashboard(facultyId: string | null): TrainerDashboard {
  const active = activeSemester();
  const myClasses = db.classSchedules.filter(
    (s) =>
      s.facultyId === facultyId &&
      s.status === 'PUBLISHED' &&
      (!active || s.semesterId === active.id),
  );

  const studentIds = new Set<string>();
  const pendingGrades = myClasses.map((schedule) => {
    const rows = db.enrollmentSubjects.filter((es) => es.classScheduleId === schedule.id);
    for (const row of rows) {
      const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
      if (enrollment) studentIds.add(enrollment.studentId);
    }
    const view = toScheduleView(schedule);
    return {
      scheduleId: schedule.id,
      subjectCode: view.subjectCode,
      sectionCode: view.sectionCode,
      ungraded: rows.filter((r) => r.finalGrade === null).length,
      total: rows.length,
    };
  });

  const totalUngraded = pendingGrades.reduce((sum, p) => sum + p.ungraded, 0);

  return {
    kind: 'TRAINER',
    stats: [
      {
        key: 'classes',
        label: 'My classes',
        value: myClasses.length,
        hint: active ? toSemesterView(active).label : 'No active term set.',
      },
      {
        key: 'students',
        label: 'My students',
        value: studentIds.size,
        hint: 'Distinct trainees across all of your classes.',
      },
      {
        key: 'pending',
        label: 'Pending grades',
        value: totalUngraded,
        hint: 'Enrolled subject rows still waiting for a grade.',
      },
    ],
    myClasses: myClasses.map(toScheduleView),
    pendingGrades: pendingGrades.filter((p) => p.ungraded > 0),
    activeTerm: active ? toSemesterView(active) : null,
  };
}

function adminDashboard(): AdminDashboard {
  return {
    kind: 'IT_ADMIN',
    stats: [
      {
        key: 'pending',
        label: 'Pending approvals',
        value: db.users.filter((u) => u.status === 'PENDING').length,
        hint: 'Accounts that cannot sign in until reviewed.',
      },
      {
        key: 'accounts',
        label: 'Total accounts',
        value: db.users.length,
        hint: `${db.users.filter((u) => u.status === 'APPROVED').length} approved.`,
      },
      {
        key: 'suspended',
        label: 'Suspended or deactivated',
        value: db.users.filter(
          (u) => u.status === 'SUSPENDED' || u.status === 'DEACTIVATED',
        ).length,
        hint: 'Blocked from signing in.',
      },
      {
        key: 'audit',
        label: 'Audit entries',
        value: db.auditLogs.length,
        hint: 'Recorded since this session started.',
      },
    ],
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
