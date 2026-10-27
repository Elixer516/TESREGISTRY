/**
 * RegiStream account operations that need the service role, so they run here
 * and never in the browser.
 *
 *   POST { action: 'provision', accounts: [{ userId, password? }] }
 *     Creates the Supabase Auth login for each RegiStream user that has none.
 *     IT Administrator only, except the very first run on an empty project,
 *     which is how the first IT Administrator gets an account at all.
 *   POST { action: 'change-password', currentPassword, newPassword }
 *     The signed-in person replaces their own password (the forced change).
 *   POST { action: 'reset-password', userId }
 *     IT Administrator puts any account but their own back on the default password.
 *
 * Errors come back as { code, message } with the same codes the app's
 * ApiError uses, so the UI shows them unchanged.
 */

import { createClient, type User as AuthUser } from 'npm:@supabase/supabase-js@2.118.0';

const DEFAULT_TRAINEE_PASSWORD = 'user1234';
const MIN_PASSWORD_LENGTH = 8;
/** Trainees sign in with their ID Number; Auth needs an email, so it is derived from it. */
const TRAINEE_EMAIL_DOMAIN = 'trainee.registream.invalid';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class Refusal extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

interface AppUser {
  id: string;
  role: string;
  status: string;
  email: string;
  must_change_password: boolean;
  student_id: string | null;
  auth_user_id: string | null;
}

/** The signed-in caller, or null when the request carries no user session. */
async function caller(req: Request): Promise<{ auth: AuthUser; user: AppUser } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || token.split('.').length !== 3) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await admin.from('users').select('*').eq('auth_user_id', data.user.id).maybeSingle();
  if (!row) throw new Refusal(403, 'FORBIDDEN', 'This sign-in has no RegiStream account.');
  if (row.status !== 'APPROVED') throw new Refusal(403, 'FORBIDDEN', 'This account is not active.');
  return { auth: data.user, user: row as AppUser };
}

async function requireItAdmin(req: Request) {
  const who = await caller(req);
  if (!who) throw new Refusal(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  if (who.user.must_change_password) {
    throw new Refusal(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password before continuing.');
  }
  if (who.user.role !== 'IT_ADMIN') {
    throw new Refusal(403, 'FORBIDDEN', 'Only the IT Administrator may do this.');
  }
  return who;
}

async function authEmailFor(user: AppUser): Promise<string> {
  if (user.role !== 'TRAINEE') return user.email.trim().toLowerCase();
  const { data } = await admin.from('students').select('student_number').eq('id', user.student_id).maybeSingle();
  if (!data?.student_number) throw new Refusal(422, 'VALIDATION_FAILED', `Trainee ${user.id} has no ID Number.`);
  return `${String(data.student_number).trim().toLowerCase()}@${TRAINEE_EMAIL_DOMAIN}`;
}

async function provision(req: Request, body: { accounts?: Array<{ userId: string; password?: string }> }) {
  const who = await caller(req).catch(() => null);
  if (!who || who.user.role !== 'IT_ADMIN' || who.user.must_change_password) {
    // Bootstrap: allowed only while no RegiStream user has a login yet.
    const { count } = await admin.from('users').select('id', { count: 'exact', head: true }).not('auth_user_id', 'is', null);
    if ((count ?? 0) > 0) throw new Refusal(403, 'FORBIDDEN', 'Only the IT Administrator may create logins.');
  }
  const results: Array<{ userId: string; result: string }> = [];
  for (const { userId, password } of body.accounts ?? []) {
    const { data: row } = await admin.from('users').select('*').eq('id', userId).maybeSingle();
    if (!row) { results.push({ userId, result: 'no such user' }); continue; }
    if (row.auth_user_id) { results.push({ userId, result: 'already has a login' }); continue; }
    const initial = password ?? (row.role === 'TRAINEE' ? DEFAULT_TRAINEE_PASSWORD : '');
    if (initial.length < 6) { results.push({ userId, result: 'no usable initial password' }); continue; }
    const email = await authEmailFor(row as AppUser);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: initial,
      email_confirm: true,
      app_metadata: { app_user_id: row.id, role: row.role },
    });
    if (error || !data.user) { results.push({ userId, result: `failed: ${error?.message}` }); continue; }
    await admin.from('users').update({ auth_user_id: data.user.id }).eq('id', row.id);
    results.push({ userId, result: 'created' });
  }
  return { results };
}

async function changePassword(req: Request, body: { currentPassword?: string; newPassword?: string }) {
  const who = await caller(req);
  if (!who) throw new Refusal(401, 'UNAUTHENTICATED', 'Your session has ended. Please sign in again.');
  const current = body.currentPassword ?? '';
  const next = body.newPassword ?? '';
  // Re-check the current password with a throwaway client, so a left-open
  // session alone cannot change it.
  const probe = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: who.auth.email!, password: current });
  if (wrong) throw new Refusal(401, 'INVALID_CREDENTIALS', 'Your current password is incorrect.');
  if (next.length < MIN_PASSWORD_LENGTH) {
    throw new Refusal(422, 'VALIDATION_FAILED', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (next === current) {
    throw new Refusal(422, 'VALIDATION_FAILED', 'The new password must be different from the current one.');
  }
  if (next === DEFAULT_TRAINEE_PASSWORD) {
    throw new Refusal(422, 'VALIDATION_FAILED', 'Choose a password other than the default.');
  }
  const { error } = await admin.auth.admin.updateUserById(who.auth.id, { password: next });
  if (error) throw new Refusal(422, 'VALIDATION_FAILED', error.message);
  await admin
    .from('users')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', who.user.id);
  await admin.rpc('registream_bump');
  return { ok: true };
}

async function resetPassword(req: Request, body: { userId?: string }) {
  const who = await requireItAdmin(req);
  const { data: row } = await admin.from('users').select('*').eq('id', body.userId ?? '').maybeSingle();
  if (!row) throw new Refusal(404, 'NOT_FOUND', 'That account could not be found.');
  if (row.id === who.user.id) {
    throw new Refusal(400, 'BAD_REQUEST', 'Change your own password from your account instead.');
  }
  if (row.status !== 'APPROVED') {
    throw new Refusal(400, 'BAD_REQUEST', 'Reactivate the account before resetting its password.');
  }
  if (!row.auth_user_id) throw new Refusal(400, 'BAD_REQUEST', 'This account has no login yet.');
  const { error } = await admin.auth.admin.updateUserById(row.auth_user_id, { password: DEFAULT_TRAINEE_PASSWORD });
  if (error) throw new Refusal(500, 'BAD_REQUEST', error.message);
  await admin
    .from('users')
    .update({ must_change_password: true, failed_login_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  await admin.rpc('registream_bump');
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { code: 'BAD_REQUEST', message: 'POST only.' });
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case 'provision':
        return json(200, await provision(req, body));
      case 'change-password':
        return json(200, await changePassword(req, body));
      case 'reset-password':
        return json(200, await resetPassword(req, body));
      default:
        return json(400, { code: 'BAD_REQUEST', message: 'Unknown action.' });
    }
  } catch (e) {
    if (e instanceof Refusal) return json(e.status, { code: e.code, message: e.message });
    console.error(e);
    return json(500, { code: 'BAD_REQUEST', message: 'The server returned an unexpected error.' });
  }
});
