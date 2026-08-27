/**
 * Typed lookups and view-model builders over the in-memory collections.
 * Services compose these; nothing here enforces a business rule.
 */

import type {
  AcademicYear,
  ClassSchedule,
  Curriculum,
  Enrollment,
  EnrollmentSubject,
  Faculty,
  Program,
  Section,
  Semester,
  Student,
  Subject,
  User,
} from '@/types';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, semesterPeriodLabel } from '@/types';
import type {
  ClassScheduleView,
  EnrollmentSubjectView,
  FacultyView,
  SectionView,
  SemesterView,
  StudentView,
  UserView,
} from '@/types/views';
import { fullName, lastFirst } from '@/lib/format';
import { formatDayPattern, formatTimeRange } from '@/lib/schedule-time';
import { gradeRemarks } from '../services/grade-rules';
import { notFound } from '@/lib/api-error';
import { db, findById } from './db';

/* ---------------------------------------------------------------- */
/* Required getters — throw a 404 rather than returning undefined    */
/* ---------------------------------------------------------------- */

export function getStudent(id: string): Student {
  const found = findById(db.students, id);
  if (!found) throw notFound('That student record could not be found.');
  return found;
}

export function getProgram(id: string): Program {
  const found = findById(db.programs, id);
  if (!found) throw notFound('That program could not be found.');
  return found;
}

export function getCurriculum(id: string): Curriculum {
  const found = findById(db.curricula, id);
  if (!found) throw notFound('That curriculum could not be found.');
  return found;
}

export function getSubject(id: string): Subject {
  const found = findById(db.subjects, id);
  if (!found) throw notFound('That subject could not be found.');
  return found;
}

export function getSection(id: string): Section {
  const found = findById(db.sections, id);
  if (!found) throw notFound('That section could not be found.');
  return found;
}

export function getSemester(id: string): Semester {
  const found = findById(db.semesters, id);
  if (!found) throw notFound('That term could not be found.');
  return found;
}

export function getAcademicYear(id: string): AcademicYear {
  const found = findById(db.academicYears, id);
  if (!found) throw notFound('That school year could not be found.');
  return found;
}

export function getFaculty(id: string): Faculty {
  const found = findById(db.faculty, id);
  if (!found) throw notFound('That faculty record could not be found.');
  return found;
}

export function getSchedule(id: string): ClassSchedule {
  const found = findById(db.classSchedules, id);
  if (!found) throw notFound('That class schedule could not be found.');
  return found;
}

export function getEnrollment(id: string): Enrollment {
  const found = findById(db.enrollments, id);
  if (!found) throw notFound('That enrollment could not be found.');
  return found;
}

export function getEnrollmentSubject(id: string): EnrollmentSubject {
  const found = findById(db.enrollmentSubjects, id);
  if (!found) throw notFound('That enrolled subject could not be found.');
  return found;
}

export function getUser(id: string): User {
  const found = findById(db.users, id);
  if (!found) throw notFound('That user account could not be found.');
  return found;
}

/* ---------------------------------------------------------------- */
/* Optional getters                                                  */
/* ---------------------------------------------------------------- */

export function findSemester(id: string | null): Semester | undefined {
  return id ? findById(db.semesters, id) : undefined;
}

/*
 * A global `activeSemester()` used to live here. It is deliberately gone:
 * with semesters scoped to a diploma and year level, any caller that cannot
 * name both is asking a question with no answer. Use
 * `catalog.getActiveSemesterFor(programId, yearLevel)` instead.
 */

export function userDisplayName(userId: string | null): string {
  if (!userId) return 'System';
  const user = findById(db.users, userId);
  return user ? `${user.firstName} ${user.lastName}` : 'Unknown user';
}

export function facultyDisplayName(facultyId: string | null): string {
  if (!facultyId) return 'Unassigned';
  const f = findById(db.faculty, facultyId);
  return f ? `${f.firstName} ${f.lastName}` : 'Unknown trainer';
}

/* ---------------------------------------------------------------- */
/* View builders                                                     */
/* ---------------------------------------------------------------- */

export function toStudentView(student: Student): StudentView {
  const program = findById(db.programs, student.programId);
  const section = student.sectionId ? findById(db.sections, student.sectionId) : undefined;
  const curriculum = student.curriculumId
    ? findById(db.curricula, student.curriculumId)
    : undefined;
  return {
    ...student,
    fullName: fullName(student),
    lastFirstName: lastFirst(student),
    programCode: program?.code ?? '—',
    programName: program?.name ?? 'Unknown program',
    sectionCode: section?.code ?? null,
    curriculumName: curriculum?.name ?? null,
  };
}

export function toSemesterView(semester: Semester): SemesterView {
  const year = findById(db.academicYears, semester.academicYearId);
  const yearLabel = year?.label ?? '—';
  const program = findById(db.programs, semester.programId);
  const termLabel = semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod);
  return {
    id: semester.id,
    academicYearId: semester.academicYearId,
    academicYearLabel: yearLabel,
    programId: semester.programId,
    programCode: program?.code ?? '—',
    programName: program?.name ?? '—',
    yearLevel: semester.yearLevel,
    semesterPeriod: semester.semesterPeriod,
    termLabel,
    // The diploma leads, because two semesters differing only by diploma is
    // now the normal case rather than an edge one.
    label: `${program?.code ?? '—'} · ${termLabel} · ${yearLabel}`,
    startDate: semester.startDate,
    endDate: semester.endDate,
    isActive: semester.isActive,
  };
}

export function toScheduleView(schedule: ClassSchedule): ClassScheduleView {
  const subject = findById(db.subjects, schedule.subjectId);
  const section = findById(db.sections, schedule.sectionId);
  const program = section ? findById(db.programs, section.programId) : undefined;
  const semester = findById(db.semesters, schedule.semesterId);
  const year = semester ? findById(db.academicYears, semester.academicYearId) : undefined;
  const enrolledCount = db.enrollmentSubjects.filter(
    (es) => es.classScheduleId === schedule.id,
  ).length;

  return {
    ...schedule,
    days: [...schedule.days],
    subjectCode: subject?.code ?? '—',
    subjectTitle: subject?.title ?? 'Unknown subject',
    units: subject?.units ?? 0,
    sectionCode: section?.code ?? '—',
    programCode: program?.code ?? '—',
    trainerName: facultyDisplayName(schedule.facultyId),
    semesterLabel: semester
      ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod)
      : '—',
    academicYearLabel: year?.label ?? '—',
    semesterPeriod: semester?.semesterPeriod ?? 'FIRST',
    yearLevel: semester?.yearLevel ?? 1,
    dayPattern: formatDayPattern(schedule.days),
    timeRange: formatTimeRange(schedule.startTime, schedule.endTime),
    enrolledCount,
  };
}

export function scheduleLabelFor(scheduleId: string | null): string | null {
  if (!scheduleId) return null;
  const schedule = findById(db.classSchedules, scheduleId);
  if (!schedule) return null;
  const section = findById(db.sections, schedule.sectionId);
  return `${section?.code ?? '—'} · ${formatDayPattern(schedule.days)} ${formatTimeRange(
    schedule.startTime,
    schedule.endTime,
  )} · ${schedule.room}`;
}

export function toEnrollmentSubjectView(row: EnrollmentSubject): EnrollmentSubjectView {
  const subject = findById(db.subjects, row.subjectId);
  return {
    ...row,
    subjectCode: subject?.code ?? '—',
    subjectTitle: subject?.title ?? 'Unknown subject',
    remarks: gradeRemarks(row.finalGrade, row.completionGrade),
    scheduleLabel: scheduleLabelFor(row.classScheduleId),
  };
}

export function toFacultyView(faculty: Faculty): FacultyView {
  return {
    id: faculty.id,
    employeeId: faculty.employeeId,
    firstName: faculty.firstName,
    lastName: faculty.lastName,
    fullName: `${faculty.firstName} ${faculty.lastName}`,
    diploma: faculty.diploma,
    position: faculty.position,
    email: faculty.email,
    contactNumber: faculty.contactNumber,
    isActive: faculty.isActive,
  };
}

export function toSectionView(section: Section): SectionView {
  const program = findById(db.programs, section.programId);
  return {
    ...section,
    programCode: program?.code ?? '—',
    programName: program?.name ?? 'Unknown program',
    studentCount: db.students.filter((s) => s.sectionId === section.id).length,
  };
}

export function toUserView(user: User): UserView {
  const faculty = user.facultyId ? findById(db.faculty, user.facultyId) : undefined;
  const student = user.studentId ? findById(db.students, user.studentId) : undefined;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role],
    status: user.status,
    statusLabel: ACCOUNT_STATUS_LABELS[user.status],
    facultyId: user.facultyId,
    facultyName: faculty ? `${faculty.firstName} ${faculty.lastName}` : null,
    facultyEmployeeId: faculty?.employeeId ?? null,
    studentId: user.studentId,
    studentName: student ? fullName(student) : null,
    lastLoginAt: user.lastLoginAt,
    isLocked: Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()),
    createdAt: user.createdAt,
  };
}

/* ---------------------------------------------------------------- */
/* Relationship helpers                                              */
/* ---------------------------------------------------------------- */

export function enrollmentSubjectsFor(enrollmentId: string): EnrollmentSubject[] {
  return db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollmentId);
}

export function enrollmentsForStudent(studentId: string): Enrollment[] {
  return db.enrollments.filter((e) => e.studentId === studentId);
}

export function findEnrollment(
  studentId: string,
  semesterId: string,
): Enrollment | undefined {
  return db.enrollments.find(
    (e) => e.studentId === studentId && e.semesterId === semesterId,
  );
}

/** Every graded row a student holds, across all terms. */
export function allGradedRowsFor(studentId: string): EnrollmentSubject[] {
  const enrollmentIds = new Set(enrollmentsForStudent(studentId).map((e) => e.id));
  return db.enrollmentSubjects.filter((es) => enrollmentIds.has(es.enrollmentId));
}

export function semesterSortKey(semester: Semester): string {
  const year = findById(db.academicYears, semester.academicYearId);
  const program = findById(db.programs, semester.programId);
  const semOrder = semester.semesterPeriod === 'FIRST' ? '1' : '2';
  // Diploma first, so one diploma's whole sequence reads together rather than
  // being interleaved with every other diploma's matching semester.
  return `${program?.code ?? 'ZZZZ'}-${year?.label ?? '0000'}-${semester.yearLevel}-${semOrder}`;
}
