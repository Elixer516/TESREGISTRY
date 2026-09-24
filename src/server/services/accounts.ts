/**
 * Trainee sign-in accounts.
 *
 * A trainee does not register. The account is made for them the moment the
 * Registrar approves their application (or, failing that, when they are first
 * enrolled): they sign in with their ID Number and the default password, and
 * are made to replace it before the portal opens.
 *
 * The IT Administrator looks after these accounts — a trainee who forgets
 * their password, or locks themselves out, is reset back to the default and
 * made to choose a new one again. The IT Administrator never learns or sets
 * a trainee's own password; the reset only ever restores the default.
 */

import type { Student, User } from '@/types';
import type { TraineeAccountView } from '@/types/views';
import { ApiError, badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { recordAudit } from './audit';
import { requireRole } from '../auth';
import { DEFAULT_TRAINEE_PASSWORD } from '@/lib/passwords';

/**
 * Makes sure an approved trainee can sign in, creating their account if it
 * does not exist yet. Returns the account either way. Never touches an
 * existing account's password.
 */
export function ensureTraineeAccount(student: Student, actor: User | null): User {
  const existing = db.users.find((u) => u.studentId === student.id);
  if (existing) return existing;

  const now = nowIso();
  const account: User = {
    id: nextId('usr'),
    // Trainees sign in with their ID Number, not this. Kept so the account
    // still has a contact address on file.
    email: student.email.trim(),
    password: DEFAULT_TRAINEE_PASSWORD,
    mustChangePassword: true,
    firstName: student.firstName,
    lastName: student.lastName,
    title: '',
    position: '',
    role: 'TRAINEE',
    status: 'APPROVED',
    facultyId: null,
    studentId: student.id,
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
    detail: `Trainee account created for ${student.firstName} ${student.lastName}. Signs in with ID Number ${student.studentNumber} and the default password, which must be changed on first sign-in.`,
  });
  return account;
}

export function listTraineeAccounts(query = ''): TraineeAccountView[] {
  requireRole('IT_ADMIN');
  const needle = query.trim().toLowerCase();
  return db.users
    .filter((u) => u.role === 'TRAINEE')
    .map((u) => {
      const student = u.studentId ? db.students.find((s) => s.id === u.studentId) : undefined;
      const program = student ? db.programs.find((p) => p.id === student.programId) : undefined;
      const locked = Boolean(u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now());
      return {
        userId: u.id,
        idNumber: student?.studentNumber ?? '—',
        name: student ? `${student.lastName}, ${student.firstName}` : `${u.lastName}, ${u.firstName}`,
        programCode: program?.code ?? '—',
        mustChangePassword: u.mustChangePassword,
        locked,
        lastLoginAt: u.lastLoginAt,
      };
    })
    .filter(
      (row) =>
        !needle ||
        row.idNumber.toLowerCase().includes(needle) ||
        row.name.toLowerCase().includes(needle) ||
        row.programCode.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.idNumber.localeCompare(b.idNumber));
}

/**
 * Puts a trainee's password back to the default and makes them change it at
 * their next sign-in. Also lifts a lockout — being locked out is the usual
 * reason for asking.
 */
export function resetTraineePassword(userId: string): void {
  const actor = requireRole('IT_ADMIN');
  const account = db.users.find((u) => u.id === userId);
  if (!account) throw notFound('That account could not be found.');
  if (account.role !== 'TRAINEE') {
    throw new ApiError(403, 'FORBIDDEN', 'Only trainee passwords are reset here.');
  }
  if (account.status !== 'APPROVED') {
    throw badRequest('This account is not active, so there is nothing to reset.');
  }
  account.password = DEFAULT_TRAINEE_PASSWORD;
  account.mustChangePassword = true;
  account.failedLoginAttempts = 0;
  account.lockedUntil = null;
  account.updatedAt = nowIso();

  const student = account.studentId
    ? db.students.find((s) => s.id === account.studentId)
    : undefined;
  recordAudit({
    action: 'USER_PASSWORD_RESET',
    recordType: 'User',
    recordId: account.id,
    actor,
    detail: `Password reset to the default for ${
      student ? `${student.firstName} ${student.lastName} (${student.studentNumber})` : 'a trainee'
    }. They must choose a new one at their next sign-in.`,
  });
}
