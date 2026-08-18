/**
 * The in-memory database.
 *
 * There is no persistence layer and no network. Everything lives in these
 * arrays for the lifetime of the page; a reload re-seeds from scratch. That is
 * expected behaviour for this build, not a limitation to work around.
 */

import type {
  AcademicYear,
  AuditLog,
  ClassSchedule,
  Curriculum,
  DocumentRequest,
  Enrollment,
  EnrollmentSubject,
  Faculty,
  FacultyAssignment,
  GeneratedDocument,
  GradeCompletion,
  Notification,
  PreviousSchoolRecord,
  Program,
  ProgramSubject,
  Section,
  Semester,
  Student,
  Subject,
  TorDocument,
  TrainerAvailability,
  User,
} from '@/types';
import { createSeedDatabase } from '../data/seed';

export interface Database {
  users: User[];
  faculty: Faculty[];
  students: Student[];
  programs: Program[];
  curricula: Curriculum[];
  subjects: Subject[];
  programSubjects: ProgramSubject[];
  academicYears: AcademicYear[];
  semesters: Semester[];
  sections: Section[];
  classSchedules: ClassSchedule[];
  facultyAssignments: FacultyAssignment[];
  enrollments: Enrollment[];
  enrollmentSubjects: EnrollmentSubject[];
  gradeCompletions: GradeCompletion[];
  previousSchoolRecords: PreviousSchoolRecord[];
  torDocuments: TorDocument[];
  documentRequests: DocumentRequest[];
  generatedDocuments: GeneratedDocument[];
  auditLogs: AuditLog[];
  trainerAvailability: TrainerAvailability[];
  notifications: Notification[];
}

export const db: Database = createSeedDatabase();

let idCounter = 10_000;

/** Monotonic id generator — unique for the life of the page. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Hand back a detached copy so callers can never mutate the store by reference. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function cloneAll<T>(values: T[]): T[] {
  return values.map((v) => structuredClone(v));
}

export function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((item) => item.id === id);
}
