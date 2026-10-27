/**
 * Offline check of the `api` Edge Function's pipeline: the real schema and
 * seed in PGlite, snapshot → src/server/edge.ts → registream_apply, for a
 * sweep of read operations and a few writes.
 *
 *   node scripts/supabase/test-edge.mjs <path to @electric-sql/pglite>
 */
import { createServer } from 'vite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const pg = new PGlite();
await pg.exec(`create schema auth; create table auth.users (id uuid primary key); create role anon; create role authenticated; create role service_role; create function auth.uid() returns uuid language sql as 'select null::uuid';`);
for (const f of readdirSync(resolve(root, 'supabase/migrations')).sort()) await pg.exec(readFileSync(resolve(root, 'supabase/migrations', f), 'utf8'));
for (const f of readdirSync(resolve(root, 'supabase/seed-parts')).sort()) await pg.exec(readFileSync(resolve(root, 'supabase/seed-parts', f), 'utf8'));

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const edge = await vite.ssrLoadModule('/src/server/edge.ts');

async function call(userId, op, args = [], verified = null) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const snap = (await pg.query('select registream_snapshot() s')).rows[0].s;
    const database = edge.fromTables(snap.tables);
    const user = database.users.find((u) => u.id === userId);
    const caller = user ? { userId, status: user.status, mustChangePassword: user.mustChangePassword } : null;
    const out = edge.execute(database, caller, op, args, verified);
    if (!out.ok) return { error: out.error };
    if (out.changed) {
      try {
        await pg.query('select registream_apply($1, $2::jsonb)', [snap.revision, JSON.stringify(edge.toTableChanges(out.changes))]);
      } catch (e) {
        if (String(e.message).includes('stale')) continue;
        return { writeError: e.message, changes: edge.toTableChanges(out.changes).map((c) => `${c.table}+${c.upsert.length}-${c.delete.length}`) };
      }
    }
    return { result: out.result, changed: out.changed };
  }
}

let failures = 0;
const check = (label, r, ok = (x) => !x.error && !x.writeError) => {
  const pass = ok(r);
  if (!pass) failures += 1;
  console.log(pass ? 'ok  ' : 'FAIL', label, pass ? '' : JSON.stringify(r).slice(0, 300));
  return r;
};

// Every no-argument read, as each role.
const { serverApi } = await vite.ssrLoadModule('/src/server/api.ts');
const roles = { REGISTRAR: 'usr-registrar', IT_ADMIN: 'usr-itadmin', TRAINER: 'usr-trainer-dit', TRAINEE: 'usr-trainee' };
for (const [role, id] of Object.entries(roles)) {
  let ran = 0, errs = [];
  for (const [ns, group] of Object.entries(serverApi)) {
    if (ns === 'auth' || ns === 'demo') continue;
    for (const [name, fn] of Object.entries(group)) {
      if (typeof fn !== 'function' || fn.length > 0) continue;
      if (/^(create|update|delete|remove|submit|approve|reject|set|record|add|reset|mark|open|close|confirm|import|generate|drop|enroll|resolve|credit|request|cancel|release|reinstate|archive|restore|assign|unassign|map|unmap|plan|clear|sign|view|save|process|evaluate|return|accept|move|publish|toggle)/i.test(name)) continue;
      const r = await call(id, `${ns}.${name}`);
      ran += 1;
      if (r.writeError || (r.error && r.error.status >= 500)) errs.push(`${ns}.${name}: ${JSON.stringify(r).slice(0, 200)}`);
    }
  }
  check(`${role}: ${ran} reads, no server errors`, { errs }, (x) => x.errs.length === 0);
  errs.forEach((e) => console.log('     ', e));
}

check('anonymous cannot list students', await call(null, 'students.list'), (r) => r.error?.status === 401);
check('auth.* is unreachable', await call('usr-registrar', 'auth.login', ['registrar@rtc-korphil.example.ph', undefined]), (r) => r.error?.code === 'BAD_REQUEST');
check('demo reset needs the confirmed password', await call('usr-registrar', 'demo.reset', ['RESET DEMO', 'x']), (r) => r.error?.status === 401);
check('trainee cannot list students', await call('usr-trainee', 'students.list'), (r) => r.error?.status === 403);
check('session.me', await call('usr-registrar', 'session.me', [true]), (r) => r.result?.id === 'usr-registrar');

const list = check('students.list', await call('usr-registrar', 'students.list'));
const rows = list.result?.items ?? list.result ?? [];
const pending = rows.find((s) => s.status === 'PENDING');
if (pending) {
  const curricula = (await call('usr-registrar', 'catalog.listCurricula', [pending.programId])).result;
  const r = check(`approve pending ${pending.studentNumber}`, await call('usr-registrar', 'students.approve', [pending.id, curricula[0].id, null]));
  const users = (await pg.query(`select id, role, must_change_password from users where student_id=$1`, [pending.id])).rows;
  check('approval created the trainee account in the database', { users }, (x) => x.users.length === 1 && x.users[0].must_change_password === true);
} else console.log('skip: no pending student in seed');

const before = (await pg.query('select count(*)::int n from audit_logs')).rows[0].n;
const s = rows.find((x) => x.status !== 'PENDING');
const upd = await call('usr-registrar', 'students.get', [s.id]);
check('students.get', upd);
const after = (await pg.query('select count(*)::int n from audit_logs')).rows[0].n;
console.log('     audit rows', before, '->', after, ' revision', (await pg.query('select revision from registream_meta')).rows[0].revision);

// User management (IT Administrator).
check('registrar cannot manage users', await call('usr-registrar', 'users.list'), (r) => r.error?.status === 403);
check('IT admin reads the audit log', await call('usr-itadmin', 'audit.logs'));
const acct = (over) => ({ role: 'REGISTRAR', firstName: 'New', lastName: 'Staff', email: 'new.staff@rtc-korphil.example.ph', studentNumber: '', password: 'Regi$tream1', position: 'Clerk', ...over });
check('weak password refused', await call('usr-itadmin', 'users.create', [acct({ password: 'password1' })]), (r) => r.error?.code === 'VALIDATION_FAILED');
check('17-character password refused', await call('usr-itadmin', 'users.create', [acct({ password: 'Abcdefghijk1234!x' })]), (r) => r.error?.code === 'VALIDATION_FAILED');
const made = check('IT admin creates a registrar account', await call('usr-itadmin', 'users.create', [acct({})]), (r) => r.result?.role === 'REGISTRAR' && r.result?.mustChangePassword === false);
check('duplicate email refused', await call('usr-itadmin', 'users.create', [acct({ firstName: 'A' })]), (r) => r.error?.code === 'DUPLICATE');
const trainer = check('trainer account links to the faculty record by email', await call('usr-itadmin', 'users.create', [acct({ role: 'TRAINER', firstName: 'Cely', lastName: 'Padilla', email: 'cpadilla1021@rtc-korphil.example.ph' })]));
check('…and their classes are theirs', (await pg.query(`select f.id from users u join faculty f on f.id = u.faculty_id where u.id = $1`, [trainer.result?.userId])).rows[0], (row) => row?.id === 'fac-dat-y2-0');
check('a name shared by two trainers is not guessed', await call('usr-itadmin', 'users.create', [acct({ role: 'TRAINER', firstName: 'Cely', lastName: 'Padilla', email: 'other.cely@rtc-korphil.example.ph' })]), (r) => r.result?.role === 'TRAINER');
check('…a new faculty record instead', (await pg.query(`select f.employee_id from users u join faculty f on f.id = u.faculty_id where u.email = 'other.cely@rtc-korphil.example.ph'`)).rows[0], (row) => row?.employee_id === '');
check('brand-new trainer gets a new faculty record', await call('usr-itadmin', 'users.create', [acct({ role: 'TRAINER', firstName: 'Brand', lastName: 'Newtrainer', email: 'brand.new@rtc-korphil.example.ph' })]), (r) => r.result?.role === 'TRAINER');
check('trainee needs an ID Number on file', await call('usr-itadmin', 'users.create', [acct({ role: 'TRAINEE', studentNumber: '2099-99999', email: 't@x.ph' })]), (r) => r.error?.status === 404);
check('trainee who already has an account refused', await call('usr-itadmin', 'users.create', [acct({ role: 'TRAINEE', studentNumber: '2026-00004', email: 't2@x.ph' })]), (r) => r.error?.code === 'DUPLICATE');
const newId = made.result?.userId;
check('deactivate', await call('usr-itadmin', 'users.setActive', [newId, false]), (r) => r.result?.status === 'DEACTIVATED');
check('reactivate', await call('usr-itadmin', 'users.setActive', [newId, true]), (r) => r.result?.status === 'APPROVED');
check('edit: role and position', await call('usr-itadmin', 'users.update', [newId, { role: 'IT_ADMIN', firstName: 'New', lastName: 'Staff', email: 'new.staff@rtc-korphil.example.ph', position: 'IT Assistant' }]), (r) => r.result?.role === 'IT_ADMIN' && r.result?.position === 'IT Assistant');
check('cannot deactivate yourself', await call('usr-itadmin', 'users.setActive', ['usr-itadmin', false]), (r) => r.error?.status === 400);
check('trainee stays trainee', await call('usr-itadmin', 'users.update', ['usr-trainee', { role: 'REGISTRAR', firstName: 'Kevin', lastName: 'Rivera', email: 'k@x.ph', position: '' }]), (r) => r.error?.status === 400);
check('reset with a weak password refused', await call('usr-itadmin', 'users.resetPassword', ['usr-trainer-dit', 'abc']), (r) => r.error?.code === 'VALIDATION_FAILED');
check('reset with a good password', await call('usr-itadmin', 'users.resetPassword', ['usr-trainer-dit', 'N3w#Passw0rd']), (r) => r.result?.mustChangePassword === false);

// Reset after the writes above: everything back to the seed.
const reset = check('demo reset restores the seed', await call('usr-registrar', 'demo.reset', ['RESET DEMO', 'pw'], 'pw'));
const counts = (await pg.query(`select (select count(*)::int from students) s, (select count(*)::int from users) u, (select status from students where student_number = '2026-00104') applicant`)).rows[0];
check('after reset: 19 students, 33 users, applicant pending again', counts, (c) => c.s === 19 && c.u === 33 && c.applicant === 'PENDING');

await vite.close();
console.log(failures ? `${failures} FAILED` : 'all passed');
process.exit(failures ? 1 : 0);
