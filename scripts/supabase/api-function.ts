/**
 * Source of the `api` Edge Function (Phase 2). Bundled, together with the
 * app's whole server, into supabase/functions/api/index.js by
 * `npm run db:build-api` — edit this, never the bundle.
 *
 *   POST { op: 'students.list', args: [...] }  →  { result } | { error }
 *
 * Who is calling comes from the Supabase Auth session on the request, never
 * from the body. The operation itself, and every rule it enforces, is the
 * same code the in-browser demo runs (src/server, through src/server/edge.ts).
 */

import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { execute, fromTables, PASSWORD_ARGUMENT, toTableChanges, type Caller } from '../../src/server/edge';
import { createSeedDatabase } from '../../src/server/data/seed';

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };

const DEFAULT_TRAINEE_PASSWORD = 'user1234';
/** Must match src/lib/supabase.ts and the `accounts` function. */
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
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const refuse = (status: number, code: string, message: string) => json(status, { error: { status, code, message } });

/**
 * After a demo reset: every demonstration account signs in with the password
 * the sign-in page shows again. The person who ran the reset keeps theirs —
 * changing it would end the very session they are working in.
 */
async function restoreDemoPasswords(callerId: string) {
  const { data: rows } = await admin.from('users').select('id, auth_user_id');
  const authIdOf = new Map((rows ?? []).map((r) => [r.id as string, r.auth_user_id as string | null]));
  for (const user of createSeedDatabase().users) {
    const authId = authIdOf.get(user.id);
    if (!authId || user.id === callerId) continue;
    const { error } = await admin.auth.admin.updateUserById(authId, { password: user.password });
    if (error) console.error('Could not restore the demo password of', user.id, error.message);
  }
}

/** The signed-in caller, or null for an anonymous request (the public application form). */
async function callerOf(req: Request): Promise<{ caller: Caller; email: string } | Response | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (token.split('.').length !== 3) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: row } = await admin
    .from('users')
    .select('id, status, must_change_password')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();
  if (!row) return refuse(403, 'FORBIDDEN', 'This sign-in has no RegiStream account.');
  return {
    caller: { userId: row.id, status: row.status, mustChangePassword: row.must_change_password },
    email: data.user.email ?? '',
  };
}

async function passwordIsCorrect(email: string, password: unknown): Promise<boolean> {
  if (typeof password !== 'string' || !password || !email) return false;
  const probe = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  return !error;
}

/**
 * Gives every account the operation just created a Supabase login on the
 * default password, so they can sign in at once: a trainee's on approval,
 * a staff member's when the IT Administrator creates it.
 */
async function provisionNewUsers(
  before: Set<string>,
  users: Array<Record<string, unknown>>,
  students: Array<Record<string, unknown>>,
  /** The first password the IT Administrator set, when they made the account. */
  initialPassword: string | null,
) {
  for (const user of users) {
    if (before.has(user.id as string)) continue;
    let email: string;
    if (user.role === 'TRAINEE') {
      const student = students.find((s) => s.id === user.studentId);
      if (!student?.studentNumber) continue;
      email = `${String(student.studentNumber).trim().toLowerCase()}@${TRAINEE_EMAIL_DOMAIN}`;
    } else {
      // Staff created by the IT Administrator sign in with their email.
      email = String(user.email ?? '').trim().toLowerCase();
      if (!email) continue;
    }
    let authId: string | undefined;
    const password = initialPassword ?? DEFAULT_TRAINEE_PASSWORD;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { app_user_id: user.id, role: user.role },
    });
    authId = created.data.user?.id;
    if (!authId) {
      // A login left over from an earlier account (a demo reset, say): reuse it.
      for (let page = 1; !authId && page <= 20; page += 1) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        authId = data.users.find((u) => u.email === email)?.id;
        if (data.users.length < 200) break;
      }
      if (!authId) {
        console.error('Could not provision', user.id, created.error?.message);
        continue;
      }
      await admin.auth.admin.updateUserById(authId, { password });
    }
    await admin.from('users').update({ auth_user_id: null }).eq('auth_user_id', authId);
    await admin.from('users').update({ auth_user_id: authId }).eq('id', user.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return refuse(405, 'BAD_REQUEST', 'POST only.');

  const body = await req.json().catch(() => null);
  const op = typeof body?.op === 'string' ? body.op : '';
  const args: unknown[] = Array.isArray(body?.args) ? body.args : [];
  // Arguments the caller left out arrive as null; put back `undefined` so
  // parameter defaults apply, as they do in the browser build.
  for (const i of Array.isArray(body?.missing) ? body.missing : []) {
    if (Number.isInteger(i) && i >= 0 && i < args.length) args[i] = undefined;
  }
  if (!op) return refuse(400, 'BAD_REQUEST', 'Unknown operation.');

  const who = await callerOf(req);
  if (who instanceof Response) return who;
  const caller = who?.caller ?? null;
  // A suspended or deactivated account's session ends here; `session.me`
  // reports the precise reason itself.
  if (caller && caller.status !== 'APPROVED' && op !== 'session.me') {
    return refuse(403, 'FORBIDDEN', 'This account is not active.');
  }

  let verifiedPassword: string | null = null;
  const passwordAt = PASSWORD_ARGUMENT[op];
  if (who && passwordAt !== undefined && (await passwordIsCorrect(who.email, args[passwordAt]))) {
    verifiedPassword = args[passwordAt] as string;
  }

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const { data: snapshot, error } = await admin.rpc('registream_snapshot');
    if (error) {
      console.error(error);
      return refuse(503, 'BAD_REQUEST', 'The database is not reachable right now. Try again.');
    }
    const database = fromTables(snapshot.tables);
    const userIdsBefore = new Set(database.users.map((u) => u.id));
    const outcome = execute(database, caller, op, args, verifiedPassword);
    if (!outcome.ok) return json(outcome.error.status, { error: outcome.error });
    if (!outcome.changed) {
      if (op === 'demo.reset' && caller) await restoreDemoPasswords(caller.userId);
      return json(200, { result: outcome.result });
    }

    const write = await admin.rpc('registream_apply', {
      expected: snapshot.revision,
      changes: toTableChanges(outcome.changes),
    });
    if (write.error) {
      if (write.error.code === '40001') continue; // someone saved first; run again on fresh data
      console.error(write.error);
      return refuse(500, 'BAD_REQUEST', 'The change could not be saved. Try again.');
    }
    const users = (outcome.changes.upsert.users ?? []) as Array<Record<string, unknown>>;
    if (users.some((u) => !userIdsBefore.has(u.id as string))) {
      const students = [...(outcome.changes.upsert.students ?? []), ...database.students];
      const initial = op === 'users.create' ? String((args[0] as { password?: string } | undefined)?.password ?? '') || null : null;
      await provisionNewUsers(userIdsBefore, users, students as Array<Record<string, unknown>>, initial);
    }
    if (op === 'demo.reset' && caller) await restoreDemoPasswords(caller.userId);
    return json(200, { result: outcome.result });
  }
  return refuse(409, 'CONFLICT', 'Others are saving at the same moment. Try again.');
});
