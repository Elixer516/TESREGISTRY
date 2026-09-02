# RegiStream — Project Context

Paste this file at the start of a session to pick the project up cold.
It is the *why*, not the *what* — the code says what it does; this says
what must stay true and which decisions were deliberate.

---

## 1. What this is

**RegiStream** — a Student Records & Registrar System for **TESDA Regional
Training Center KorPhil Davao**. Built as an academic capstone prototype for
a defense demonstration, not (yet) for real operations.

- **Live:** https://elixer516.github.io/TESREGISTRY/
- **Repo:** `Elixer516/TESREGISTRY` (branch `master`, auto-deploys on push)
- **Stack:** React 19 · TypeScript strict · Vite · Tailwind v4 ·
  TanStack Query v5 · react-router-dom v7 (**HashRouter**)
- **Size:** ~118 `.ts`/`.tsx` files · 16 services · 48 pages

### The one path the system exists to model

```
applicant applies  →  Pending  →  registrar approves (assigns curriculum)
   →  enrolled in subjects  →  trainer submits grading sheet
   →  registrar approves sheet (this is what posts grades)
   →  Grade Evaluation Form  →  Sequential Enrollment into the next semester
```

V9 deliberately deleted six modules (Notifications, Academic Records,
Documents, Transcript Upload, User Accounts, GSA bulk-send) to narrow the
app to exactly this path. **Do not re-add breadth without being asked.**

---

## 2. Architecture — the one thing to understand first

**There is no backend and no database.** A complete simulated server runs in
the browser.

```
src/pages/*        React screens — never touch the store directly
      ↓
src/api/index.ts   typed client; every call wrapped in request()
      ↓            (adds 120ms simulated latency + persist())
src/server/api.ts  the server's only public surface
      ↓
src/server/services/*.ts   business rules, RBAC, validation, audit
      ↓
src/server/repositories/db.ts   the `db` singleton object graph
      ↓
localStorage  ("registream.db")
```

`src/server/` is **synchronous and pure**. The async shape belongs to the
client, exactly as it would with real HTTP. This seam is deliberate: a real
database slots in behind `src/api/` **without rewriting a single screen.**

### Consequences you must not forget

- Data is **per-browser**. Two laptops never see each other's records.
  Netlify/GitHub Pages are static hosts — changing host changes nothing here.
- `CrossTabSync.tsx` syncs **tabs in the same browser** via the native
  `storage` event. It cannot and will not reach another device.
- Reloading is safe: state persists to `localStorage`.

---

## 3. Invariants — break these and the system is wrong

1. **Grades reach a trainee's record only when a sheet is APPROVED.**
   Submitting posts nothing. This is the rule everything else rests on.
2. **Validate everything before writing anything.** No service half-applies.
3. **RBAC is enforced server-side** via `requireRole()`. Hiding a button is a
   courtesy to the reader, never the control.
4. **Every mutation calls `recordAudit()`.** Action names live in
   `AUDIT_ACTIONS` (`src/types/index.ts`); `AuditAction` is
   `keyof typeof AUDIT_ACTIONS`, so an unlisted string will not typecheck.
5. **Units are copied onto the enrollment at enrollment time** and never
   re-read from the Subject afterwards.
6. **One enrollment per trainee per semester.**
7. **One open semester per (diploma, year level)** — `setSemesterActive`
   closes the others. This constraint shapes the demo data (see §6).

### Terminology (user-facing, enforced since V9)

| Say | Never say |
|---|---|
| **Diploma** (the programme) | "Course" |
| **Subject** (what is taught) | |
| **Trainee** / **Trainer** | "Student"/"Teacher" in new UI copy |
| **Sequential Enrollment** | (for moving to the next semester in sequence) |

Internal variables still use `program`/`student`/`course` in places. **Do not
rename internals to chase the vocabulary** — it breaks things for no gain.

---

## 4. Grading rules — single source of truth

`src/server/services/grade-rules.ts`. Pure functions, no store access.

- Scale **1.00 (highest) … 5.00 (lowest)**. **3.00 is the passing cutoff**
  (the 75% equivalent). `INC` is a valid grade.
- **There is no percentage layer.** V9 removed it. Trainers type `1.50`, not
  `88`. Nothing converts.
- `effectiveGrade()` — a resolved INC contributes its *completion* grade.
- `computeGwa()` — an unresolved INC forces GWA to `0.000`. That is a
  deliberate signal, not a bug.

| Grade | Status | Satisfies prerequisite? |
|---|---|---|
| 1.00 – 3.00 | Passed | **yes** |
| 4.00, 5.00 | Failed | no |
| INC (unresolved) | Incomplete | **no** |
| INC → completion ≤ 3.00 | Resolved | **yes** |
| null (ungraded) | Not yet graded | no |

**Always reuse `isPassing` / `effectiveGrade`.** Never restate the cutoff —
that is how the transcript, the GWA, the evaluation form and the prerequisite
check stay in agreement by construction rather than by luck.

---

## 5. Domain model (key entities only)

- `Program` (Diploma) → `Curriculum` → `ProgramSubject` (maps `Subject` into a
  curriculum at a year level + semester period)
  - `ProgramSubject.prerequisiteSubjectIds` — **enforced at enrollment**
  - `.prerequisiteStanding` — year-level rule (e.g. 2nd year standing)
  - `.prerequisiteNote` — original wording, printed verbatim on the GEF
- `Semester` belongs to **(programId, yearLevel, semesterPeriod)** — *not* a
  global calendar. Several are open at once, one per diploma+year.
- `Student` → `Enrollment` (per semester) → `EnrollmentSubject` (per subject,
  carries `units`, `finalGrade`, `completionGrade`, `gradeStatus`, `enrolledAt`)
- `ClassSchedule` — a subject taught to a section by a faculty member in a
  semester. `GradingSheet` hangs off one of these.
- `GradingSheet` — statuses `DRAFT → SUBMITTED → APPROVED`, or `→ PENDING`
  (sent back to trainer). A sheet with no DB row is a synthetic
  `draft-<classScheduleId>`.

---

## 6. The demonstration dataset (V9.2)

Deliberately small and controlled: **7 trainees**, not 84. Rebuilt by
`createSeedDatabase()` in `src/server/data/seed.ts`.

**Two scenarios in two different diplomas** — because one open semester per
(diploma, year level) means they cannot share one:

| | Diploma | Y1 1st Sem | Y1 2nd Sem |
|---|---|---|---|
| **Demo 1 — Freshman** | Information Technology | **OPEN** | closed |
| **Demo 2 — Sequential** | Automotive Technology | closed, graded | **OPEN** |

- **IT:** Andrea Ocampo, Bryan Marquez, Chloe Solis — sitting in the open 1st
  semester, ungraded, so a new applicant joins a real class.
- **AUTO:** **Kevin Rivera** (the clean sequential candidate), Lorna Antonio,
  Miguel Pascual, and **Nadine Enriquez** — who carries an **unresolved INC on
  purpose**, so the gate can be shown *refusing* someone as well as permitting.
- **Zero pending applications**, so a live submission is unmistakable.

**Reset demonstration data** (Dashboard → Quick actions) rebuilds from the
seed. It restores rather than deletes — the seed *is* the controlled dataset,
so config survives automatically and there is no deletion logic to get wrong.
Guarded by typing `RESET DEMO` + password. Keeps you signed in.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Registrar (Maria Santos) | `registrar@rtc-korphil.example.ph` | `registrar123` |
| Trainer (per diploma) | `auto.trainer@…`, `it.trainer@…`, etc. | `trainer123` |
| Trainee (Kevin Rivera) | `trainee@rtc-korphil.example.ph` | `trainee123` |

The login page lists them all and fills the form on click.

---

## 7. Hard-won fixes — do not regress these

Each of these was a real bug that cost time. The *reason* matters more than
the fix.

- **Stale snapshots.** Changing the seed used to leave browsers on old data
  (happened 3×). Now `persistence.ts` computes a **content fingerprint** of
  the seed; any change self-invalidates old snapshots. Never rely on
  remembering to bump a version constant.
- **Never derive an id by parsing another id.** A sheet's `id` is
  `draft-<scheduleId>` *or* `gs-N`; string-stripping the prefix broke every
  submitted class. Carry the real field (`classScheduleId`) instead.
- **A trainee added to a class reopens its grading sheet.** Sheets freeze
  their roster at submission. Late joiners were ungradeable — locked sheet,
  and not on it. `reconcileGradingSheetRoster()` adds them and flips
  APPROVED/SUBMITTED → PENDING with a remark. Existing grades untouched;
  posted grades stay posted. A *departure* alone does not reopen.
- **Diploma is locked at enrollment.** Once a trainee is chosen, the Diploma
  selector shows only theirs. A mismatched semester silently orphans every
  class-schedule lookup. Guarded server-side too.
- **Duplicate people.** Blocked at all three doors (public form, Add student,
  CSV). Applicant door is strict (name alone); registrar door is name+DOB or
  email, since a registrar can judge two namesakes. Rejected/archived records
  do **not** block — reapplying is legitimate.
- **Prerequisites were never enforced** despite the data existing and a
  comment claiming otherwise. Now checked in `getEnrollmentOptions` *and*
  refused in `createEnrollment` by reading the same `disabledReason`, so
  screen and server cannot disagree.
- **Print isolation.** `@media print` hides everything then restores
  `.print-sheet` via `visibility` (inherited, so descendants can override).
  Scoped with `:has()`. Do not go back to tagging chrome `.no-print`.

---

## 8. Deployment

Push to `master` → GitHub Actions builds and publishes `dist/` to Pages.

```bash
npx tsc --noEmit && npm run build     # must both be clean
git push origin master
```

Then verify the live bundle hash matches `dist/assets/index-*.js`.
**GitHub Pages caches `index.html`** — append `?v=<random>` when checking, and
tell the user to hard-refresh (`Ctrl+Shift+R`).

- `base: './'` in `vite.config.ts` + HashRouter ⇒ the same `dist/` works on
  **any** static host with no config change (`netlify.toml` included).
- `VITE_DRIVE_RELAY_URL` must be set in the host's environment or the public
  application form degrades gracefully (says uploads are unavailable).

### Google Safe Browsing

The site was once flagged as **deceptive** — government name + seal + password
field + collecting birth certificates on free hosting, with nothing saying it
was a demo. **The disclosure is the remedy**: `DemoBanner` above the fold on
every page, non-affiliation notice in both footers, "Demonstration Prototype"
in `<title>` and meta, plus a `<noscript>` copy. **Never remove these to tidy
the design** — the flag comes back.

---

## 9. Known limitations (state these honestly)

- **No shared state across devices.** The single biggest one. See §2.
- **No TOR generator.** The Grade Evaluation Form is the cumulative record.
  Deliberately out of scope; describe as planned work.
- **`/apply` requires Google Drive** — it uploads an ID photo and birth
  certificate via an Apps Script relay *before* creating the record. A live
  network dependency in the demo's opening beat. Fallback: use
  **Students → Add student**.
- Bundle is ~680 kB (no code splitting). Fine for a prototype.
- `src/pages/students/EditStudentModal.tsx` is dead code (superseded by
  `StudentDetailModal`).

---

## 10. Working conventions

- **Match the surrounding code**: comment density, naming, idiom. Comments
  explain *why*, not *what*.
- **Reuse before adding.** `useSort` + `SortableTh` for sortable tables;
  `ConfirmDialog` for destructive actions; `QueryState` for load/error/empty;
  `relativeTime()` for "5 mins ago" labels.
- **Smallest change that is actually correct.** Prefer fixing the rule over
  patching the symptom.
- **Verify in the browser, not just the typechecker.** Driving the real API
  via the dev server catches what `tsc` cannot.
- Commit messages explain the *why* at length; this project's history is
  usable as documentation.

### Gotchas when testing locally

- Vite HMR can leave **two module instances** — a direct
  `import('/src/server/repositories/db.ts')` may not be the one `api/` uses.
  Symptom: "Your session has ended" between calls. Fix: restart the dev
  server, and do multi-step tests in **one** call.
- The session token in `localStorage` is just the user id
  (`registream.session`).

---

## 11. Where things live

```
src/server/services/    the rules. Start here for any behaviour question.
  enrollment.ts           eligibility, prerequisites, the semester gate
  grading-sheets.ts       submit / review / approve / roster reconciliation
  grade-rules.ts          the scale. Pure. Reuse it.
  grade-evaluation.ts     the GEF
  demo.ts                 restore demonstration data
src/server/data/
  seed.ts                 the controlled dataset (§6)
  curricula.ts            real curricula for all 8 diplomas + prereq chains
src/lib/                  pure helpers shared by both sides
src/pages/                screens, one folder per area
src/config/institution.ts institutional text — single source of truth
```

---

## 12. If you are picking this up to extend it

Ask which of these the request actually is, because they have very different
costs:

1. **A rule change** → `src/server/services/`, plus its screen. Cheap.
2. **A new view over existing data** → new page/modal + maybe a view field.
   Cheap; the data is usually already there.
3. **A new entity** → types, seed, service, API, screen, audit action. Medium.
4. **Shared state across devices** → a real backend. Every service becomes
   async. **Days, not hours** — do not start this close to a deadline.

Before changing behaviour, **inspect first and say what you found** — twice
now, a feature that "obviously worked" turned out never to have been wired up
at all (prerequisites; the trainer's sheet reopen). Assume nothing.
