/**
 * Reports — FR-15.2.
 *
 * Every report here is derived on read from records that already exist, the
 * same way the Grade Evaluation is: nothing is stored, so a report printed
 * today cannot disagree with the enrolments it counts.
 *
 * The Enrollment report comes first because it is the one a registrar is
 * asked for most: who is enrolled this school year, in which diploma, year
 * level and section, how many are new and how many are continuing, split by
 * sex the way TESDA reporting expects.
 */

import type { Enrollment, SemesterPeriod, Student } from '@/types';
import { SEMESTER_PERIOD_LABELS, semesterPeriodLabel } from '@/types';
import type {
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
