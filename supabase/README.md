# RegiStream on Supabase

Project: `https://keetvprldtxymkdvfngi.supabase.co` (Tokyo).

## Files

| File | What it is |
| --- | --- |
| `migrations/20261026000000_registream_schema.sql` | The 25 tables, keys and relationships, with Row Level Security on |
| `seed.sql` | The demo dataset in one file (for the Supabase CLI) |
| `seed-parts/seed-01.sql` … `seed-05.sql` | The same dataset in five parts, for the dashboard's SQL editor |
| `migrations/20261026010000_auth_access.sql` | Phase 1 grants: the service role works on every table; a signed-in person reads only their own `users` row |
| `functions/accounts/index.ts` | Edge Function for logins: provision, change password, IT Administrator reset |

Both are generated from the app's own seed: `npm run db:generate`. Do not edit them by hand.

## Setting up the database (once)

**With the dashboard:** SQL Editor → New query → paste the migration file → Run. Then paste and run
`seed-01.sql` to `seed-05.sql`, in order.

**With the CLI:** `supabase link --project-ref keetvprldtxymkdvfngi`, then `supabase db push`, then
`supabase db reset --linked` only if you want to wipe and reseed.

Re-seeding: run all five parts again in order; part 1 empties the tables first.

## Keys

- The **publishable (anon) key** goes in `.env.local` as `VITE_SUPABASE_PUBLISHABLE_KEY`. It is meant to be public.
- The **secret / service_role key** and the **database password** never go in this repository or in chat.
  They are set as secrets in the Supabase dashboard when Edge Functions need them.

Row Level Security is on for every table. Until the role policies arrive in Phase 2 the only one is
"read your own `users` row", so the public key alone reads nothing.

## Phase 1: sign-in through Supabase Auth

The app switches to Supabase sign-in when `.env.local` has both `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` (copy `.env.example`). Without them (the GitHub Pages build) it stays
on the in-browser demonstration exactly as before.

- **Staff** sign in with their email; **trainees** with their ID Number. Auth needs an email, so a
  trainee's login is `<ID Number>@trainee.registream.invalid`; the app adds that part itself.
- **Passwords live only in Supabase Auth.** The forced first-sign-in change and the IT Administrator's
  reset go through the `accounts` Edge Function, which checks the rules on the server.
- **Records are still in the browser** until Phase 2. Once Supabase has signed someone in, the app
  attaches to the same user id in its local records. A trainee approved in the app has no Supabase
  login until Phase 2 moves the records over.
- **Lockout** after repeated failures is Supabase's own sign-in rate limit, not the app's 5-try counter.

Creating the logins (done once, 2026-10-26): `node scripts/supabase/provision-accounts.mjs` gives the
30 demo users the same passwords as the in-app demo. It only works while no user has a login; after
that, only the IT Administrator may create logins.

Recommended in the dashboard: **Authentication → Sign In / Providers → turn off "Allow new users to
sign up"**. Logins are created by the system, never by self sign-up. A stray sign-up still gets no
RegiStream access, because it has no `users` row.
