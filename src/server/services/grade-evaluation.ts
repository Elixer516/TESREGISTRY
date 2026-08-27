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
import { semesterPeriodLabel } from '@/types';
import type {
  GradeEvaluationForm,
  GradeEvaluationGroup,
  GradeEvaluationRow,
  GradeEvaluationUnits,
} from '@/types/views';
import { db } from '../repositories/db';
import { getStudent, toStudentView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { computeGwa, effectiveGrade, gradeRemarks, isPassing } from './grade-rules';

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
  requireRole('REGISTRAR');
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
      const order = (p: string) => (p === 'FIRST' ? 1 : 2);
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
          courseCode: subject?.code ?? '—',
          courseTitle: subject?.title ?? 'Unknown subject',
          sectionCode: section?.code ?? '—',
          units: es.units,
          grade: es.finalGrade,
          completionGrade: es.completionGrade,
          prerequisites: prerequisiteText(mapping),
          remarks: gradeRemarks(es.finalGrade, es.completionGrade),
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
      }));
    everyRow.push(...gwaRows);
    const gwa = computeGwa(gwaRows);

    groups.push({
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

  return {
    student: toStudentView(student),
    // A stable, human-quotable handle for a form that is derived on read.
    referenceNumber: `GEF.${student.studentNumber.replace('-', '')}`,
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
    enrolled += row.units;
    if (row.isPassed === null) continue;
    considered += row.units;
    if (row.isPassed) passed += row.units;
    else noCredit += row.units;
  }
  return { enrolled, considered, passed, noCredit };
}
