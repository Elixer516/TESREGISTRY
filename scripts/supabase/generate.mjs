/**
 * Generates the Supabase schema and seed from the app's own demo data.
 *
 *   node scripts/supabase/generate.mjs
 *
 * Writes:
 *   supabase/migrations/20261026000000_registream_schema.sql  — tables, keys, relationships, RLS on
 *   supabase/seed.sql                                          — the demo dataset as INSERTs
 *
 * The seed in src/server/data/seed.ts stays the single source of truth: the
 * column list and types are read from it, so the database cannot drift from
 * what the app actually stores. Collections the seed leaves empty are
 * described by a template row below.
 */

import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const { createSeedDatabase } = await vite.ssrLoadModule('/src/server/data/seed.ts');
const db = createSeedDatabase();
await vite.close();

const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

/* Tables in dependency order: a table comes after every table it points to. */
const ORDER = [
  'programs', 'curricula', 'subjects', 'programSubjects', 'academicYears', 'semesters', 'sections',
  'faculty', 'students', 'users', 'classSchedules', 'facultyAssignments', 'gradeDeadlineOverrides',
  'enrollments', 'enrollmentSubjects', 'gradeCompletions', 'gradingSheets', 'facultyEvaluations',
  'dropCases', 'previousSchoolRecords', 'subjectCredits', 'enrollmentDocuments', 'requirementReceipts',
  'documentRequests', 'auditLogs',
];

/* Foreign keys by field name → table. Fields naming a user who acted
   (gradedByUserId, recordedByUserId…) are kept as plain text: audit history
   must survive an account being removed. */
const FK = {
  programId: 'programs', curriculumId: 'curricula', subjectId: 'subjects', academicYearId: 'academic_years',
  semesterId: 'semesters', sectionId: 'sections', facultyId: 'faculty', studentId: 'students',
  classScheduleId: 'class_schedules', enrollmentId: 'enrollments', enrollmentSubjectId: 'enrollment_subjects',
};

/* A representative row for collections the seed leaves empty, so their columns are known. */
const now = '2026-01-01T00:00:00.000Z';
const TEMPLATES = {
  dropCases: { id: 'x', caseNumber: 'x', studentId: 'x', status: 'x', origin: 'x', reason: 'x', note: 'x', effectiveDate: '2026-01-01', attachments: [], history: [], previousStudentStatus: 'x', openedAt: now, openedByUserId: 'x', droppedAt: now, updatedAt: now },
  subjectCredits: { id: 'x', studentId: 'x', subjectId: 'x', previousRecordIds: [], note: 'x', creditedAt: now, creditedByUserId: 'x' },
  gradeCompletions: { id: 'x', enrollmentSubjectId: 'x', kind: 'x', previousFinalGrade: 'x', previousCompletionGrade: 'x', previousGradeStatus: 'x', newFinalGrade: 'x', newCompletionGrade: 'x', newGradeStatus: 'x', remarks: 'x', processedByUserId: 'x', processedAt: now },
  enrollmentDocuments: { id: 'x', studentId: 'x', documentType: 'x', fileName: 'x', fileSize: 1, mimeType: 'x', driveFileId: 'x', driveWebViewLink: 'x', version: 1, uploadedByUserId: 'x', uploadedAt: now },
};

/* Columns whose type the seed cannot show (always null there). */
const OVERRIDES = {
  completionPercentage: 'numeric', finalPercentage: 'numeric', gradesViewedAt: 'timestamptz',
  graduatedAt: 'timestamptz', departedAt: 'timestamptz', approvedAt: 'timestamptz', archivedAt: 'timestamptz',
  lockedUntil: 'timestamptz', lastLoginAt: 'timestamptz', gradedAt: 'timestamptz', releasedAt: 'timestamptz',
  submittedAt: 'timestamptz', reviewedAt: 'timestamptz', droppedAt: 'timestamptz', effectiveDate: 'date',
  gradesDueDate: 'date', prerequisiteStanding: 'integer', capacity: 'integer', yearLevel: 'integer',
  units: 'numeric', totalUnits: 'numeric', lectureHours: 'numeric', labHours: 'numeric',
};

const typeOf = (field, values) => {
  if (OVERRIDES[field]) return OVERRIDES[field];
  const v = values.filter((x) => x !== null && x !== undefined);
  if (v.length === 0) return 'text';
  if (v.every((x) => typeof x === 'boolean')) return 'boolean';
  if (v.every((x) => typeof x === 'number')) return v.every(Number.isInteger) ? 'integer' : 'numeric';
  if (v.some((x) => typeof x === 'object')) return 'jsonb';
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x))) return 'timestamptz';
  if (v.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) return 'date';
  return 'text';
};

const lit = (value, type) => {
  if (value === null || value === undefined) return 'null';
  if (type === 'jsonb') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'integer' || type === 'numeric') return String(value);
  if (value === '' && (type === 'date' || type === 'timestamptz')) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const schema = [];
const seed = [];
schema.push(`-- RegiStream database schema.
-- Generated by scripts/supabase/generate.mjs from src/server/data/seed.ts. Do not edit by hand:
-- change the app's types and seed, then regenerate.
--
-- Row Level Security is switched ON for every table with no policies yet, so nothing is readable
-- or writable through the public API until the role policies are added (Phase 2).
`);
seed.push(`-- RegiStream demo dataset. Generated by scripts/supabase/generate.mjs.\n-- Run after the schema migration. Safe to re-run: it empties the tables first.\n`);
const TRUNCATE = `truncate ${[...ORDER].reverse().map((c) => snake(c)).join(', ')} cascade;\n`;
seed.push(TRUNCATE);
// The same inserts split into parts small enough to paste into the SQL editor one at a time.
const parts = [[]];
let partSize = 0;

for (const key of ORDER) {
  const rows = db[key] ?? [];
  const sample = rows.length ? rows : [TEMPLATES[key]];
  if (!sample[0]) throw new Error(`No rows and no template for ${key}`);
  // Passwords never go in our tables: Supabase Auth holds them (Phase 1).
  const fields = ['id', ...new Set(sample.flatMap((r) => Object.keys(r)))].filter(
    (f, i, all) => all.indexOf(f) === i && !(key === 'users' && f === 'password'),
  );
  const table = snake(key);
  const cols = fields.map((f) => ({ f, col: snake(f), type: typeOf(f, sample.map((r) => r[f])) }));

  const defs = cols.map(({ f, col, type }) => {
    let line = `  ${col} ${type}`;
    if (f === 'id') line += ' primary key';
    else if (FK[f] && FK[f] !== table) line += ` references ${FK[f]}(id)`;
    return line;
  });
  if (key === 'users') defs.push('  auth_user_id uuid unique references auth.users(id) on delete set null');
  schema.push(`create table ${table} (\n${defs.join(',\n')}\n);\nalter table ${table} enable row level security;\n`);
  for (const { f, col } of cols) if (FK[f] && FK[f] !== table) schema.push(`create index ${table}_${col}_idx on ${table} (${col});`);
  schema.push('');

  if (rows.length) {
    const header = `insert into ${table} (${cols.map((c) => c.col).join(', ')}) values`;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((r) => `  (${cols.map(({ f, type }) => lit(r[f], type)).join(', ')})`);
      const stmt = `${header}\n${chunk.join(',\n')};\n`;
      seed.push(stmt);
      if (partSize + stmt.length > 180000 && parts.at(-1).length) {
        parts.push([]);
        partSize = 0;
      }
      parts.at(-1).push(stmt);
      partSize += stmt.length;
    }
  }
}

const out = (rel, text) => { const p = resolve(root, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
const a = out('supabase/migrations/20261026000000_registream_schema.sql', schema.join('\n'));
const b = out('supabase/seed.sql', seed.join('\n'));
parts.forEach((part, i) =>
  out(
    `supabase/seed-parts/seed-${String(i + 1).padStart(2, '0')}.sql`,
    `-- Seed part ${i + 1} of ${parts.length}. Run the parts in order, after the schema.\n` +
      (i === 0 ? TRUNCATE : '') +
      part.join('\n'),
  ),
);
console.log('parts: ', parts.length, 'files in supabase/seed-parts/');
console.log('schema:', a);
console.log('seed:  ', b);
for (const key of ORDER) console.log(`  ${snake(key).padEnd(26)} ${String((db[key] ?? []).length).padStart(5)} rows`);
