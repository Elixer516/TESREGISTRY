/**
 * Reports — FR-15.2.
 *
 * Every report here is derived on read from records that already exist, the
 * same way the Grade Evaluation is: nothing is stored, so a report printed
 * today cannot disagree with the enrolments it counts.
 *
 * Five reports, the four kinds FR-15.2 names plus a summary:
 *
 *   Enrollment      who is enrolled — by diploma, year level and section,
 *                   new and continuing, split by sex.
 *   Academic        how they did — pass rates, averages, weakest subjects,
 *                   strongest terms, and the centre's 79% standing line.
 *   Retention       who carried on to the next term, and why people left.
 *   Completion      who has finished their curriculum, and who is close.
 *   Summary         one page of the above for management.
 */

import type {
  AcademicYear,
  DepartureReason,
  Enrollment,
  EnrollmentSubject,
  Program,
  Semester,
  SemesterPeriod,
  Student,
} from '@/types';
import {
  ALL_DEPARTURE_REASONS,
  DEPARTURE_REASON_LABELS,
  SEMESTER_PERIOD_LABELS,
  SEMESTER_PERIOD_ORDER,
  STUDENT_STATUS_LABELS,
  isInstitutionInitiated,
  semesterPeriodLabel,
} from '@/types';
import type {
  AcademicCounts,
  AcademicDiplomaRow,
  AcademicReport,
  AcademicSubjectRow,
  AcademicTraineeRow,
  CompletionReport,
  CompletionRow,
  DepartureReasonRow,
  DepartureTraineeRow,
  ReportFilters,
  RetentionReport,
  RetentionTermRow,
  SummaryDiplomaRow,
  SummaryReport,
  EnrollmentCounts,
  EnrollmentReport,
  EnrollmentReportDiplomaRow,
  EnrollmentReportFilters,
  EnrollmentReportRosterRow,
  EnrollmentReportSectionRow,
} from '@/types/views';
import { notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { requireRole } from '../auth';
import { subjectLabel } from '../repositories/lookups';
import { computeGwa, effectiveGrade, isPassing } from './grade-rules';
import { standingTier } from './academic-standing';

/** The school year a report defaults to: the open one, else the latest. */
function defaultAcademicYearId(): string {
  const active = db.academicYears.find((y) => y.isActive);
  if (active) return active.id;
  return [...db.academicYears].sort((a, b) => b.label.localeCompare(a.label))[0]?.id ?? '';
}

/**
 * The section a trainee sat in for one enrolment.
 *
 * Read from the classes the enrolment put them in rather than from the
 * trainee's current section, which is only true of the term they are in now:
 * a trainee in Third Year was in a First Year section two school years ago.
 */
function sectionFor(enrollment: Enrollment, student: Student): string {
  for (const row of db.enrollmentSubjects) {
    if (row.enrollmentId !== enrollment.id || !row.classScheduleId) continue;
    const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
    const section = schedule ? db.sections.find((s) => s.id === schedule.sectionId) : undefined;
    if (section) return section.code;
  }
  const own = student.sectionId ? db.sections.find((s) => s.id === student.sectionId) : undefined;
  return own?.code ?? 'No section';
}

function emptyCounts(): EnrollmentCounts {
  return { trainees: 0, male: 0, female: 0, newTrainees: 0, continuing: 0, units: 0, dropped: 0 };
}

export function getEnrollmentReport(filters: EnrollmentReportFilters = {}): EnrollmentReport {
  requireRole('REGISTRAR');

  const academicYearId = filters.academicYearId || defaultAcademicYearId();
  const year = db.academicYears.find((y) => y.id === academicYearId);
  if (!year) throw notFound('That school year could not be found.');
  const program = filters.programId
    ? db.programs.find((p) => p.id === filters.programId)
    : undefined;
  if (filters.programId && !program) throw notFound('That diploma could not be found.');

  const period: SemesterPeriod | undefined = filters.semesterPeriod;
  const semesters = db.semesters.filter(
    (s) =>
      s.academicYearId === year.id &&
      (!period || s.semesterPeriod === period) &&
      (!program || s.programId === program.id),
  );
  const semesterById = new Map(semesters.map((s) => [s.id, s]));

  // Each trainee's first-ever enrolment, by the start date of its semester —
  // "new" means that first enrolment falls in this school year.
  const firstStart = new Map<string, string>();
  for (const e of db.enrollments) {
    const sem = db.semesters.find((s) => s.id === e.semesterId);
    if (!sem) continue;
    const seen = firstStart.get(e.studentId);
    if (!seen || sem.startDate < seen) firstStart.set(e.studentId, sem.startDate);
  }
  const isNew = (studentId: string) => {
    const first = firstStart.get(studentId);
    return first !== undefined && first >= year.startDate && first <= year.endDate;
  };

  const inScope = db.enrollments.filter((e) => semesterById.has(e.semesterId));

  const roster: EnrollmentReportRosterRow[] = [];
  const diplomaRows = new Map<string, EnrollmentReportDiplomaRow & { ids: Set<string>; yearOf: Map<string, number> }>();
  const sectionRows = new Map<string, EnrollmentReportSectionRow & { ids: Set<string> }>();
  const totals = emptyCounts();
  const totalIds = new Set<string>();
  let yearLevels = 1;

  for (const enrollment of inScope) {
    const semester = semesterById.get(enrollment.semesterId);
    const student = db.students.find((s) => s.id === enrollment.studentId);
    if (!semester || !student) continue;
    const prog = db.programs.find((p) => p.id === semester.programId);
    yearLevels = Math.max(yearLevels, prog?.yearsToComplete ?? 1, semester.yearLevel);
    const termLabel = semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod);
    const sectionCode = sectionFor(enrollment, student);
    const dropped = enrollment.status === 'DROPPED';

    roster.push({
      enrollmentId: enrollment.id,
      studentNumber: student.studentNumber,
      name: `${student.lastName}, ${student.firstName}${student.middleName ? ` ${student.middleName.charAt(0)}.` : ''}`,
      sex: student.sex,
      programCode: prog?.code ?? '—',
      yearLevel: semester.yearLevel,
      sectionCode,
      termLabel,
      units: enrollment.totalUnits,
      status: enrollment.status,
      isNew: isNew(student.id),
      enrolledAt: enrollment.enrolledAt,
    });

    let diploma = diplomaRows.get(semester.programId);
    if (!diploma) {
      diploma = {
        ...emptyCounts(),
        programId: semester.programId,
        code: prog?.code ?? '—',
        name: prog?.name ?? 'Unknown diploma',
        byYear: [],
        ids: new Set(),
        yearOf: new Map(),
      };
      diplomaRows.set(semester.programId, diploma);
    }

    if (dropped) {
      diploma.dropped += 1;
      totals.dropped += 1;
      continue;
    }

    diploma.units += enrollment.totalUnits;
    totals.units += enrollment.totalUnits;
    // A trainee counts once per diploma, at the highest year level they held
    // in the period — two terms of the same year are one trainee, not two.
    diploma.ids.add(student.id);
    diploma.yearOf.set(student.id, Math.max(diploma.yearOf.get(student.id) ?? 0, semester.yearLevel));
    totalIds.add(student.id);

    const sectionKey = `${semester.id}|${sectionCode}`;
    let section = sectionRows.get(sectionKey);
    if (!section) {
      section = {
        key: sectionKey,
        programCode: prog?.code ?? '—',
        yearLevel: semester.yearLevel,
        sectionCode,
        termLabel,
        trainees: 0,
        male: 0,
        female: 0,
        units: 0,
        ids: new Set(),
      };
      sectionRows.set(sectionKey, section);
    }
    section.units += enrollment.totalUnits;
    if (!section.ids.has(student.id)) {
      section.ids.add(student.id);
      section.trainees += 1;
      if (student.sex === 'MALE') section.male += 1;
      else section.female += 1;
    }
  }

  const studentById = new Map(db.students.map((s) => [s.id, s]));
  const tally = (ids: Set<string>, into: EnrollmentCounts) => {
    into.trainees = ids.size;
    for (const id of ids) {
      const student = studentById.get(id);
      if (student?.sex === 'MALE') into.male += 1;
      else into.female += 1;
      if (isNew(id)) into.newTrainees += 1;
      else into.continuing += 1;
    }
  };

  const byDiploma: EnrollmentReportDiplomaRow[] = [...diplomaRows.values()]
    .map(({ ids, yearOf, ...row }) => {
      tally(ids, row);
      const byYear = Array.from({ length: yearLevels }, () => 0);
      for (const level of yearOf.values()) byYear[level - 1] += 1;
      return { ...row, byYear };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  tally(totalIds, totals);

  const bySection: EnrollmentReportSectionRow[] = [...sectionRows.values()]
    .map(({ ids: _ids, ...row }) => row)
    .sort(
      (a, b) =>
        a.programCode.localeCompare(b.programCode) ||
        a.yearLevel - b.yearLevel ||
        a.termLabel.localeCompare(b.termLabel) ||
        a.sectionCode.localeCompare(b.sectionCode),
    );

  roster.sort(
    (a, b) =>
      a.programCode.localeCompare(b.programCode) ||
      a.yearLevel - b.yearLevel ||
      a.termLabel.localeCompare(b.termLabel) ||
      a.name.localeCompare(b.name),
  );

  return {
    schoolYearLabel: year.label,
    periodLabel: period ? SEMESTER_PERIOD_LABELS[period] : 'All semesters',
    programLabel: program ? program.name : 'All diplomas',
    yearLevels,
    totals,
    byDiploma,
    bySection,
    roster,
    generatedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Shared scope                                                        */
/* ================================================================== */

interface Scope {
  year: AcademicYear;
  program: Program | undefined;
  period: SemesterPeriod | undefined;
  semesters: Semester[];
  semesterById: Map<string, Semester>;
  periodLabel: string;
  programLabel: string;
}

/** Reads the filters once, the same way for every report. */
function resolveScope(filters: ReportFilters, usePeriod: boolean): Scope {
  const academicYearId = filters.academicYearId || defaultAcademicYearId();
  const year = db.academicYears.find((y) => y.id === academicYearId);
  if (!year) throw notFound('That school year could not be found.');
  const program = filters.programId
    ? db.programs.find((p) => p.id === filters.programId)
    : undefined;
  if (filters.programId && !program) throw notFound('That diploma could not be found.');
  const period = usePeriod ? filters.semesterPeriod : undefined;
  const semesters = db.semesters.filter(
    (s) =>
      s.academicYearId === year.id &&
      (!period || s.semesterPeriod === period) &&
      (!program || s.programId === program.id),
  );
  return {
    year,
    program,
    period,
    semesters,
    semesterById: new Map(semesters.map((s) => [s.id, s])),
    periodLabel: period ? SEMESTER_PERIOD_LABELS[period] : 'All semesters',
    programLabel: program ? program.name : 'All diplomas',
  };
}

/** An ISO date moved by whole months ("2026-08-01", -6 → "2026-02-01"). */
function shiftMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

const percent = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;

const shortName = (s: Student) =>
  `${s.lastName}, ${s.firstName}${s.middleName ? ` ${s.middleName.charAt(0)}.` : ''}`;

/** A term's position in a diploma's sequence: Year 1 First is 10, Year 1 Second 11… */
const position = (s: { yearLevel: number; semesterPeriod: SemesterPeriod }) =>
  s.yearLevel * 10 + SEMESTER_PERIOD_ORDER[s.semesterPeriod];

/* ================================================================== */
/* Academic performance                                                */
/* ================================================================== */

type RowOutcome = 'PASSED' | 'FAILED' | 'INCOMPLETE' | 'UNGRADED' | 'SKIP';

/**
 * What one subject grade counts as in the report. A dropped subject (DRP) is
 * left out entirely — it was never completed either way — and a credited
 * one (CRD) is a pass.
 */
function outcomeOf(row: EnrollmentSubject): RowOutcome {
  if (row.finalGrade === null || row.finalGrade === 'NG') return 'UNGRADED';
  if (row.finalGrade === 'INC' && !row.completionGrade) return 'INCOMPLETE';
  const effective = effectiveGrade(row.finalGrade, row.completionGrade);
  if (effective === null) return 'UNGRADED';
  if (effective === 'DRP') return 'SKIP';
  if (effective === 'CRD') return 'PASSED';
  return isPassing(effective) ? 'PASSED' : 'FAILED';
}

function percentageOfRow(row: EnrollmentSubject): number | null {
  return row.finalGrade === 'INC' ? row.completionPercentage : row.finalPercentage;
}

/** A term's GWA when it is fully graded with no INC; null otherwise. */
function termGwa(rows: EnrollmentSubject[]): string | null {
  if (rows.length === 0) return null;
  if (rows.some((r) => outcomeOf(r) === 'UNGRADED' || outcomeOf(r) === 'INCOMPLETE')) return null;
  const result = computeGwa(rows);
  return result.countedUnits > 0 ? result.gwa : null;
}

interface AcademicTally {
  ids: Set<string>;
  graded: number;
  passed: number;
  failed: number;
  incomplete: number;
  ungraded: number;
  percentages: number[];
  gwas: number[];
  tiers: Map<string, 'DROP' | 'REVIEW'>;
}

const newTally = (): AcademicTally => ({
  ids: new Set(),
  graded: 0,
  passed: 0,
  failed: 0,
  incomplete: 0,
  ungraded: 0,
  percentages: [],
  gwas: [],
  tiers: new Map(),
});

function finishTally(t: AcademicTally): AcademicCounts {
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const avgGwa = mean(t.gwas);
  const avgPct = mean(t.percentages);
  const tiers = [...t.tiers.values()];
  return {
    trainees: t.ids.size,
    graded: t.graded,
    passed: t.passed,
    failed: t.failed,
    incomplete: t.incomplete,
    ungraded: t.ungraded,
    passRate: percent(t.passed, t.graded),
    averageGwa: avgGwa === null ? null : avgGwa.toFixed(3),
    averagePercentage: avgPct === null ? null : Math.round(avgPct * 10) / 10,
    forReview: tiers.filter((x) => x === 'REVIEW').length,
    recommendedDrop: tiers.filter((x) => x === 'DROP').length,
  };
}

function addRow(t: AcademicTally, studentId: string, row: EnrollmentSubject) {
  const outcome = outcomeOf(row);
  if (outcome === 'SKIP') return;
  t.ids.add(studentId);
  if (outcome === 'UNGRADED') t.ungraded += 1;
  else if (outcome === 'INCOMPLETE') t.incomplete += 1;
  else {
    t.graded += 1;
    if (outcome === 'PASSED') t.passed += 1;
    else t.failed += 1;
    const pct = percentageOfRow(row);
    if (pct !== null) t.percentages.push(pct);
  }
  const tier = standingTier(row);
  if (tier === 'DROP' || (tier === 'REVIEW' && t.tiers.get(studentId) !== 'DROP')) {
    t.tiers.set(studentId, tier);
  }
}

/**
 * How trainees did: pass rates, averages and the centre's standing line, by
 * diploma and by subject, with the strongest terms and the trainees below
 * the line named. Counts one trainee's one subject once; an INC counts as
 * incomplete until its completion is recorded, then as what it became.
 */
export function getAcademicReport(filters: ReportFilters = {}): AcademicReport {
  requireRole('REGISTRAR');
  const scope = resolveScope(filters, true);

  const totals = newTally();
  const byDiploma = new Map<string, AcademicTally>();
  const bySubject = new Map<string, AcademicSubjectRow & { tally: AcademicTally }>();
  const termRows: AcademicTraineeRow[] = [];
  const standing = new Map<string, AcademicTraineeRow>();

  for (const enrollment of db.enrollments) {
    const semester = scope.semesterById.get(enrollment.semesterId);
    if (!semester || enrollment.status === 'DROPPED') continue;
    const student = db.students.find((s) => s.id === enrollment.studentId);
    if (!student) continue;
    const prog = db.programs.find((p) => p.id === semester.programId);
    const termLabel = semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod);
    const rows = db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollment.id);

    let diploma = byDiploma.get(semester.programId);
    if (!diploma) {
      diploma = newTally();
      byDiploma.set(semester.programId, diploma);
    }

    let lowest: number | null = null;
    for (const row of rows) {
      addRow(totals, student.id, row);
      addRow(diploma, student.id, row);

      const subject = db.subjects.find((s) => s.id === row.subjectId);
      const key = `${semester.id}|${row.subjectId}`;
      let subjectRow = bySubject.get(key);
      if (!subjectRow) {
        subjectRow = {
          key,
          programCode: prog?.code ?? '—',
          subjectCode: subjectLabel(subject),
          subjectTitle: subject?.title ?? 'Unknown subject',
          termLabel,
          trainees: 0,
          passed: 0,
          failed: 0,
          incomplete: 0,
          passRate: null,
          averagePercentage: null,
          tally: newTally(),
        };
        bySubject.set(key, subjectRow);
      }
      addRow(subjectRow.tally, student.id, row);

      const pct = percentageOfRow(row);
      if (pct !== null && outcomeOf(row) !== 'SKIP') {
        lowest = lowest === null ? pct : Math.min(lowest, pct);
      }
    }

    const gwa = termGwa(rows);
    if (gwa !== null) {
      totals.gwas.push(Number(gwa));
      diploma.gwas.push(Number(gwa));
    }

    const traineeRow: AcademicTraineeRow = {
      studentId: student.id,
      studentNumber: student.studentNumber,
      name: shortName(student),
      programCode: prog?.code ?? '—',
      termLabel,
      gwa: gwa ?? '—',
      lowestPercentage: lowest,
      recommendation: null,
    };
    if (gwa !== null) termRows.push(traineeRow);

    // The standing list names each trainee once, at their worst tier.
    const tiers = rows.map(standingTier).filter((x): x is 'DROP' | 'REVIEW' => x !== null);
    if (tiers.length > 0) {
      const tier = tiers.includes('DROP') ? 'DROP' : 'REVIEW';
      const existing = standing.get(student.id);
      if (!existing || (tier === 'DROP' && existing.recommendation !== 'DROP')) {
        standing.set(student.id, { ...traineeRow, recommendation: tier });
      } else if (existing.lowestPercentage !== null && lowest !== null) {
        existing.lowestPercentage = Math.min(existing.lowestPercentage, lowest);
      }
    }
  }

  const diplomaRows: AcademicDiplomaRow[] = [...byDiploma.entries()]
    .map(([programId, tally]) => {
      const prog = db.programs.find((p) => p.id === programId);
      return { programId, code: prog?.code ?? '—', name: prog?.name ?? '', ...finishTally(tally) };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const subjectRows: AcademicSubjectRow[] = [...bySubject.values()]
    .map(({ tally, ...row }) => {
      const counts = finishTally(tally);
      return {
        ...row,
        trainees: counts.trainees,
        passed: counts.passed,
        failed: counts.failed,
        incomplete: counts.incomplete,
        passRate: counts.passRate,
        averagePercentage: counts.averagePercentage,
      };
    })
    .sort(
      (a, b) =>
        (a.passRate ?? 101) - (b.passRate ?? 101) ||
        (a.averagePercentage ?? 101) - (b.averagePercentage ?? 101) ||
        a.subjectCode.localeCompare(b.subjectCode),
    );

  return {
    schoolYearLabel: scope.year.label,
    periodLabel: scope.periodLabel,
    programLabel: scope.programLabel,
    totals: finishTally(totals),
    byDiploma: diplomaRows,
    bySubject: subjectRows,
    topPerformers: termRows
      .sort((a, b) => Number(a.gwa) - Number(b.gwa) || a.name.localeCompare(b.name))
      .slice(0, 10),
    standing: [...standing.values()].sort(
      (a, b) =>
        (a.recommendation === 'DROP' ? 0 : 1) - (b.recommendation === 'DROP' ? 0 : 1) ||
        (a.lowestPercentage ?? 101) - (b.lowestPercentage ?? 101),
    ),
    generatedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Retention & departures                                              */
/* ================================================================== */

/**
 * Retention is a measure, not a status: of the trainees who finished a term,
 * how many went on to the next. It is only counted once the outcome is
 * known — a trainee whose next term is still open and who has not left is
 * "awaiting", in neither the numerator nor the denominator, so the rate is
 * not dragged down by enrolment that simply has not happened yet.
 *
 * Departures come from the reason recorded when a trainee is dropped, split
 * into those the centre initiated and those the trainee did.
 */
export function getRetentionReport(filters: ReportFilters = {}): RetentionReport {
  requireRole('REGISTRAR');
  const scope = resolveScope(filters, false);

  const terms: RetentionTermRow[] = [];
  const codeOf = (programId: string) => db.programs.find((p) => p.id === programId)?.code ?? '';
  const sorted = [...scope.semesters].sort(
    (a, b) => codeOf(a.programId).localeCompare(codeOf(b.programId)) || position(a) - position(b),
  );

  for (const semester of sorted) {
    const enrolled = db.enrollments.filter((e) => e.semesterId === semester.id);
    if (enrolled.length === 0) continue;
    const programSemesters = db.semesters.filter((s) => s.programId === semester.programId);
    const steps = [...new Set(programSemesters.map(position))].sort((a, b) => a - b);
    const nextStep: number | undefined = steps[steps.indexOf(position(semester)) + 1];
    const nextSemesters =
      nextStep === undefined ? [] : programSemesters.filter((s) => position(s) === nextStep);
    const nextLabel = nextSemesters[0]
      ? semesterPeriodLabel(nextSemesters[0].yearLevel, nextSemesters[0].semesterPeriod)
      : 'End of curriculum';

    const row: RetentionTermRow = {
      key: semester.id,
      programCode: codeOf(semester.programId) || '—',
      termLabel: semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod),
      nextTermLabel: nextLabel,
      enrolled: 0,
      inProgress: 0,
      continued: 0,
      awaiting: 0,
      departed: 0,
      completedProgramme: 0,
      retentionRate: null,
    };

    const seen = new Set<string>();
    for (const enrollment of enrolled) {
      if (seen.has(enrollment.studentId)) continue;
      seen.add(enrollment.studentId);
      const student = db.students.find((s) => s.id === enrollment.studentId);
      if (!student) continue;
      row.enrolled += 1;

      const wentOn = db.enrollments.some(
        (e) =>
          e.studentId === student.id &&
          e.status !== 'DROPPED' &&
          nextSemesters.some((s) => s.id === e.semesterId),
      );
      const rows = db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollment.id);
      const finished =
        enrollment.status === 'COMPLETED' ||
        (rows.length > 0 && rows.every((r) => r.finalGrade !== null));

      if (wentOn) row.continued += 1;
      else if (student.status === 'DROPPED' || enrollment.status === 'DROPPED') row.departed += 1;
      else if (!finished) row.inProgress += 1;
      else if (nextStep === undefined) row.completedProgramme += 1;
      else row.awaiting += 1;
    }
    row.retentionRate = percent(row.continued, row.continued + row.departed);
    terms.push(row);
  }

  const continued = terms.reduce((sum, t) => sum + t.continued, 0);
  const departedSum = terms.reduce((sum, t) => sum + t.departed, 0);
  const awaiting = terms.reduce((sum, t) => sum + t.awaiting, 0);

  // Departures dated within the school year; one with no date counts when
  // the trainee was enrolled that year.
  const yearSemesterIds = new Set(
    db.semesters.filter((s) => s.academicYearId === scope.year.id).map((s) => s.id),
  );
  const enrolledThisYear = new Set(
    db.enrollments.filter((e) => yearSemesterIds.has(e.semesterId)).map((e) => e.studentId),
  );
  const departedStudents = db.students.filter((s) => {
    if (s.status !== 'DROPPED') return false;
    if (scope.program && s.programId !== scope.program.id) return false;
    if (s.departedAt) {
      const day = s.departedAt.slice(0, 10);
      return day >= scope.year.startDate && day <= scope.year.endDate;
    }
    return enrolledThisYear.has(s.id);
  });

  const reasonCounts = new Map<DepartureReason, number>();
  let unrecorded = 0;
  const departures: DepartureTraineeRow[] = departedStudents.map((s) => {
    const reason = s.departureReason;
    if (reason) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    else unrecorded += 1;
    return {
      studentId: s.id,
      studentNumber: s.studentNumber,
      name: shortName(s),
      programCode: codeOf(s.programId) || '—',
      yearLevel: s.yearLevel,
      reasonLabel: reason ? DEPARTURE_REASON_LABELS[reason] : 'Not recorded',
      institutionInitiated: reason ? isInstitutionInitiated(reason) : false,
      note: s.departureNote ?? '',
      departedAt: s.departedAt ?? null,
    };
  });

  const byReason: DepartureReasonRow[] = ALL_DEPARTURE_REASONS.map((reason) => ({
    reason,
    label: DEPARTURE_REASON_LABELS[reason],
    institutionInitiated: isInstitutionInitiated(reason),
    count: reasonCounts.get(reason) ?? 0,
  }));

  return {
    schoolYearLabel: scope.year.label,
    programLabel: scope.programLabel,
    terms,
    overall: {
      continued,
      departed: departedSum,
      awaiting,
      retentionRate: percent(continued, continued + departedSum),
    },
    departuresByReason: byReason,
    centreInitiated: byReason
      .filter((r) => r.institutionInitiated)
      .reduce((sum, r) => sum + r.count, 0),
    traineeInitiated: byReason
      .filter((r) => !r.institutionInitiated)
      .reduce((sum, r) => sum + r.count, 0),
    unrecorded,
    departures: departures.sort(
      (a, b) => a.programCode.localeCompare(b.programCode) || a.name.localeCompare(b.name),
    ),
    generatedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Completion                                                          */
/* ================================================================== */

/**
 * Who has finished their diploma, and who is close.
 *
 * "Completed" is measured against the trainee's own curriculum — every
 * required subject passed (or credited) — not against a term count, so a
 * trainee who took a subject late or repeated one is judged on what they
 * actually hold. Like the standing review this is advisory: it names who is
 * eligible for graduation, and marking them Graduated stays with the
 * Registrar.
 *
 * A completion is not bound to one school year: the report lists everyone
 * who has finished, with the school year they finished in.
 */
export function getCompletionReport(filters: ReportFilters = {}): CompletionReport {
  requireRole('REGISTRAR');
  const scope = resolveScope(filters, false);

  const completed: CompletionRow[] = [];
  const nearing: CompletionRow[] = [];
  let inProgress = 0;

  for (const student of db.students) {
    if (['PENDING', 'REJECTED', 'DROPPED'].includes(student.status)) continue;
    if (student.archivedAt || !student.curriculumId) continue;
    if (scope.program && student.programId !== scope.program.id) continue;
    const prog = db.programs.find((p) => p.id === student.programId);
    const curriculum = db.curricula.find((c) => c.id === student.curriculumId);

    const mappings = db.programSubjects
      .filter((ps) => ps.curriculumId === student.curriculumId && ps.isRequired)
      .sort((a, b) => position(a) - position(b));
    if (mappings.length === 0) continue;

    const enrollments = db.enrollments.filter(
      (e) => e.studentId === student.id && e.status !== 'DROPPED',
    );
    const enrollmentIds = new Set(enrollments.map((e) => e.id));
    const rows = db.enrollmentSubjects.filter((es) => enrollmentIds.has(es.enrollmentId));
    const passedIds = new Set(
      rows.filter((r) => outcomeOf(r) === 'PASSED').map((r) => r.subjectId),
    );

    let unitsRequired = 0;
    let unitsEarned = 0;
    const remaining: string[] = [];
    for (const mapping of mappings) {
      const subject = db.subjects.find((s) => s.id === mapping.subjectId);
      const units = subject?.units ?? 0;
      unitsRequired += units;
      if (passedIds.has(mapping.subjectId)) unitsEarned += units;
      else remaining.push(subjectLabel(subject));
    }

    // The school year of their latest term, for those who have finished.
    const latest = enrollments
      .map((e) => db.semesters.find((s) => s.id === e.semesterId))
      .filter((s): s is Semester => Boolean(s))
      .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
    const latestYear = latest
      ? db.academicYears.find((y) => y.id === latest.academicYearId)
      : undefined;

    const row: CompletionRow = {
      studentId: student.id,
      studentNumber: student.studentNumber,
      name: shortName(student),
      programCode: prog?.code ?? '—',
      curriculumYear: curriculum?.effectiveYear ?? '—',
      yearLevel: student.yearLevel,
      subjectsPassed: mappings.length - remaining.length,
      subjectsRequired: mappings.length,
      unitsEarned,
      unitsRequired,
      remaining,
      gwa: computeGwa(rows).gwa,
      studentStatus: STUDENT_STATUS_LABELS[student.status],
      finishedIn: remaining.length === 0 ? (latestYear?.label ?? null) : null,
    };

    if (remaining.length === 0) completed.push(row);
    else if (prog && student.yearLevel >= prog.yearsToComplete) nearing.push(row);
    else inProgress += 1;
  }

  const byName = (a: CompletionRow, b: CompletionRow) =>
    a.programCode.localeCompare(b.programCode) || a.name.localeCompare(b.name);
  return {
    schoolYearLabel: scope.year.label,
    programLabel: scope.programLabel,
    completed: completed.sort(byName),
    nearing: nearing.sort((a, b) => a.remaining.length - b.remaining.length || byName(a, b)),
    inProgress,
    generatedAt: new Date().toISOString(),
  };
}

/* ================================================================== */
/* Statistical summary                                                 */
/* ================================================================== */

/**
 * One page for management: the other four reports' headline figures for the
 * school year, and a line per diploma. Built by calling those reports rather
 * than recounting, so the summary cannot disagree with the detail behind it.
 */
export function getSummaryReport(filters: ReportFilters = {}): SummaryReport {
  requireRole('REGISTRAR');
  const scope = resolveScope(filters, false);
  const base = { academicYearId: scope.year.id, programId: scope.program?.id };

  const enrollment = getEnrollmentReport(base);
  const academic = getAcademicReport(base);
  const retention = getRetentionReport(base);
  const completion = getCompletionReport(base);

  // A school year's admission cycle opens six months before its classes do:
  // applicants for an August intake apply from February. Counting only
  // applications made inside the school year itself missed nearly all of them.
  const cycleStart = shiftMonths(scope.year.startDate, -6);
  const cycleEnd = shiftMonths(scope.year.endDate, -6);
  const applicants = db.students.filter((s) => {
    if (scope.program && s.programId !== scope.program.id) return false;
    const day = s.createdAt.slice(0, 10);
    return day >= cycleStart && day <= cycleEnd;
  });

  const byDiploma: SummaryDiplomaRow[] = enrollment.byDiploma.map((e) => {
    const a = academic.byDiploma.find((r) => r.programId === e.programId);
    const termRows = retention.terms.filter((t) => t.programCode === e.code);
    const cont = termRows.reduce((sum, t) => sum + t.continued, 0);
    const dep = termRows.reduce((sum, t) => sum + t.departed, 0);
    return {
      programId: e.programId,
      code: e.code,
      name: e.name,
      enrolled: e.trainees,
      male: e.male,
      female: e.female,
      passRate: a?.passRate ?? null,
      averageGwa: a?.averageGwa ?? null,
      retentionRate: percent(cont, cont + dep),
      departed: retention.departures.filter((d) => d.programCode === e.code).length,
      completed: completion.completed.filter((c) => c.programCode === e.code).length,
    };
  });

  const yearSemesterIds = new Set(scope.semesters.map((s) => s.id));
  return {
    schoolYearLabel: scope.year.label,
    programLabel: scope.programLabel,
    applications: {
      received: applicants.length,
      approved: applicants.filter((s) => !['PENDING', 'REJECTED'].includes(s.status)).length,
      pending: applicants.filter((s) => s.status === 'PENDING').length,
      rejected: applicants.filter((s) => s.status === 'REJECTED').length,
    },
    enrollment: enrollment.totals,
    academic: academic.totals,
    retention: retention.overall,
    departures: {
      total: retention.departures.length,
      centreInitiated: retention.centreInitiated,
      traineeInitiated: retention.traineeInitiated,
    },
    completed: completion.completed.length,
    capacity: {
      diplomas: scope.program ? 1 : db.programs.filter((p) => p.isActive).length,
      sections: db.sections.filter(
        (s) => s.isActive && (!scope.program || s.programId === scope.program.id),
      ).length,
      trainers: db.faculty.filter((f) => f.isActive).length,
      classes: db.classSchedules.filter(
        (c) => c.status === 'PUBLISHED' && yearSemesterIds.has(c.semesterId),
      ).length,
    },
    byDiploma,
    generatedAt: new Date().toISOString(),
  };
}
