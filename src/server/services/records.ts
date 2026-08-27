/**
 * Academic records and the two INC exits.
 *
 * COMPLETION and CORRECTION are not the same operation and must never be
 * merged:
 *
 *  · COMPLETION — the student finished the outstanding work. `finalGrade`
 *    stays `INC` and a `completionGrade` is added, so the record still shows
 *    that an INC occurred.
 *  · CORRECTION — the INC was recorded in error. `finalGrade` is replaced
 *    outright and the INC disappears, because it should never have been there.
 *
 * Both write a GradeCompletion row carrying the before and after values.
 */

import type { GradeCompletion, SemesterPeriod } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type {
  AcademicRecordView,
  GradeCompletionView,
  TermRecordGroup,
} from '@/types/views';
import { badRequest, validationFailed } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import {
  enrollmentsForStudent,
  getEnrollmentSubject,
  getStudent,
  semesterSortKey,
  toEnrollmentSubjectView,
  toStudentView,
  userDisplayName,
} from '../repositories/lookups';
import { requireRole } from '../auth';
import { computeGwa, deriveGradeStatus, parseGrade } from './grade-rules';
import { recordAudit } from './audit';

export interface RecordFilters {
  academicYearId?: string;
  semesterPeriod?: SemesterPeriod | 'ALL';
  yearLevel?: number | 'ALL';
}

export function getAcademicRecord(
  studentId: string,
  filters: RecordFilters = {},
): AcademicRecordView {
  requireRole('REGISTRAR');
  return buildAcademicRecord(studentId, filters);
}

/** Shared by the registrar view and the trainee's own portal. */
export function buildAcademicRecord(
  studentId: string,
  filters: RecordFilters = {},
): AcademicRecordView {
  const student = getStudent(studentId);
  const enrollments = enrollmentsForStudent(studentId);

  const groups: TermRecordGroup[] = [];

  for (const enrollment of enrollments) {
    const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
    if (!semester) continue;
    if (filters.academicYearId && semester.academicYearId !== filters.academicYearId) continue;
    if (
      filters.semesterPeriod &&
      filters.semesterPeriod !== 'ALL' &&
      semester.semesterPeriod !== filters.semesterPeriod
    ) {
      continue;
    }
    if (filters.yearLevel && filters.yearLevel !== 'ALL' && semester.yearLevel !== filters.yearLevel) {
      continue;
    }

    const year = db.academicYears.find((y) => y.id === semester.academicYearId);
    const rows = db.enrollmentSubjects
      .filter((es) => es.enrollmentId === enrollment.id)
      .map(toEnrollmentSubjectView)
      .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));

    const gwa = computeGwa(
      rows.map((r) => ({
        units: r.units,
        finalGrade: r.finalGrade,
        completionGrade: r.completionGrade,
      })),
    );

    groups.push({
      enrollmentId: enrollment.id,
      semesterId: semester.id,
      academicYearLabel: year?.label ?? '—',
      semesterPeriod: semester.semesterPeriod,
      yearLevel: semester.yearLevel,
      termLabel: semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod),
      status: enrollment.status,
      rows,
      totalUnits: gwa.totalUnits,
      gwa: gwa.gwa,
      hasUnresolvedInc: gwa.hasUnresolvedInc,
    });
  }

  groups.sort((a, b) => {
    const semA = db.semesters.find((s) => s.id === a.semesterId);
    const semB = db.semesters.find((s) => s.id === b.semesterId);
    if (!semA || !semB) return 0;
    return semesterSortKey(semB).localeCompare(semesterSortKey(semA));
  });

  const allRows = groups.flatMap((g) =>
    g.rows.map((r) => ({
      units: r.units,
      finalGrade: r.finalGrade,
      completionGrade: r.completionGrade,
    })),
  );
  const overall = computeGwa(allRows);

  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  const rowIds = new Set(
    db.enrollmentSubjects.filter((es) => enrollmentIds.has(es.enrollmentId)).map((es) => es.id),
  );
  const completions: GradeCompletionView[] = db.gradeCompletions
    .filter((gc) => rowIds.has(gc.enrollmentSubjectId))
    .map(toCompletionView)
    .sort((a, b) => b.processedAt.localeCompare(a.processedAt));

  return {
    student: toStudentView(student),
    groups,
    overallGwa: overall.gwa,
    totalUnits: overall.totalUnits,
    hasUnresolvedInc: overall.hasUnresolvedInc,
    completions,
  };
}

function toCompletionView(completion: GradeCompletion): GradeCompletionView {
  const row = db.enrollmentSubjects.find((es) => es.id === completion.enrollmentSubjectId);
  const subject = row ? db.subjects.find((s) => s.id === row.subjectId) : undefined;
  return {
    ...completion,
    subjectCode: subject?.code ?? '—',
    subjectTitle: subject?.title ?? 'Unknown subject',
    processedByName: userDisplayName(completion.processedByUserId),
  };
}

/* ---------------------------------------------------------------- */
/* INC exit 1 — completion                                           */
/* ---------------------------------------------------------------- */

export function completeInc(
  enrollmentSubjectId: string,
  completionGrade: string,
  remarks: string,
): AcademicRecordView {
  const actor = requireRole('REGISTRAR');
  const row = getEnrollmentSubject(enrollmentSubjectId);

  if (row.finalGrade !== 'INC') {
    throw badRequest('Only a subject currently marked INC can be completed.');
  }
  if (row.completionGrade) {
    throw badRequest('This INC has already been completed.');
  }

  const parsed = parseGrade(completionGrade);
  if (!parsed.ok) throw validationFailed(parsed.message);
  if (parsed.value === null || parsed.value === 'INC') {
    throw validationFailed('A completion grade must be a number from 1.00 to 5.00.');
  }

  const before = { ...row };

  // The INC stays. That is the whole point of a completion.
  row.completionGrade = parsed.value;
  row.gradeStatus = deriveGradeStatus(row.finalGrade, row.completionGrade);

  const completion: GradeCompletion = {
    id: nextId('gc'),
    enrollmentSubjectId: row.id,
    kind: 'COMPLETION',
    previousFinalGrade: before.finalGrade,
    previousCompletionGrade: before.completionGrade,
    previousGradeStatus: before.gradeStatus,
    newFinalGrade: row.finalGrade,
    newCompletionGrade: row.completionGrade,
    newGradeStatus: row.gradeStatus,
    remarks: remarks.trim(),
    processedByUserId: actor.id,
    processedAt: nowIso(),
  };
  db.gradeCompletions.push(completion);

  const subject = db.subjects.find((s) => s.id === row.subjectId);
  recordAudit({
    action: 'INC_COMPLETED',
    recordType: 'EnrollmentSubject',
    recordId: row.id,
    actor,
    detail: `${subject?.code ?? 'Subject'}: INC completed with ${parsed.value}. The INC remains on the record.`,
    before,
    after: { ...row },
  });

  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  return buildAcademicRecord(enrollment?.studentId ?? '');
}

/* ---------------------------------------------------------------- */
/* INC exit 2 — correction                                           */
/* ---------------------------------------------------------------- */

export function correctInc(
  enrollmentSubjectId: string,
  correctedGrade: string,
  remarks: string,
): AcademicRecordView {
  const actor = requireRole('REGISTRAR');
  const row = getEnrollmentSubject(enrollmentSubjectId);

  if (row.finalGrade !== 'INC') {
    throw badRequest('Only a subject currently marked INC can be corrected.');
  }
  if (!remarks.trim()) {
    throw badRequest(
      'A correction rewrites history — record why the INC should not have been there.',
    );
  }

  const parsed = parseGrade(correctedGrade);
  if (!parsed.ok) throw validationFailed(parsed.message);
  if (parsed.value === null || parsed.value === 'INC') {
    throw validationFailed('A corrected grade must be a number from 1.00 to 5.00.');
  }

  const before = { ...row };

  // The INC was a mistake, so it is replaced outright and leaves no trace on
  // the row itself — only the GradeCompletion entry below remembers it.
  row.finalGrade = parsed.value;
  row.completionGrade = null;
  row.gradeStatus = deriveGradeStatus(row.finalGrade, row.completionGrade);
  row.gradedAt = nowIso();
  row.gradedByUserId = actor.id;

  const completion: GradeCompletion = {
    id: nextId('gc'),
    enrollmentSubjectId: row.id,
    kind: 'CORRECTION',
    previousFinalGrade: before.finalGrade,
    previousCompletionGrade: before.completionGrade,
    previousGradeStatus: before.gradeStatus,
    newFinalGrade: row.finalGrade,
    newCompletionGrade: null,
    newGradeStatus: row.gradeStatus,
    remarks: remarks.trim(),
    processedByUserId: actor.id,
    processedAt: nowIso(),
  };
  db.gradeCompletions.push(completion);

  const subject = db.subjects.find((s) => s.id === row.subjectId);
  recordAudit({
    action: 'INC_CORRECTED',
    recordType: 'EnrollmentSubject',
    recordId: row.id,
    actor,
    detail: `${subject?.code ?? 'Subject'}: INC corrected to ${parsed.value}. The INC was removed from the record.`,
    before,
    after: { ...row },
  });

  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  return buildAcademicRecord(enrollment?.studentId ?? '');
}

/* ---------------------------------------------------------------- */
/* Printable semester grade sheet                                    */
/* ---------------------------------------------------------------- */

export interface GradeSheet {
  student: AcademicRecordView['student'];
  group: TermRecordGroup;
  generatedOn: string;
  /** Explains a 0.000 GWA rather than leaving it looking like a bug. */
  gwaNote: string | null;
}

export function getGradeSheet(studentId: string, semesterId: string): GradeSheet {
  requireRole('REGISTRAR');
  const record = buildAcademicRecord(studentId);
  const group = record.groups.find((g) => g.semesterId === semesterId);
  if (!group) {
    throw badRequest('This student has no enrollment for that term.');
  }

  return {
    student: record.student,
    group,
    generatedOn: nowIso(),
    gwaNote: group.hasUnresolvedInc
      ? 'GWA is shown as 0.000 because this term contains an unresolved INC. Complete or correct the INC to compute a real average.'
      : null,
  };
}
