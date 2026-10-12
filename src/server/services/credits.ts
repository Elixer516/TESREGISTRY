/**
 * Crediting a college undergraduate's earlier subjects.
 *
 * A trainee who studied elsewhere first brings a transcript. The Registrar
 * types its subjects in once — they print on the TOR under the previous
 * school's name — and the system then suggests which of them match a
 * subject of the trainee's KorPhil curriculum. Nothing is credited on a
 * suggestion alone: the Registrar confirms each one.
 *
 * A credited subject counts as earned everywhere a pass does — the
 * enrolment screen will not offer it again, it satisfies prerequisites, it
 * counts toward completion and graduation — and prints as CRD.
 */

import type { PreviousSchoolRecord, SubjectCredit } from '@/types';
import { semesterPeriodLabel, SEMESTER_PERIOD_ORDER } from '@/types';
import type {
  CreditSuggestion,
  CreditingWorkspace,
  PreviousSchoolRecordView,
  SubjectCreditView,
} from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getStudent, subjectLabel, toStudentView, userDisplayName } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { effectiveGrade, isPassing } from './grade-rules';

/* ---------------------------------------------------------------- */
/* Reads every other service uses                                    */
/* ---------------------------------------------------------------- */

/** The trainee's credited subjects, by curriculum subject id. No role check: a read helper. */
export function creditsFor(studentId: string): Map<string, SubjectCredit> {
  const map = new Map<string, SubjectCredit>();
  for (const credit of db.subjectCredits ?? []) {
    if (credit.studentId === studentId) map.set(credit.subjectId, credit);
  }
  return map;
}

export function previousRecordsFor(studentId: string): PreviousSchoolRecord[] {
  return (db.previousSchoolRecords ?? []).filter((r) => r.studentId === studentId);
}

/**
 * Whether another school's grade is a pass. Their scale is usually ours
 * (1.00–3.00 passes), but a transcript can also say P, PASSED or a
 * percentage. An INC counts only through its completion grade.
 */
export function isPreviousPass(record: Pick<PreviousSchoolRecord, 'grade' | 'completionGrade'>): boolean {
  const grade = record.grade.trim().toUpperCase();
  const counted = grade === 'INC' ? record.completionGrade.trim().toUpperCase() : grade;
  if (!counted) return false;
  if (counted === 'P' || counted === 'PASSED' || counted === 'CRD') return true;
  const n = Number(counted);
  if (!Number.isFinite(n)) return false;
  if (n >= 1 && n <= 5) return n <= 3;
  // A percentage.
  return n >= 75 && n <= 100;
}

/* ---------------------------------------------------------------- */
/* Matching                                                          */
/* ---------------------------------------------------------------- */

const STOPWORDS = new Set(['and', 'the', 'of', 'in', 'to', 'for', 'with', 'a', 'an', 'on', 'its']);
const ROMAN: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4' };

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .map((t) => ROMAN[t] ?? t)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function compactCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * How alike one previous subject is to one curriculum subject, from 0 to 1,
 * and why. Titles carry most of the weight — codes rarely agree between
 * schools — with a nudge for an identical code and a penalty when the other
 * school's subject carried fewer units than ours requires.
 */
function similarity(
  record: PreviousSchoolRecord,
  subject: { code: string; title: string; units: number },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const titleScore = jaccard(tokens(record.courseTitle), tokens(subject.title));
  let score = titleScore;
  if (titleScore === 1) reasons.push('Same title');
  else if (titleScore >= 0.5) reasons.push('Similar title');
  else if (titleScore > 0) reasons.push('Partly similar title');

  if (compactCode(record.courseCode) === compactCode(subject.code)) {
    score = Math.min(1, score + 0.25);
    reasons.push('Same code');
  }
  if (record.units >= subject.units) {
    reasons.push(`${record.units} unit${record.units === 1 ? '' : 's'} covers the ${subject.units} required`);
  } else {
    score -= 0.2;
    reasons.push(`Only ${record.units} of the ${subject.units} units required`);
  }
  return { score: Math.max(0, Math.round(score * 100) / 100), reasons };
}

function strengthOf(score: number): CreditSuggestion['strength'] {
  if (score >= 0.75) return 'STRONG';
  if (score >= 0.5) return 'LIKELY';
  return 'POSSIBLE';
}

/* ---------------------------------------------------------------- */
/* The Registrar's workspace                                         */
/* ---------------------------------------------------------------- */

function toRecordView(record: PreviousSchoolRecord): PreviousSchoolRecordView {
  const usedBy = (db.subjectCredits ?? []).find((c) => c.previousRecordIds.includes(record.id));
  const subject = usedBy ? db.subjects.find((s) => s.id === usedBy.subjectId) : undefined;
  return {
    ...record,
    passed: isPreviousPass(record),
    creditedAs: subject ? subjectLabel(subject) : null,
  };
}

function toCreditView(credit: SubjectCredit): SubjectCreditView {
  const subject = db.subjects.find((s) => s.id === credit.subjectId);
  const from = credit.previousRecordIds
    .map((id) => db.previousSchoolRecords.find((r) => r.id === id))
    .filter((r): r is PreviousSchoolRecord => Boolean(r));
  return {
    ...credit,
    subjectCode: subject?.code.trim() ?? '',
    subjectTitle: subject?.title ?? 'Unknown subject',
    units: subject?.units ?? 0,
    from: from.map((r) => ({
      courseCode: r.courseCode,
      courseTitle: r.courseTitle,
      grade: r.grade,
      units: r.units,
      schoolName: r.schoolName,
    })),
    creditedByName: userDisplayName(credit.creditedByUserId),
  };
}

export function getCreditingWorkspace(studentId: string): CreditingWorkspace {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const records = previousRecordsFor(studentId);
  const credits = creditsFor(studentId);

  // What the trainee already holds at KorPhil itself.
  const enrollmentIds = new Set(
    db.enrollments.filter((e) => e.studentId === studentId && e.status !== 'DROPPED').map((e) => e.id),
  );
  const passedHere = new Set(
    db.enrollmentSubjects
      .filter((es) => enrollmentIds.has(es.enrollmentId))
      .filter((es) => isPassing(effectiveGrade(es.finalGrade, es.completionGrade)))
      .map((es) => es.subjectId),
  );

  const mappings = student.curriculumId
    ? db.programSubjects
        .filter((ps) => ps.curriculumId === student.curriculumId)
        .sort(
          (a, b) =>
            a.yearLevel - b.yearLevel ||
            SEMESTER_PERIOD_ORDER[a.semesterPeriod] - SEMESTER_PERIOD_ORDER[b.semesterPeriod],
        )
    : [];

  const curriculumSubjects = mappings.map((m) => {
    const subject = db.subjects.find((s) => s.id === m.subjectId);
    return {
      subjectId: m.subjectId,
      code: subject?.code.trim() ?? '',
      title: subject?.title ?? '',
      units: subject?.units ?? 0,
      termLabel: semesterPeriodLabel(m.yearLevel, m.semesterPeriod),
      status: credits.has(m.subjectId)
        ? ('CREDITED' as const)
        : passedHere.has(m.subjectId)
          ? ('PASSED' as const)
          : ('OPEN' as const),
    };
  });

  // Every pairing worth showing, best first; then each previous subject and
  // each curriculum subject is used once, so one transcript line is never
  // offered against three of ours.
  const usedRecordIds = new Set((db.subjectCredits ?? []).flatMap((c) => c.previousRecordIds));
  const candidates: CreditSuggestion[] = [];
  for (const record of records) {
    if (usedRecordIds.has(record.id) || !isPreviousPass(record)) continue;
    for (const target of curriculumSubjects) {
      if (target.status !== 'OPEN') continue;
      const { score, reasons } = similarity(record, target);
      if (score < 0.3) continue;
      candidates.push({
        previousRecordId: record.id,
        previousCode: record.courseCode,
        previousTitle: record.courseTitle,
        previousGrade: record.grade,
        previousUnits: record.units,
        subjectId: target.subjectId,
        subjectCode: target.code,
        subjectTitle: target.title,
        subjectUnits: target.units,
        termLabel: target.termLabel,
        score,
        strength: strengthOf(score),
        reasons,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const takenRecords = new Set<string>();
  const takenSubjects = new Set<string>();
  const suggestions: CreditSuggestion[] = [];
  for (const c of candidates) {
    if (takenRecords.has(c.previousRecordId) || takenSubjects.has(c.subjectId)) continue;
    takenRecords.add(c.previousRecordId);
    takenSubjects.add(c.subjectId);
    suggestions.push(c);
  }

  return {
    student: toStudentView(student),
    records: records.map(toRecordView),
    credits: [...credits.values()].map(toCreditView),
    suggestions,
    curriculumSubjects,
    creditedUnits: [...credits.values()].reduce(
      (sum, c) => sum + (db.subjects.find((s) => s.id === c.subjectId)?.units ?? 0),
      0,
    ),
  };
}

export interface PreviousRecordInput {
  schoolName: string;
  schoolYear: string;
  courseCode: string;
  courseTitle: string;
  grade: string;
  completionGrade?: string;
  units: number;
}

export function addPreviousRecords(studentId: string, inputs: PreviousRecordInput[]): CreditingWorkspace {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  if (inputs.length === 0) throw badRequest('Add at least one subject.');
  const rows: PreviousSchoolRecord[] = inputs.map((input, index) => {
    const line = inputs.length > 1 ? ` (line ${index + 1})` : '';
    if (!input.schoolName.trim()) throw badRequest(`Name the school${line}.`);
    if (!input.courseTitle.trim()) throw badRequest(`Give the subject's title${line}.`);
    if (!input.grade.trim()) throw badRequest(`Give the grade the school gave${line}.`);
    const units = Number(input.units);
    if (!Number.isFinite(units) || units < 0 || units > 12) throw badRequest(`Units must be 0 to 12${line}.`);
    return {
      id: nextId('psr'),
      studentId,
      schoolName: input.schoolName.trim(),
      schoolYear: input.schoolYear.trim(),
      courseCode: input.courseCode.trim(),
      courseTitle: input.courseTitle.trim(),
      grade: input.grade.trim().toUpperCase(),
      completionGrade: (input.completionGrade ?? '').trim().toUpperCase(),
      units,
      createdAt: nowIso(),
      createdByUserId: actor.id,
    };
  });
  db.previousSchoolRecords.push(...rows);
  recordAudit({
    action: 'PREV_RECORD_ADDED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${rows.length} previous-school subject${rows.length === 1 ? '' : 's'} added for ${student.firstName} ${student.lastName}.`,
    after: { records: rows },
  });
  return getCreditingWorkspace(studentId);
}

export function removePreviousRecord(recordId: string): CreditingWorkspace {
  const actor = requireRole('REGISTRAR');
  const record = db.previousSchoolRecords.find((r) => r.id === recordId);
  if (!record) throw notFound('That subject could not be found.');
  if ((db.subjectCredits ?? []).some((c) => c.previousRecordIds.includes(recordId))) {
    throw badRequest('A subject has been credited from this one. Remove that credit first.');
  }
  db.previousSchoolRecords.splice(db.previousSchoolRecords.indexOf(record), 1);
  recordAudit({
    action: 'PREV_RECORD_REMOVED',
    recordType: 'Student',
    recordId: record.studentId,
    actor,
    detail: `Previous-school subject ${record.courseCode} ${record.courseTitle} removed.`,
    before: { ...record },
  });
  return getCreditingWorkspace(record.studentId);
}

/** Confirm one credit: this curriculum subject, from these previous subjects. */
export function creditSubject(
  studentId: string,
  subjectId: string,
  previousRecordIds: string[],
  note = '',
): CreditingWorkspace {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  if (!student.curriculumId) {
    throw badRequest('Approve this trainee first — crediting is against the curriculum approval assigns.');
  }
  const mapping = db.programSubjects.find(
    (ps) => ps.curriculumId === student.curriculumId && ps.subjectId === subjectId,
  );
  if (!mapping) throw badRequest('That subject is not in this trainee’s curriculum.');
  if (creditsFor(studentId).has(subjectId)) throw badRequest('That subject is already credited.');
  if (previousRecordIds.length === 0) throw badRequest('Choose the previous subject it is credited from.');
  for (const id of previousRecordIds) {
    const record = db.previousSchoolRecords.find((r) => r.id === id && r.studentId === studentId);
    if (!record) throw badRequest('One of those previous subjects is not on this trainee’s record.');
    if (!isPreviousPass(record)) {
      throw badRequest(`${record.courseCode} ${record.courseTitle} was not passed (${record.grade}), so it cannot be credited.`);
    }
    if ((db.subjectCredits ?? []).some((c) => c.previousRecordIds.includes(id))) {
      throw badRequest(`${record.courseCode} has already been used for another credit.`);
    }
  }
  const credit: SubjectCredit = {
    id: nextId('crd'),
    studentId,
    subjectId,
    previousRecordIds: [...new Set(previousRecordIds)],
    note: note.trim(),
    creditedAt: nowIso(),
    creditedByUserId: actor.id,
  };
  db.subjectCredits.push(credit);
  const subject = db.subjects.find((s) => s.id === subjectId);
  recordAudit({
    action: 'SUBJECT_CREDITED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${subjectLabel(subject)} credited to ${student.firstName} ${student.lastName}.`,
    after: { ...credit },
  });
  return getCreditingWorkspace(studentId);
}

export function removeCredit(creditId: string): CreditingWorkspace {
  const actor = requireRole('REGISTRAR');
  const credit = db.subjectCredits.find((c) => c.id === creditId);
  if (!credit) throw notFound('That credit could not be found.');
  db.subjectCredits.splice(db.subjectCredits.indexOf(credit), 1);
  const subject = db.subjects.find((s) => s.id === credit.subjectId);
  recordAudit({
    action: 'SUBJECT_CREDIT_REMOVED',
    recordType: 'Student',
    recordId: credit.studentId,
    actor,
    detail: `Credit for ${subjectLabel(subject)} removed.`,
    before: { ...credit },
  });
  return getCreditingWorkspace(credit.studentId);
}
