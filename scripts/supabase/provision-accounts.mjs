/**
 * Creates the Supabase Auth logins for the demo users, with the same demo
 * passwords the app's seed gives them (so the login page's one-click demo
 * accounts keep working).
 *
 *   node scripts/supabase/provision-accounts.mjs
 *
 * On a fresh project it runs as the bootstrap (no user has a login yet).
 * After that it signs in as the seed's IT Administrator, so it can also add
 * logins for users added to the seed later. Users who already have a login
 * are left alone.
 */

import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = Object.fromEntries(
  ['.env.local', '.env.example']
    .flatMap((f) => { try { return readFileSync(resolve(root, f), 'utf8').split('\n'); } catch { return []; } })
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter((m) => m && m[2])
    .reverse()
    .map((m) => [m[1], m[2]]),
);
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const { createSeedDatabase } = await vite.ssrLoadModule('/src/server/data/seed.ts');
const db = createSeedDatabase();
await vite.close();

const provision = (token) =>
  fetch(`${url}/functions/v1/accounts`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({
      action: 'provision',
      accounts: db.users.map((u) => ({ userId: u.id, password: u.password })),
    }),
  });

let res = await provision(null);
if (res.status === 403) {
  // Not a fresh project: act as the seed's IT Administrator.
  const admin = db.users.find((u) => u.role === 'IT_ADMIN');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: admin.email, password: admin.password });
  if (error) throw new Error(`Could not sign in as the IT Administrator: ${error.message}`);
  res = await provision(data.session.access_token);
  await sb.auth.signOut();
}
const body = await res.json();
if (!res.ok) throw new Error(`${res.status} ${body.message}`);
for (const r of body.results) console.log(r.userId.padEnd(24), r.result);
