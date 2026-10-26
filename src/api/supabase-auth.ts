/**
 * Sign-in and passwords through Supabase Auth (Phase 1 of the move to
 * Supabase).
 *
 * Supabase decides who someone is; the account's role, status and
 * must-change-password flag come from their own `users` row. The records
 * themselves still live in the browser until Phase 2, so once Supabase has
 * vouched for a person the local session is attached to the same user id.
 */

import type { PublicUser, Role, User } from '@/types';
import { ApiError, type ApiErrorCode } from '@/lib/api-error';
import { authEmailFor, supabase } from '@/lib/supabase';
import { serverApi } from '@/server/api';
import { request } from './client';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

interface AccountRow {
  id: string;
  role: Role;
  status: User['status'];
  must_change_password: boolean;
}

/** Reads the signed-in person's own account row and attaches the local session to it. */
async function adopt(signedIn: boolean): Promise<PublicUser> {
  const sb = client();
  const { data, error } = await sb
    .from('users')
    .select('id, role, status, must_change_password')
    .maybeSingle<AccountRow>();
  if (error || !data) {
    await sb.auth.signOut();
    throw new ApiError(403, 'FORBIDDEN', 'This sign-in has no RegiStream account.');
  }
  try {
    return await request(() =>
      serverApi.auth.adoptSession(
        data.id,
        { status: data.status, mustChangePassword: data.must_change_password },
        signedIn,
      ),
    );
  } catch (caught) {
    await sb.auth.signOut();
    throw caught;
  }
}

export async function signIn(identifier: string, password: string): Promise<PublicUser> {
  const { error } = await client().auth.signInWithPassword({
    email: authEmailFor(identifier),
    password,
  });
  if (error) {
    if (error.status === 429) {
      throw new ApiError(
        423,
        'ACCOUNT_LOCKED',
        'Too many sign-in attempts. Wait a few minutes, then try again.',
      );
    }
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email / ID Number or password.');
  }
  return adopt(true);
}

export async function restore(): Promise<PublicUser> {
  const { data } = await client().auth.getSession();
  if (!data.session) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session could not be restored.');
  }
  return adopt(false);
}

export async function signOut(): Promise<void> {
  await request(() => serverApi.auth.logout());
  await client().auth.signOut();
}

/** Calls the `accounts` Edge Function, surfacing its refusals as ApiError. */
async function accounts(body: Record<string, unknown>): Promise<void> {
  const { error } = await client().functions.invoke('accounts', { body });
  if (!error) return;
  const response = (error as { context?: Response }).context;
  const payload = await response?.json().catch(() => null);
  throw new ApiError(
    response?.status ?? 500,
    (payload?.code as ApiErrorCode) ?? 'BAD_REQUEST',
    payload?.message ?? 'The server returned an unexpected error.',
  );
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<PublicUser> {
  await accounts({ action: 'change-password', currentPassword, newPassword });
  return adopt(false);
}

export async function resetTraineePassword(userId: string): Promise<void> {
  await accounts({ action: 'reset-password', userId });
  await request(() => serverApi.accounts.resetTraineePassword(userId));
}

/**
 * Re-checks the signed-in person's password with Supabase before a
 * destructive action, then lets the local check accept it once.
 */
export async function confirmOwnPassword(password: string): Promise<void> {
  const sb = client();
  const { data } = await sb.auth.getUser();
  const email = data.user?.email;
  if (!email || !password) return; // the local check reports the missing password
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (!error) await request(() => serverApi.auth.markPasswordVerified(password));
}
