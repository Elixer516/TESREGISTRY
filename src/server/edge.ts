/**
 * The server, run per request inside the `api` Edge Function (Phase 2).
 *
 * Every rule stays where it already is — in the services behind `serverApi`.
 * The function hands this a snapshot of the database and the caller; this
 * runs the one operation against it exactly as the browser build does, and
 * returns the result with the rows the operation changed, which the function
 * then writes back. Nothing here knows about Supabase or Deno.
 */

import { ApiError } from '@/lib/api-error';
import { serverApi } from './api';
import { actAs, adoptSession, currentUser, markPasswordVerified } from './auth';
import { recordAudit } from './services/audit';
import { db, loadDatabase, type Database } from './repositories/db';

/** Operations that re-check the caller's own password, and which argument carries it. */
export const PASSWORD_ARGUMENT: Record<string, number> = {
  'demo.reset': 1,
  'students.archive': 1,
  'enrollmentDocuments.remove': 1,
};

export interface Caller {
  userId: string;
  /** Status and flag as Supabase holds them; the records are checked too. */
  status: string;
  mustChangePassword: boolean;
}

export interface ChangeSet {
  /** Collection name (camelCase, as in `Database`) → rows to insert or update. */
  upsert: Partial<Record<keyof Database, unknown[]>>;
  /** Collection name → ids to delete. */
  remove: Partial<Record<keyof Database, string[]>>;
}

export type Outcome =
  | { ok: true; result: unknown; changes: ChangeSet; changed: boolean }
  | {
      ok: false;
      error: { status: number; code: string; message: string; [extra: string]: unknown };
    };

/** Session operations the function answers itself, in place of the browser-only `auth.*`. */
function sessionOperation(name: string, args: unknown[], caller: Caller | null): unknown {
  if (!caller) throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  switch (name) {
    case 'me':
      // `true` on the call right after sign-in, so the audit trail records it.
      return adoptSession(
        caller.userId,
        { status: caller.status as never, mustChangePassword: caller.mustChangePassword },
        args[0] === true,
      );
    case 'logout': {
      const user = currentUser();
      if (user) {
        recordAudit({ action: 'LOGOUT', recordType: 'User', recordId: user.id, actor: user, detail: 'Signed out.' });
      }
      return null;
    }
    case 'updateMyProfile':
      return serverApi.auth.updateMyProfile(args[0] as never);
    default:
      throw new ApiError(400, 'BAD_REQUEST', 'Unknown operation.');
  }
}

/** Collections in dependency order: a table comes after every table it points to. */
const ORDER: Array<keyof Database> = [
  'programs', 'curricula', 'subjects', 'programSubjects', 'academicYears', 'semesters', 'sections',
  'faculty', 'students', 'users', 'classSchedules', 'facultyAssignments', 'gradeDeadlineOverrides',
  'enrollments', 'enrollmentSubjects', 'gradeCompletions', 'gradingSheets', 'facultyEvaluations',
  'dropCases', 'previousSchoolRecords', 'subjectCredits', 'enrollmentDocuments', 'requirementReceipts',
  'documentRequests', 'auditLogs',
];

const snake = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
/** Date and time columns, which the database will not take as ''. */
const isDateField = (field: string) => /(At|Date|On)$|^date[A-Z]/.test(field);

type Row = Record<string, unknown>;

/** `registream_snapshot()`'s tables (snake_case) as the app's `Database`. */
export function fromTables(tables: Record<string, Row[]>): Database {
  const out = {} as Record<string, unknown[]>;
  for (const key of ORDER) {
    out[key] = (tables[snake(key)] ?? []).map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [camel(k), v])),
    );
  }
  return out as unknown as Database;
}

/** A change set in the form `registream_apply()` takes, parents first. */
export function toTableChanges(changes: ChangeSet): Array<{ table: string; upsert: Row[]; delete: string[] }> {
  return ORDER.filter((key) => changes.upsert[key] || changes.remove[key]).map((key) => ({
    table: snake(key),
    upsert: (changes.upsert[key] ?? []).map((row) =>
      Object.fromEntries(
        Object.entries(row as Row)
          // Passwords belong to Supabase Auth, never to these tables.
          .filter(([k]) => k !== 'password')
          .map(([k, v]) => [snake(k), v === '' && isDateField(k) ? null : v]),
      ),
    ),
    delete: changes.remove[key] ?? [],
  }));
}

function resolve(op: string): ((...args: unknown[]) => unknown) | null {
  const [namespace, name, ...rest] = op.split('.');
  // `auth.*` checks passwords against the records, which hold none on
  // Supabase — it must never be reachable from outside.
  if (!namespace || !name || rest.length || namespace === 'auth') return null;
  const group = (serverApi as unknown as Record<string, Record<string, unknown>>)[namespace];
  const fn = group && Object.prototype.hasOwnProperty.call(group, name) ? group[name] : undefined;
  return typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown) : null;
}

function diff(before: Database, after: Database): { changes: ChangeSet; changed: boolean } {
  const changes: ChangeSet = { upsert: {}, remove: {} };
  let changed = false;
  for (const key of Object.keys(after) as Array<keyof Database>) {
    const old = new Map((before[key] as Array<{ id: string }>).map((r) => [r.id, JSON.stringify(r)]));
    const upsert: unknown[] = [];
    for (const row of after[key] as Array<{ id: string }>) {
      if (old.get(row.id) !== JSON.stringify(row)) upsert.push(row);
      old.delete(row.id);
    }
    if (upsert.length) changes.upsert[key] = upsert;
    if (old.size) changes.remove[key] = [...old.keys()];
    changed ||= upsert.length > 0 || old.size > 0;
  }
  return { changes, changed };
}

/**
 * Runs one operation. `snapshot` is consumed (the services mutate it);
 * `verifiedPassword` is set only when the function has already confirmed it
 * with Supabase Auth for this caller.
 */
export function execute(
  snapshot: Database,
  caller: Caller | null,
  op: string,
  args: unknown[],
  verifiedPassword: string | null,
): Outcome {
  const before = JSON.parse(JSON.stringify(snapshot)) as Database;
  loadDatabase(snapshot);
  actAs(caller?.userId ?? null);
  if (verifiedPassword !== null) markPasswordVerified(verifiedPassword);
  try {
    let result: unknown;
    if (op.startsWith('session.')) {
      result = sessionOperation(op.slice('session.'.length), args, caller);
    } else {
      const fn = resolve(op);
      if (!fn) throw new ApiError(400, 'BAD_REQUEST', 'Unknown operation.');
      result = fn(...args);
    }
    const { changes, changed } = diff(before, db);
    return { ok: true, result: result === undefined ? null : result, changes, changed };
  } catch (caught) {
    if (caught instanceof ApiError) {
      return {
        ok: false,
        error: {
          status: caught.status,
          code: caught.code,
          message: caught.message,
          conflicts: caught.conflicts,
          details: caught.details,
          rowErrors: caught.rowErrors,
        },
      };
    }
    console.error(caught);
    return {
      ok: false,
      error: { status: 500, code: 'BAD_REQUEST', message: 'The server returned an unexpected error.' },
    };
  } finally {
    actAs(null);
  }
}
