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
  Enrollment,
  EnrollmentDocument,
  EnrollmentSubject,
  Faculty,
  FacultyAssignment,
  GradeCompletion,
  GradingSheet,
  Program,
  ProgramSubject,
  Section,
  Semester,
  Student,
  Subject,
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
  /** Metadata only — the files themselves live in Google Drive. */
  enrollmentDocuments: EnrollmentDocument[];
  auditLogs: AuditLog[];
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
  replaceContents(fresh);
  idCounter = highestIdSeen();
  persist();
}

/**
 * Pulls in whatever another browser tab most recently wrote to localStorage,
 * replacing this tab's copy of every collection in place.
 *
 * A tab's `db` object is loaded once, at startup, into its own JS heap —
 * writing to localStorage from another tab does not re-run this module here,
 * so without this a registrar sitting on Students would never see an
 * application an applicant submitted from /apply in a second tab until they
 * reloaded. The `storage` event (see `@/components/CrossTabSync`) is what
 * calls this, and only ever fires in tabs OTHER than the one that wrote —
 * never the writer itself — so there is no risk of a tab re-syncing its own
 * change back onto itself.
 *
 * Returns false when there is nothing newer to pull in (storage was cleared,
 * or holds a snapshot this build's `loadSnapshot` rejects), so the caller
 * knows not to bother invalidating anything.
 */
export function syncFromStorage(): boolean {
  const fresh = loadSnapshot();
  if (!fresh) return false;
  replaceContents(fresh);
  // Max, not a flat reassignment: this tab may hold local edits — made in
  // the instant between the other tab's write and this sync — whose ids the
  // incoming snapshot does not know about yet. Rewinding the counter below
  // them would risk handing one back out.
  idCounter = Math.max(idCounter, highestIdSeen());
  return true;
}

/** Replaces every collection's contents in place, keeping `db`'s identity. */
function replaceContents(next: Database): void {
  for (const key of Object.keys(db) as Array<keyof Database>) {
    // Replace contents rather than the object, so every module that already
    // imported `db` keeps pointing at the live store.
    (db[key] as unknown[]).length = 0;
    (db[key] as unknown[]).push(...(next[key] as unknown[]));
  }
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
