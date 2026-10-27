/**
 * User management and the audit trail.
 *
 * The IT Administrator creates staff accounts, assigns their role,
 * deactivates and reactivates any account, and resets any password back to
 * the default. Trainee accounts are created by the Registrar's approval, not
 * here. Both the IT Administrator and the Registrar read the audit trail.
 */

import type { AuditAction, Role, User } from '@/types';
import { ALL_AUDIT_ACTIONS, ROLE_LABELS, auditActionLabel } from '@/types';
import type { AuditLogView, FacultyView, NewAccountInput, UserAccountView } from '@/types/views';
import { ApiError, badRequest, notFound } from '@/lib/api-error';
import { DEFAULT_TRAINEE_PASSWORD } from '@/lib/passwords';
import { db, nextId, nowIso } from '../repositories/db';
import { toFacultyView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF_ROLES_ASSIGNABLE: Role[] = ['REGISTRAR', 'TRAINER', 'IT_ADMIN'];

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export function listAllFaculty(query = ''): FacultyView[] {
  requireRole('REGISTRAR', 'IT_ADMIN');
  const needle = query.trim().toLowerCase();
  return db.faculty
    .filter(
      (f) =>
        !needle ||
        `${f.firstName} ${f.lastName} ${f.employeeId} ${f.diploma}`
          .toLowerCase()
          .includes(needle),
    )
    .map(toFacultyView)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/* ---------------------------------------------------------------- */
/* User management (IT Administrator)                                */
/* ---------------------------------------------------------------- */

function toAccountView(u: User, actorId: string): UserAccountView {
  const student = u.studentId ? db.students.find((s) => s.id === u.studentId) : undefined;
  const faculty = u.facultyId ? db.faculty.find((f) => f.id === u.facultyId) : undefined;
  const program = student ? db.programs.find((p) => p.id === student.programId) : undefined;
  return {
    userId: u.id,
    signInId: u.role === 'TRAINEE' ? student?.studentNumber ?? '—' : u.email,
    name: `${u.lastName}, ${u.firstName}`,
    role: u.role,
    status: u.status,
    position: u.position,
    detail: u.role === 'TRAINEE' ? program?.code ?? '' : faculty?.diploma ?? '',
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    isSelf: u.id === actorId,
  };
}

export function listUserAccounts(query = ''): UserAccountView[] {
  const actor = requireRole('IT_ADMIN');
  const needle = query.trim().toLowerCase();
  return db.users
    .map((u) => toAccountView(u, actor.id))
    .filter(
      (v) =>
        !needle ||
        `${v.name} ${v.signInId} ${ROLE_LABELS[v.role]} ${v.position} ${v.detail}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function accountFor(userId: string): User {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw notFound('That account could not be found.');
  return user;
}

function activeCount(role: Role): number {
  return db.users.filter((u) => u.role === role && u.status === 'APPROVED').length;
}

/**
 * A new staff sign-in, on the default password, to be changed at first
 * sign-in. Trainee accounts are never made here: approving the application
 * is what creates them.
 */
export function createUserAccount(input: NewAccountInput): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  if (!STAFF_ROLES_ASSIGNABLE.includes(input.role)) {
    throw badRequest('Choose Registrar, Trainer or IT Administrator. Trainee accounts come from approving an application.');
  }
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  if (!firstName || !lastName) throw badRequest('First and last name are both required.');
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Give a valid email address — it is what they sign in with.');
  if (db.users.some((u) => u.email.trim().toLowerCase() === email)) {
    throw new ApiError(409, 'DUPLICATE', `${email} already has an account.`);
  }
  let facultyId: string | null = null;
  if (input.role === 'TRAINER') {
    const faculty = input.facultyId ? db.faculty.find((f) => f.id === input.facultyId) : undefined;
    if (!faculty) throw badRequest('Choose the trainer\'s faculty record, so their classes are theirs.');
    if (db.users.some((u) => u.facultyId === faculty.id)) {
      throw new ApiError(409, 'DUPLICATE', `${faculty.firstName} ${faculty.lastName} already has an account.`);
    }
    facultyId = faculty.id;
  }
  const now = nowIso();
  const account: User = {
    id: nextId('usr'),
    email,
    password: DEFAULT_TRAINEE_PASSWORD,
    mustChangePassword: true,
    firstName,
    lastName,
    title: input.title.trim(),
    position: input.position.trim() || (input.role === 'TRAINER' ? 'Trainer' : ROLE_LABELS[input.role]),
    role: input.role,
    status: 'APPROVED',
    facultyId,
    studentId: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db.users.push(account);
  recordAudit({
    action: 'USER_CREATED',
    recordType: 'User',
    recordId: account.id,
    actor,
    after: { email, role: account.role },
    detail: `${ROLE_LABELS[account.role]} account created for ${firstName} ${lastName} (${email}). Signs in with the default password, to be changed at first sign-in.`,
  });
  return toAccountView(account, actor.id);
}

/** Deactivates (no sign-in at all) or reactivates an account. Nothing is deleted. */
export function setUserActive(userId: string, active: boolean): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const account = accountFor(userId);
  if (account.id === actor.id) throw badRequest('You cannot deactivate your own account.');
  const next = active ? 'APPROVED' : 'DEACTIVATED';
  if (account.status === next) return toAccountView(account, actor.id);
  if (!active && account.role === 'IT_ADMIN' && activeCount('IT_ADMIN') <= 1) {
    throw badRequest('This is the only active IT Administrator; give someone else the role first.');
  }
  if (active && !['DEACTIVATED', 'SUSPENDED'].includes(account.status)) {
    throw badRequest('Only a deactivated account can be reactivated here.');
  }
  const before = account.status;
  account.status = next;
  account.updatedAt = nowIso();
  recordAudit({
    action: active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED',
    recordType: 'User',
    recordId: account.id,
    actor,
    before: { status: before },
    after: { status: next },
    detail: `${account.firstName} ${account.lastName} ${active ? 'can sign in again' : 'can no longer sign in'}.`,
  });
  return toAccountView(account, actor.id);
}

/** Moves a staff account to another staff role. */
export function setUserRole(userId: string, role: Role): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const account = accountFor(userId);
  if (account.id === actor.id) throw badRequest('You cannot change your own role.');
  if (account.role === 'TRAINEE' || !STAFF_ROLES_ASSIGNABLE.includes(role)) {
    throw badRequest('Roles change between Registrar, Trainer and IT Administrator. Trainee accounts stay trainees.');
  }
  if (account.role === role) return toAccountView(account, actor.id);
  if (role === 'TRAINER' && !account.facultyId) {
    throw badRequest('A trainer needs a faculty record. Create a new Trainer account linked to their record instead.');
  }
  if (account.role === 'IT_ADMIN' && account.status === 'APPROVED' && activeCount('IT_ADMIN') <= 1) {
    throw badRequest('This is the only active IT Administrator; give someone else the role first.');
  }
  const before = account.role;
  account.role = role;
  account.updatedAt = nowIso();
  recordAudit({
    action: 'USER_ROLE_CHANGED',
    recordType: 'User',
    recordId: account.id,
    actor,
    before: { role: before },
    after: { role },
    detail: `${account.firstName} ${account.lastName}: ${ROLE_LABELS[before]} → ${ROLE_LABELS[role]}.`,
  });
  return toAccountView(account, actor.id);
}

/**
 * Puts any account back on the default password, to be changed at the next
 * sign-in, and lifts a lockout. Never the IT Administrator's own — they
 * change theirs themselves.
 */
export function resetUserPassword(userId: string): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const account = accountFor(userId);
  if (account.id === actor.id) throw badRequest('Change your own password from your account instead.');
  if (account.status !== 'APPROVED') throw badRequest('Reactivate the account before resetting its password.');
  account.password = DEFAULT_TRAINEE_PASSWORD;
  account.mustChangePassword = true;
  account.failedLoginAttempts = 0;
  account.lockedUntil = null;
  account.updatedAt = nowIso();
  recordAudit({
    action: 'USER_PASSWORD_RESET',
    recordType: 'User',
    recordId: account.id,
    actor,
    detail: `Password reset to the default for ${account.firstName} ${account.lastName}. They must choose a new one at their next sign-in.`,
  });
  return toAccountView(account, actor.id);
}

/* ---------------------------------------------------------------- */
/* Audit log                                                         */
/* ---------------------------------------------------------------- */

export interface AuditFilters {
  action?: AuditAction | 'ALL';
  recordType?: string | 'ALL';
  query?: string;
  limit?: number;
}

export function listAuditLogs(filters: AuditFilters = {}): AuditLogView[] {
  requireRole('REGISTRAR', 'IT_ADMIN');
  let rows = [...db.auditLogs];

  if (filters.action && filters.action !== 'ALL') {
    rows = rows.filter((r) => r.action === filters.action);
  }
  if (filters.recordType && filters.recordType !== 'ALL') {
    rows = rows.filter((r) => r.recordType === filters.recordType);
  }
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    rows = rows.filter((r) =>
      `${r.detail} ${r.userLabel} ${r.recordId} ${auditActionLabel(r.action)}`
        .toLowerCase()
        .includes(needle),
    );
  }

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, filters.limit ?? 300)
    .map((r) => ({
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
    }));
}

/** Action list for the filter dropdown — machine id plus readable label. */
export function auditActionOptions(): Array<{ value: AuditAction; label: string }> {
  requireRole('REGISTRAR', 'IT_ADMIN');
  return ALL_AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: auditActionLabel(action),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export function auditRecordTypes(): string[] {
  requireRole('REGISTRAR', 'IT_ADMIN');
  return [...new Set(db.auditLogs.map((r) => r.recordType))].sort();
}
