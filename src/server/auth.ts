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

export function login(email: string, password: string): PublicUser {
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    recordAnonymousAudit(
      'LOGIN_FAILED',
      'User',
      'unknown',
      normalizedEmail || '(blank)',
      'Sign-in attempted with an unrecognised email address.',
    );
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.');
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
        user.email,
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
      user.email,
      `Incorrect password. ${left} attempt${left === 1 ? '' : 's'} remaining before lockout.`,
    );
    throw new ApiError(
      401,
      'INVALID_CREDENTIALS',
      `Incorrect email or password. ${left} attempt${left === 1 ? '' : 's'} remaining before this account is locked.`,
    );
  }

  const statusError = accountStatusError(user);
  if (statusError) {
    recordAnonymousAudit(
      'LOGIN_FAILED',
      'User',
      user.id,
      user.email,
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
