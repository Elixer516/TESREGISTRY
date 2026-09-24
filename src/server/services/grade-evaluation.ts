/**
 * The Grade Evaluation Form.
 *
 * A compiled record of one trainee's grades from First Year, First Semester
 * to the present — a report card that also shows what each subject required
 * before it could be taken.
 *
 * Derived on read, never stored. Grades change when a corrected grading sheet
 * is approved, and a stored copy would quietly go stale; deriving means the
 * form always reflects the record as it stands. The consequence, accepted
 * deliberately, is that a form printed today may differ from one printed last
 * month. If an official frozen copy is ever needed, that becomes a separate
 * "issue" action rather than a change to this.
 *
 * It generates whether or not every grading sheet is in. Missing entries show
 * as blank rather than blocking the registrar — an incomplete evaluation is
 * often exactly what they need to see.
 */

import type { ProgramSubject } from '@/types';
import type { SemesterPeriod } from '@/types';
import { SEMESTER_PERIOD_ORDER, semesterPeriodLabel } from '@/types';
import type {
  GradeEvaluationForm,
  GradeEvaluationGroup,
  GradeEvaluationRow,
  GradeEvaluationUnits,
} from '@/types/views';
import { db } from '../repositories/db';
import { facultyDisplayName, getStudent, toStudentView } from '../repositories/lookups';
import { currentUser } from '../auth';
import { ApiError } from '@/lib/api-error';
import {
  computeGwa,
  effectiveGrade,
  gradeRemarks,
  isPassing,
  percentageFor,
} from './grade-rules';

/**
 * How the prerequisite column reads.
 *
 * The stored note is the curriculum's own wording and takes precedence,
 * because that is what the registrar expects to see printed. The structured
 * fields are the fallback for rows imported without one.
 */
function prerequisiteText(mapping: ProgramSubject | undefined): string {
  if (!mapping) return '';
  if (mapping.prerequisiteNote.trim()) return mapping.prerequisiteNote.trim();

  const parts: string[] = [];
  for (const id of mapping.prerequisiteSubjectIds) {
    const subject = db.subjects.find((s) => s.id === id);
    if (subject) parts.push(subject.code);
  }
  if (mapping.prerequisiteStanding) {
    parts.push(`Year ${mapping.prerequisiteStanding} standing`);
  }
  return parts.join(', ');
}

export function getGradeEvaluation(studentId: string): GradeEvaluationForm {
  // A trainee may read their own evaluation and no one else's — the portal's
  // My Grades shows exactly the form the registrar sees, so the two can never
  // disagree about their grades.
  const user = currentUser();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first.');
  if (user.role === 'TRAINEE' && user.studentId !== studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only view your own grade evaluation.');
  }
  if (user.role !== 'REGISTRAR' && user.role !== 'TRAINEE') {
    throw new ApiError(403, 'FORBIDDEN', 'Only the Registrar may generate this form.');
  }
  const student = getStudent(studentId);

  const enrollments = db.enrollments
    .filter((e) => e.studentId === studentId)
    .map((enrollment) => {
      const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
      return { enrollment, semester };
    })
    .filter((pair): pair is { enrollment: typeof pair.enrollment; semester: NonNullable<typeof pair.semester> } =>
      Boolean(pair.semester),
    )
    // First Year First Semester onwards, in the order they were taken.
    .sort((a, b) => {
      if (a.semester.yearLevel !== b.semester.yearLevel) {
        return a.semester.yearLevel - b.semester.yearLevel;
      }
      const order = (p: SemesterPeriod) => SEMESTER_PERIOD_ORDER[p];
      return order(a.semester.semesterPeriod) - order(b.semester.semesterPeriod);
    });

  const groups: GradeEvaluationGroup[] = [];
  const everyRow: Array<{ units: number; finalGrade: string | null; completionGrade: string | null }> = [];

  for (const { enrollment, semester } of enrollments) {
    const rows: GradeEvaluationRow[] = db.enrollmentSubjects
      .filter((es) => es.enrollmentId === enrollment.id)
      .map((es) => {
        const subject = db.subjects.find((s) => s.id === es.subjectId);
        const mapping = student.curriculumId
          ? db.programSubjects.find(
              (ps) => ps.curriculumId === student.curriculumId && ps.subjectId === es.subjectId,
            )
          : undefined;
        const effective = effectiveGrade(es.finalGrade, es.completionGrade);

        // The section the class ran under, as the sample form prints it.
        const schedule = es.classScheduleId
          ? db.classSchedules.find((c) => c.id === es.classScheduleId)
          : undefined;
        const section = schedule
          ? db.sections.find((sec) => sec.id === schedule.sectionId)
          : undefined;

        return {
          enrollmentSubjectId: es.id,
          courseCode: subject?.code.trim() ?? '',
          courseTitle: subject?.title ?? 'Unknown subject',
          sectionCode: section?.code ?? '—',
          units: es.units,
          grade: es.finalGrade,
          completionGrade: es.completionGrade,
          prerequisites: prerequisiteText(mapping),
          remarks: gradeRemarks(es.finalGrade, es.completionGrade),
          // The trainer who handled the class. Read from the class schedule
          // rather than the subject, because a subject is taught by different
          // trainers in different sections and terms.
          trainerName: schedule ? facultyDisplayName(schedule.facultyId) : '',
          // What the trainer actually entered. Records graded before
          // percentages were captured fall back to the band the grade point
          // stands for, so an older transcript still prints something true
          // rather than an empty column.
          percentage:
            es.finalPercentage !== null
              ? `${es.finalPercentage}%`
              : percentageFor(es.finalGrade),
          // A term still running has no grades yet, and the centre's form says
          // ENROLLED rather than leaving the row looking unfinished.
          status: es.finalGrade === null ? 'ENROLLED' : '',
          excludedFromGwa: es.excludedFromGwa,
          // Null means "no grade yet" rather than "failed" — the distinction
          // matters on a form the trainee may be shown.
          isPassed: effective === null ? null : isPassing(effective),
        };
      })
      .sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const gwaRows = db.enrollmentSubjects
      .filter((es) => es.enrollmentId === enrollment.id)
      .map((es) => ({
        units: es.units,
        finalGrade: es.finalGrade,
        completionGrade: es.completionGrade,
        excludedFromGwa: es.excludedFromGwa,
      }));
    everyRow.push(...gwaRows);
    const gwa = computeGwa(gwaRows);

    // "(DEC 11, 2025 - MAY 8, 2026)" on a term that has run; the centre's own
    // form prints "(TBA)" for one whose dates are not settled.
    const coverage =
      semester.startDate && semester.endDate
        ? `(${formatFormDate(semester.startDate)} - ${formatFormDate(semester.endDate)})`
        : '(TBA)';
    const inProgress = rows.length > 0 && rows.every((r) => r.grade === null);

    groups.push({
      coverage,
      inProgress,
      semesterId: semester.id,
      label: semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod),
      academicYearLabel:
        db.academicYears.find((y) => y.id === semester.academicYearId)?.label ?? '—',
      yearLevel: semester.yearLevel,
      rows,
      totalUnits: gwa.totalUnits,
      gwa: gwa.gwa,
      hasUnresolvedInc: gwa.hasUnresolvedInc,
      units: unitsSummary(rows),
    });
  }

  const overall = computeGwa(everyRow);
  const ungraded = everyRow.filter(
    (r) => effectiveGrade(r.finalGrade, r.completionGrade) === null,
  ).length;

  const allRows = groups.flatMap((g) => g.rows);

  const curriculum = student.curriculumId
    ? db.curricula.find((c) => c.id === student.curriculumId)
    : undefined;
  const section = student.sectionId
    ? db.sections.find((sec) => sec.id === student.sectionId)
    : undefined;

  return {
    student: toStudentView(student),
    // A stable, human-quotable handle for a form that is derived on read.
    referenceNumber: `GEF.${student.studentNumber.replace('-', '')}`,
    // The year of the curriculum edition this trainee is bound to: an intake
    // under the 2025 curriculum is Batch 2025, a trainee still finishing the
    // 2022 edition is Batch 2022. Only the year prints — the centre's form
    // does not carry the effectivity wording.
    batchLabel: curriculum ? batchYear(curriculum.effectiveYear) : '—',
    sectionLabel: section?.code ?? '—',
    unitsEnrolled: groups
      .filter((g) => g.inProgress)
      .reduce((sum, g) => sum + g.totalUnits, 0),
    groups,
    totalUnits: overall.totalUnits,
    overallGwa: overall.gwa,
    hasUnresolvedInc: overall.hasUnresolvedInc,
    ungradedCount: ungraded,
    units: unitsSummary(allRows),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * The first year written in a curriculum's effectivity. A registrar may type
 * a whole phrase there on a new curriculum; the phrase prints as-is only when
 * it holds no year at all.
 */
function batchYear(effectiveYear: string): string {
  return /\b(19|20)\d{2}\b/.exec(effectiveYear)?.[0] ?? (effectiveYear.trim() || '—');
}

/** "DEC 11, 2025" — the centre's form writes its coverage dates this way. */
function formatFormDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month.toUpperCase()} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * The four unit buckets the sample form carries, plus what they mean here.
 *
 * ENROLLED   everything taken.
 * CONSIDERED what the average is computed from — a subject with no grade,
 *            or an unresolved INC, is not.
 * PASSED     3.00 or better.
 * NO CREDIT  graded but failed. Deliberately not the same as "not considered":
 *            an ungraded subject is neither passed nor failed.
 */
function unitsSummary(rows: GradeEvaluationRow[]): GradeEvaluationUnits {
  let enrolled = 0;
  let considered = 0;
  let passed = 0;
  let noCredit = 0;

  for (const row of rows) {
    // Every unit the trainee carries, NSTP and PE included. Only the weighted
    // average leaves them out.
    enrolled += row.units;
    if (row.isPassed === null) continue;
    considered += row.units;
    if (row.isPassed) passed += row.units;
    else noCredit += row.units;
  }
  return { enrolled, considered, passed, noCredit };
}
