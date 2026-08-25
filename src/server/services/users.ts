/**
 * User accounts and the audit log — the Registrar's administrative surface.
 *
 * Every account mutation re-checks the Registrar's own password. An
 * unattended workstation should not be enough to suspend a colleague.
 */

import type { AuditAction, Role, User, UserAccountStatus } from '@/types';
import { ALL_AUDIT_ACTIONS, ROLE_LABELS, auditActionLabel } from '@/types';
import type { AuditLogView, FacultyView, UserView } from '@/types/views';
import { badRequest, duplicate, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getUser, toFacultyView, toUserView } from '../repositories/lookups';
import { requireRole, verifyOwnPassword } from '../auth';
import { recordAudit } from './audit';
import { notify } from './notifications';

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export interface UserFilters {
  role?: Role | 'ALL';
  status?: UserAccountStatus | 'ALL';
  query?: string;
}

export function listUsers(filters: UserFilters = {}): UserView[] {
  requireRole('REGISTRAR');
  let rows = [...db.users];

  if (filters.role && filters.role !== 'ALL') rows = rows.filter((u) => u.role === filters.role);
  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((u) => u.status === filters.status);
  }

  let views = rows.map(toUserView);
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    views = views.filter((v) =>
      `${v.fullName} ${v.email} ${v.roleLabel} ${v.facultyEmployeeId ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }

  return views.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function listAllFaculty(query = ''): FacultyView[] {
  requireRole('REGISTRAR');
  const needle = query.trim().toLowerCase();
  return db.faculty
    .filter(
      (f) =>
        !needle ||
        `${f.firstName} ${f.lastName} ${f.employeeId} ${f.department}`
          .toLowerCase()
          .includes(needle),
    )
    .map(toFacultyView)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/* ---------------------------------------------------------------- */
/* Account creation                                                  */
/* ---------------------------------------------------------------- */

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  studentId: string | null;
  /** The administrator's own password. */
  adminPassword: string;
}

export function createUser(input: CreateUserInput): UserView {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(input.adminPassword);

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest('Enter a valid email address.');
  }
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw duplicate(`An account with the email ${email} already exists.`);
  }
  if (input.password.length < 8) {
    throw badRequest('The password must be at least 8 characters long.');
  }
  if (!input.firstName.trim() || !input.lastName.trim()) {
    throw badRequest('First and last name are required.');
  }

  let studentId: string | null = null;
  if (input.role === 'TRAINEE') {
    if (!input.studentId) {
      throw badRequest('A trainee account must be linked to an existing student record.');
    }
    if (db.users.some((u) => u.studentId === input.studentId)) {
      throw duplicate('That student already has a portal login.');
    }
    studentId = input.studentId;
  }

  const user: User = {
    id: nextId('usr'),
    email,
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    role: input.role,
    status: 'PENDING',
    facultyId: null,
    studentId,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.users.push(user);

  recordAudit({
    action: 'USER_CREATED',
    recordType: 'User',
    recordId: user.id,
    actor,
    detail: `${ROLE_LABELS[user.role]} account created for ${user.email}. It starts as Pending Review.`,
    after: { email: user.email, role: user.role, status: user.status },
  });

  notify({
    userId: actor.id,
    title: 'Account awaiting review',
    body: `${user.firstName} ${user.lastName} (${ROLE_LABELS[user.role]}) is pending approval.`,
    category: 'ACCOUNT',
    link: '/users',
  });

  return toUserView(user);
}

/* ---------------------------------------------------------------- */
/* Account state changes                                             */
/* ---------------------------------------------------------------- */

const STATUS_ACTIONS: Record<
  Exclude<UserAccountStatus, 'PENDING'>,
  { action: AuditAction; verb: string }
> = {
  APPROVED: { action: 'USER_APPROVED', verb: 'approved' },
  REJECTED: { action: 'USER_REJECTED', verb: 'rejected' },
  SUSPENDED: { action: 'USER_SUSPENDED', verb: 'suspended' },
  DEACTIVATED: { action: 'USER_DEACTIVATED', verb: 'deactivated' },
};

export function setUserStatus(
  userId: string,
  status: UserAccountStatus,
  adminPassword: string,
  reason = '',
): UserView {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(adminPassword);

  const user = getUser(userId);
  if (user.id === actor.id && status !== 'APPROVED') {
    throw badRequest('You cannot suspend or deactivate your own account.');
  }
  if (status === 'PENDING') {
    throw badRequest('An account cannot be returned to Pending Review.');
  }
  if (user.status === status) {
    throw badRequest(`This account is already ${status}.`);
  }

  const before = { status: user.status };
  const wasApproved = user.status === 'APPROVED';
  user.status = status;
  user.updatedAt = nowIso();
  if (status === 'APPROVED') {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  const meta = STATUS_ACTIONS[status as Exclude<UserAccountStatus, 'PENDING'>];
  recordAudit({
    action:
      status === 'APPROVED' && !wasApproved && before.status !== 'PENDING'
        ? 'USER_REACTIVATED'
        : meta.action,
    recordType: 'User',
    recordId: user.id,
    actor,
    detail: `${user.email} ${meta.verb}${reason.trim() ? `: ${reason.trim()}` : '.'}`,
    before,
    after: { status: user.status },
  });

  notify({
    userId: user.id,
    title: 'Account status changed',
    body: `Your account was ${meta.verb} by the Registrar.`,
    category: 'ACCOUNT',
    link: null,
  });

  return toUserView(user);
}

export function resetPassword(
  userId: string,
  newPassword: string,
  adminPassword: string,
): UserView {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(adminPassword);

  const user = getUser(userId);
  if (newPassword.length < 8) {
    throw badRequest('The new password must be at least 8 characters long.');
  }

  user.password = newPassword;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.updatedAt = nowIso();

  recordAudit({
    action: 'USER_PASSWORD_RESET',
    recordType: 'User',
    recordId: user.id,
    actor,
    detail: `Password reset for ${user.email}. Any lockout was cleared.`,
  });

  notify({
    userId: user.id,
    title: 'Password reset',
    body: 'Your password was reset by the Registrar.',
    category: 'ACCOUNT',
    link: null,
  });

  return toUserView(user);
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
  requireRole('REGISTRAR');
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
  requireRole('REGISTRAR');
  return ALL_AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: auditActionLabel(action),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export function auditRecordTypes(): string[] {
  requireRole('REGISTRAR');
  return [...new Set(db.auditLogs.map((r) => r.recordType))].sort();
}

export function getUserView(id: string): UserView {
  requireRole('REGISTRAR');
  const user = db.users.find((u) => u.id === id);
  if (!user) throw notFound('That user account could not be found.');
  return toUserView(user);
}
