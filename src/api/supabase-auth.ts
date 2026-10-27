/**
 * Sign-in and passwords through Supabase Auth.
 *
 * Supabase decides who someone is. Their account — role, status, the
 * must-change-password flag — is read by the `api` Edge Function from the
 * database, which also enforces every rule on every later call; this tab
 * holds nothing but the Supabase session.
 */

import type { PublicUser } from '@/types';
import type { UserAccountView } from '@/types/views';
import { ApiError, type ApiErrorCode } from '@/lib/api-error';
import { authEmailFor, supabase } from '@/lib/supabase';
import type { ProfileInput } from '@/server/auth';
import { invokeRemote } from './remote';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

/** The signed-in person's account, as the server sees it. Signs out if they have none or may not use it. */
async function adopt(signedIn: boolean): Promise<PublicUser> {
  try {
    return await invokeRemote<PublicUser>('session.me', [signedIn]);
  } catch (caught) {
    await client().auth.signOut();
    throw caught;
  }
}

export const me = () => adopt(false);

export async function signIn(identifier: string, password: string): Promise<PublicUser> {
  const { error } = await client().auth.signInWithPassword({
    email: authEmailFor(identifier),
    password,
  });
  if (error) {
    // No answer at all (offline, or the connection dropped): not a wrong password.
    if (!error.status || error.name === 'AuthRetryableFetchError') {
      throw new ApiError(
        503,
        'BAD_REQUEST',
        'The server could not be reached. Check the internet connection and try again.',
      );
    }
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
  await invokeRemote('session.logout', []).catch(() => undefined);
  await client().auth.signOut();
}

export const updateMyProfile = (input: ProfileInput) =>
  invokeRemote<PublicUser>('session.updateMyProfile', [input]);

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
  const { data } = await client().auth.getUser();
  await accounts({ action: 'change-password', currentPassword, newPassword });
  // Supabase ends every session of an account whose password changes, this
  // one included; carry straight on with the new password.
  const email = data.user?.email;
  if (email) await client().auth.signInWithPassword({ email, password: newPassword });
  return adopt(false);
}

/** Any account's login back to the default (IT Administrator); the records follow through `api`. */
export async function resetUserPassword(userId: string): Promise<UserAccountView> {
  await accounts({ action: 'reset-password', userId });
  return invokeRemote<UserAccountView>('users.resetPassword', [userId]);
}

/** The login goes back to the default; the records and audit trail follow through `api`. */
export async function resetTraineePassword(userId: string): Promise<void> {
  await accounts({ action: 'reset-password', userId });
  await invokeRemote('accounts.resetTraineePassword', [userId]);
}
