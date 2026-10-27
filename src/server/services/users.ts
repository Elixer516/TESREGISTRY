/**
 * User management and the audit trail.
 *
 * The IT Administrator creates accounts with their first password, edits
 * them (name, email, position, role), deactivates and reactivates them, and
 * sets a new password for anyone who has forgotten theirs. Approving an
 * application still creates a trainee's account too. Both the IT
 * Administrator and the Registrar read the audit trail.
 */

import type { AuditAction, Role, User } from '@/types';
import { ALL_AUDIT_ACTIONS, ALL_ROLES, ROLE_LABELS, auditActionLabel } from '@/types';
import type { AccountEditInput, AccountRoleChoice, AuditLogView, FacultyView, NewAccountInput, UserAccountView } from '@/types/views';
import { ApiError, badRequest, notFound } from '@/lib/api-error';
import { passwordProblem } from '@/lib/passwords';
import { db, nextId, nowIso } from '../repositories/db';
import { toFacultyView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { facultyProgramId } from './head-scope';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const trainerProgramId = u.role === 'TRAINER' && faculty ? facultyProgramId(faculty) : null;
  const trainerProgram = trainerProgramId ? db.programs.find((x) => x.id === trainerProgramId) : undefined;
  const program = student ? db.programs.find((p) => p.id === student.programId) : undefined;
  return {
    userId: u.id,
    signInId: u.role === 'TRAINEE' ? student?.studentNumber ?? '—' : u.email,
    name: `${u.lastName}, ${u.firstName}`,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    isHead: u.role === 'TRAINER' && !!faculty?.isHead,
    programId: trainerProgramId,
    status: u.status,
    position: u.position,
    detail: u.role === 'TRAINEE' ? program?.code ?? '' : trainerProgram?.code ?? faculty?.diploma ?? '',
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
        `${v.name} ${v.signInId} ${v.isHead ? 'head trainer' : ROLE_LABELS[v.role]} ${v.position} ${v.detail}`.toLowerCase().includes(needle),
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

/** The stored role behind a choice: Head Trainer is a Trainer who heads their diploma. */
function roleOf(choice: AccountRoleChoice): { role: Role; head: boolean } {
  if (choice === 'HEAD_TRAINER') return { role: 'TRAINER', head: true };
  if (!ALL_ROLES.includes(choice)) throw badRequest('Choose a role.');
  return { role: choice, head: false };
}

function choiceLabel(choice: AccountRoleChoice): string {
  return choice === 'HEAD_TRAINER' ? 'Head Trainer' : ROLE_LABELS[choice];
}

/** Marks a trainer's record as head (or not) and names the diploma on it. */
function applyTrainerRecord(facultyId: string, head: boolean, programId: string | null) {
  const faculty = db.faculty.find((f) => f.id === facultyId);
  if (!faculty) return;
  if (programId) {
    const program = db.programs.find((x) => x.id === programId);
    if (!program) throw badRequest('That diploma could not be found.');
    faculty.diploma = program.name;
  }
  faculty.isHead = head;
  if (head && !facultyProgramId(faculty)) {
    throw badRequest('Choose the diploma this head trainer heads.');
  }
}

function assertPassword(password: string) {
  const problem = passwordProblem(password);
  if (problem) throw new ApiError(422, 'VALIDATION_FAILED', problem);
}

function assertEmail(email: string, exceptUserId: string | null) {
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Give a valid email address.');
  if (db.users.some((u) => u.id !== exceptUserId && u.email.trim().toLowerCase() === email)) {
    throw new ApiError(409, 'DUPLICATE', `${email} already has an account.`);
  }
}

/**
 * A trainer's account must know which classes are theirs, and classes are
 * assigned to faculty records. Use the record with the same email, or else
 * the only one with the same name, that no other account holds; failing
 * both, start a new record, so the Registrar can assign them classes.
 */
function facultyFor(firstName: string, lastName: string, email: string, position: string, exceptUserId: string | null): string {
  const taken = new Set(db.users.filter((u) => u.id !== exceptUserId && u.facultyId).map((u) => u.facultyId));
  const free = db.faculty.filter((f) => !taken.has(f.id));
  const byEmail = free.find((f) => f.email.trim().toLowerCase() === email);
  // A name only counts when it is unmistakable: the same name can belong to
  // trainers in two diplomas.
  const byName = free.filter(
    (f) => f.firstName.trim().toLowerCase() === firstName.toLowerCase() && f.lastName.trim().toLowerCase() === lastName.toLowerCase(),
  );
  const found = byEmail ?? (byName.length === 1 ? byName[0] : undefined);
  if (found) return found.id;
  const record = {
    id: nextId('fac'),
    employeeId: '',
    firstName,
    lastName,
    diploma: '',
    position: position || 'Trainer',
    isHead: false,
    email,
    contactNumber: '',
    isActive: true,
    createdAt: nowIso(),
  };
  db.faculty.push(record);
  return record.id;
}

/**
 * A new sign-in, with the first password the IT Administrator sets. The
 * person can change it themselves afterwards. A trainee account belongs to
 * a trainee already on file, found by their ID Number.
 */
export function createUserAccount(input: NewAccountInput): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const { role, head } = roleOf(input.role);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const position = input.position.trim();
  if (!firstName || !lastName) throw badRequest('First and last name are both required.');
  assertEmail(email, null);
  assertPassword(input.password);

  let studentId: string | null = null;
  let facultyId: string | null = null;
  if (role === 'TRAINEE') {
    const number = input.studentNumber.trim();
    if (!number) throw badRequest('Give the trainee\'s ID Number — it is what they sign in with.');
    const student = db.students.find((s) => s.studentNumber.toLowerCase() === number.toLowerCase());
    if (!student) {
      throw notFound(`No trainee has the ID Number ${number}. The Registrar adds trainees on the Students page first.`);
    }
    if (student.status === 'PENDING' || student.status === 'REJECTED') {
      throw badRequest(`${student.firstName} ${student.lastName}'s application has not been approved yet.`);
    }
    if (db.users.some((u) => u.studentId === student.id)) {
      throw new ApiError(409, 'DUPLICATE', `${student.firstName} ${student.lastName} (${number}) already has an account. Use Reset password instead.`);
    }
    studentId = student.id;
  } else if (role === 'TRAINER') {
    if (head && !input.programId) throw badRequest('Choose the diploma this head trainer heads.');
    facultyId = facultyFor(firstName, lastName, email, position, null);
    applyTrainerRecord(facultyId, head, input.programId);
  }

  const now = nowIso();
  const account: User = {
    id: nextId('usr'),
    email,
    password: input.password,
    mustChangePassword: false,
    firstName,
    lastName,
    title: '',
    position: position || choiceLabel(input.role),
    role,
    status: 'APPROVED',
    facultyId,
    studentId,
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
    after: { email, role },
    detail: `${choiceLabel(input.role)} account created for ${firstName} ${lastName} (${toAccountView(account, actor.id).signInId}).`,
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

/**
 * Changes an account's name, email, position or role. A trainee stays a
 * trainee and staff stay staff; the IT Administrator cannot change their
 * own role, nor leave the system without an active IT Administrator.
 */
export function updateUserAccount(userId: string, input: AccountEditInput): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const account = accountFor(userId);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const position = input.position.trim();
  if (!firstName || !lastName) throw badRequest('First and last name are both required.');
  assertEmail(email, account.id);

  const { role, head } = roleOf(input.role);
  const beforeChoice: AccountRoleChoice = account.role === 'TRAINER' && toAccountView(account, actor.id).isHead ? 'HEAD_TRAINER' : account.role;
  if (role !== account.role) {
    if (account.id === actor.id) throw badRequest('You cannot change your own role.');
    if (account.role === 'TRAINEE' || role === 'TRAINEE') {
      throw badRequest('Trainee accounts stay trainees, and staff stay staff.');
    }
    if (account.role === 'IT_ADMIN' && account.status === 'APPROVED' && activeCount('IT_ADMIN') <= 1) {
      throw badRequest('This is the only active IT Administrator; give someone else the role first.');
    }
  }
  if (role === 'TRAINER' && !account.facultyId) {
    account.facultyId = facultyFor(firstName, lastName, email, position, account.id);
  }
  if (role === 'TRAINER' && account.facultyId) {
    applyTrainerRecord(account.facultyId, head, input.programId);
  } else if (account.role === 'TRAINER' && account.facultyId) {
    // No longer a trainer: they no longer head a diploma either.
    const faculty = db.faculty.find((f) => f.id === account.facultyId);
    if (faculty) faculty.isHead = false;
  }

  const before = { firstName: account.firstName, lastName: account.lastName, email: account.email, position: account.position, role: account.role };
  const after = { firstName, lastName, email, position: position || account.position, role };
  Object.assign(account, after, { updatedAt: nowIso() });
  const roleChanged = beforeChoice !== input.role;
  recordAudit({
    action: roleChanged ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
    recordType: 'User',
    recordId: account.id,
    actor,
    before: { ...before, role: beforeChoice },
    after: { ...after, role: input.role },
    detail: roleChanged
      ? `${firstName} ${lastName}: ${choiceLabel(beforeChoice)} → ${choiceLabel(input.role)}.`
      : `${firstName} ${lastName}'s account details updated.`,
  });
  return toAccountView(account, actor.id);
}

/**
 * Sets a new password the IT Administrator chooses — for someone who has
 * forgotten theirs — and lifts a lockout. Never the IT Administrator's own:
 * they change theirs from their account menu.
 */
export function resetUserPassword(userId: string, password: string): UserAccountView {
  const actor = requireRole('IT_ADMIN');
  const account = accountFor(userId);
  if (account.id === actor.id) throw badRequest('Change your own password from your account menu instead.');
  if (account.status !== 'APPROVED') throw badRequest('Reactivate the account before resetting its password.');
  assertPassword(password);
  account.password = password;
  account.mustChangePassword = false;
  account.failedLoginAttempts = 0;
  account.lockedUntil = null;
  account.updatedAt = nowIso();
  recordAudit({
    action: 'USER_PASSWORD_RESET',
    recordType: 'User',
    recordId: account.id,
    actor,
    detail: `New password set for ${account.firstName} ${account.lastName} by the IT Administrator.`,
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
