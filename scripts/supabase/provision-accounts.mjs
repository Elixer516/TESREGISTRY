/**
 * Creates the Supabase Auth logins for the demo users, with the same demo
 * passwords the app's seed gives them (so the login page's one-click demo
 * accounts keep working).
 *
 *   node scripts/supabase/provision-accounts.mjs
 *
 * Only works on a project where no user has a login yet; after that, new
 * logins are created by the IT Administrator.
 */

import { createServer } from 'vite';
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

const res = await fetch(`${url}/functions/v1/accounts`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'provision',
    accounts: db.users.map((u) => ({ userId: u.id, password: u.password })),
  }),
});
const body = await res.json();
if (!res.ok) throw new Error(`${res.status} ${body.message}`);
for (const r of body.results) console.log(r.userId.padEnd(24), r.result);
