/**
 * The in-memory database.
 *
 * Still an object graph rather than a real store, but no longer only in
 * memory: it is snapshotted to localStorage so an application submitted on
 * the public form is still in the Pending queue after the registrar reloads.
 * See `./persistence` for what that does and does not promise.
 */

import type {
  AcademicYear,
  AuditLog,
  ClassSchedule,
  Curriculum,
  DocumentRequest,
  Enrollment,
  EnrollmentDocument,
  EnrollmentSubject,
  Faculty,
  FacultyAssignment,
  GeneratedDocument,
  GradeCompletion,
  GradingSheet,
  Notification,
  PreviousSchoolRecord,
  Program,
  ProgramSubject,
  Section,
  Semester,
  Student,
  Subject,
  TorDocument,
  User,
} from '@/types';
import { createSeedDatabase } from '../data/seed';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence';

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
  /** Trainer submissions awaiting or past registrar review. */
  gradingSheets: GradingSheet[];
  previousSchoolRecords: PreviousSchoolRecord[];
  torDocuments: TorDocument[];
  /** Metadata only — the files themselves live in Google Drive. */
  enrollmentDocuments: EnrollmentDocument[];
  documentRequests: DocumentRequest[];
  generatedDocuments: GeneratedDocument[];
  auditLogs: AuditLog[];
  notifications: Notification[];
}

export const db: Database = loadSnapshot() ?? createSeedDatabase();

/** Persists the current state. Called by the transport seam after every call. */
export function persist(): void {
  saveSnapshot(db);
}

/** Throws away the snapshot and re-seeds in place, for the "reset demo data" action. */
export function resetToSeed(): void {
  clearSnapshot();
  const fresh = createSeedDatabase();
  for (const key of Object.keys(db) as Array<keyof Database>) {
    // Replace contents rather than the object, so every module that already
    // imported `db` keeps pointing at the live store.
    (db[key] as unknown[]).length = 0;
    (db[key] as unknown[]).push(...(fresh[key] as unknown[]));
  }
  idCounter = highestIdSeen();
  persist();
}

/**
 * Ids must not collide with a restored snapshot's, so the counter resumes
 * above the highest `prefix-N` already on file rather than restarting.
 */
function highestIdSeen(): number {
  let highest = 10_000;
  for (const key of Object.keys(db) as Array<keyof Database>) {
    for (const row of db[key] as Array<{ id?: string }>) {
      const id = row?.id;
      if (typeof id !== 'string') continue;
      const n = Number(id.slice(id.lastIndexOf('-') + 1));
      if (Number.isFinite(n) && n > highest) highest = n;
    }
  }
  return highest;
}

let idCounter = highestIdSeen();

/** Monotonic id generator — unique across reloads, not just this page. */
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
