/**
 * Session, role resolution and RBAC.
 *
 * Every service call resolves the actor through `requireSession` /
 * `requireRole` here. The UI hides controls a role cannot use, but that is a
 * courtesy — this file is what actually refuses the call.
 */

import type { PublicUser, Role, User } from '@/types';
import { ApiError, forbidden } from '@/lib/api-error';
import { clone, db, findById, nowIso } from './repositories/db';
import { recordAnonymousAudit, recordAudit } from './services/audit';
import { DEFAULT_TRAINEE_PASSWORD, MIN_PASSWORD_LENGTH } from '@/lib/passwords';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** The session token is just the user id — there is no real cryptography here. */
let currentUserId: string | null = null;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, ...rest } = user;
  return clone(rest);
}

export function currentUser(): User | null {
  if (!currentUserId) return null;
  return findById(db.users, currentUserId) ?? null;
}

export function requireSession(): User {
  const user = currentUser();
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  }
  // An account still on the default password can do one thing: change it.
  // Enforced here, where every other call passes, so no screen can skip it.
  if (user.mustChangePassword) {
    throw new ApiError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Change your password before continuing.',
    );
  }
  return user;
}

export function requireRole(...roles: Role[]): User {
  const user = requireSession();
  if (!roles.includes(user.role)) {
    throw forbidden(
      `Your role (${user.role}) is not permitted to perform this action.`,
    );
  }
  return user;
}

/** True when the actor may act on their own record, or holds one of the roles. */
export function requireSelfOrRole(subjectUserId: string, ...roles: Role[]): User {
  const user = requireSession();
  if (user.id === subjectUserId) return user;
  if (roles.includes(user.role)) return user;
  throw forbidden('You may only access your own records.');
}

function accountStatusError(user: User): ApiError | null {
  switch (user.status) {
    case 'PENDING':
      return new ApiError(
        403,
        'ACCOUNT_PENDING',
        'This account is still pending review by the Registrar. You will be able to sign in once it is approved.',
      );
    case 'REJECTED':
      return new ApiError(
        403,
        'ACCOUNT_REJECTED',
        'This account registration was rejected. Contact the Registrar if you believe this is an error.',
      );
    case 'SUSPENDED':
      return new ApiError(
        403,
        'ACCOUNT_SUSPENDED',
        'This account is suspended. Contact the Registrar to have it reinstated.',
      );
    case 'DEACTIVATED':
      return new ApiError(
        403,
        'ACCOUNT_DEACTIVATED',
        'This account has been deactivated and can no longer sign in.',
      );
    case 'APPROVED':
      return null;
    default:
      return null;
  }
}

function lockoutRemainingMinutes(user: User): number {
  if (!user.lockedUntil) return 0;
  const remainingMs = new Date(user.lockedUntil).getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 60000) : 0;
}

/**
 * Finds the account a sign-in identifier names. Staff sign in with their
 * email; a trainee signs in with their ID Number — the student number on
 * their record — and only that.
 */
function findAccount(identifier: string): User | undefined {
  const needle = identifier.trim().toLowerCase();
  if (!needle) return undefined;
  const student = db.students.find((s) => s.studentNumber.toLowerCase() === needle);
  if (student) {
    const account = db.users.find((u) => u.role === 'TRAINEE' && u.studentId === student.id);
    if (account) return account;
  }
  return db.users.find((u) => u.role !== 'TRAINEE' && u.email.toLowerCase() === needle);
}

export function login(email: string, password: string): PublicUser {
  const normalizedEmail = email.trim().toLowerCase();
  const user = findAccount(email);

  if (!user) {
    recordAnonymousAudit(
      'LOGIN_FAILED',
      'User',
      'unknown',
      normalizedEmail || '(blank)',
      'Sign-in attempted with an unrecognised email address or ID Number.',
    );
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email / ID Number or password.');
  }

  const remaining = lockoutRemainingMinutes(user);
  if (remaining > 0) {
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. This account is locked for another ${remaining} minute${remaining === 1 ? '' : 's'}.`,
    );
  }

  if (user.password !== password) {
    user.failedLoginAttempts += 1;
    user.updatedAt = nowIso();

    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
      user.failedLoginAttempts = 0;
      recordAnonymousAudit(
        'ACCOUNT_LOCKED',
        'User',
        user.id,
        normalizedEmail,
        `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed sign-in attempts.`,
      );
      throw new ApiError(
        423,
        'ACCOUNT_LOCKED',
        `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
      );
    }

    const left = MAX_FAILED_ATTEMPTS - user.failedLoginAttempts;
    recordAnonymousAudit(
      'LOGIN_FAILED',
      'User',
      user.id,
      normalizedEmail,
      `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} remaining before lockout.`,
    );
    throw new ApiError(
      401,
      'INVALID_CREDENTIALS',
      `Incorrect email / ID Number or password. ${left} attempt${left === 1 ? '' : 's'} remaining before this account is locked.`,
    );
  }

  const statusError = accountStatusError(user);
  if (statusError) {
    recordAnonymousAudit(
      'LOGIN_FAILED',
      'User',
      user.id,
      normalizedEmail,
      `Sign-in blocked — account status is ${user.status}.`,
    );
    throw statusError;
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = nowIso();
  user.updatedAt = nowIso();
  currentUserId = user.id;

  recordAudit({
    action: 'LOGIN_SUCCESS',
    recordType: 'User',
    recordId: user.id,
    actor: user,
    detail: 'Signed in.',
  });

  return toPublicUser(user);
}

export function logout(): void {
  const user = currentUser();
  if (user) {
    recordAudit({
      action: 'LOGOUT',
      recordType: 'User',
      recordId: user.id,
      actor: user,
      detail: 'Signed out.',
    });
  }
  currentUserId = null;
}

/**
 * Re-attach a session from a persisted token after a reload. The account is
 * re-checked — a suspension applied during the session ends it.
 */
export function restoreSession(token: string): PublicUser {
  const user = findById(db.users, token);
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session could not be restored.');
  }
  const statusError = accountStatusError(user);
  if (statusError) {
    currentUserId = null;
    throw statusError;
  }
  currentUserId = user.id;
  return toPublicUser(user);
}

/**
 * Re-authenticate the acting user. Used to gate the destructive operations
 * that must not be possible from an unattended workstation.
 */
export function verifyOwnPassword(password: string): User {
  const user = requireSession();
  if (!password) {
    throw new ApiError(400, 'PASSWORD_REQUIRED', 'Enter your password to confirm this action.');
  }
  if (user.password !== password) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'That password is incorrect.');
  }
  return user;
}

/** Test seam — lets the seeded session be cleared without a login round-trip. */
export function clearSession(): void {
  currentUserId = null;
}

/**
 * The signed-in person corrects their own name, title and position.
 *
 * Self-service because these are what print on signature lines, and the
 * person signing is the one who knows how their name should read. `role` is
 * deliberately not editable here: it decides what an account may do, and
 * nobody grants themselves access. Email stays fixed too — it is the login.
 */
export interface ProfileInput {
  firstName: string;
  lastName: string;
  title: string;
  position: string;
}

export function updateMyProfile(input: ProfileInput): PublicUser {
  const user = requireSession();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'First and last name are both required.');
  }
  const next = {
    firstName,
    lastName,
    title: input.title.trim(),
    position: input.position.trim(),
  };
  const before = {
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title,
    position: user.position,
  };
  Object.assign(user, next, { updatedAt: nowIso() });
  recordAudit({
    action: 'PROFILE_UPDATED',
    recordType: 'User',
    recordId: user.id,
    actor: user,
    before,
    after: next,
    detail: 'Updated their own name, title and position.',
  });
  return toPublicUser(user);
}

/**
 * The signed-in person replaces their password. The only call an account on
 * the default password may make, which is why it reads the session directly
 * rather than through `requireSession`.
 */
export function changeMyPassword(currentPassword: string, newPassword: string): PublicUser {
  const user = currentUser();
  if (!user) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  }
  if (user.password !== currentPassword) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(422, 'VALIDATION_FAILED', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (newPassword === currentPassword) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'The new password must be different from the current one.');
  }
  if (newPassword === DEFAULT_TRAINEE_PASSWORD) {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Choose a password other than the default.');
  }
  user.password = newPassword;
  user.mustChangePassword = false;
  user.updatedAt = nowIso();
  recordAudit({
    action: 'PASSWORD_CHANGED',
    recordType: 'User',
    recordId: user.id,
    actor: user,
    detail: 'Changed their own password.',
  });
  return toPublicUser(user);
}
