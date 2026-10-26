# RegiStream on Supabase

Project: `https://keetvprldtxymkdvfngi.supabase.co` (Tokyo).

## Files

| File | What it is |
| --- | --- |
| `migrations/20261026000000_registream_schema.sql` | The 25 tables, keys and relationships, with Row Level Security on |
| `seed.sql` | The demo dataset in one file (for the Supabase CLI) |
| `seed-parts/seed-01.sql` … `seed-05.sql` | The same dataset in five parts, for the dashboard's SQL editor |

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

Row Level Security is on with no policies yet, so the public key can read nothing until the role
policies arrive in Phase 2. Passwords are not stored in these tables; Supabase Auth holds them (Phase 1).
