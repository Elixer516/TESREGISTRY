/**
 * Academic standing review — who the registrar should look at, and why.
 *
 * A trainee carrying a subject they earned no credit for is a trainee whose
 * enrolment is in question. The centre's rule is that such a trainee stops
 * progressing and is dropped.
 *
 * **Nothing here drops anybody.** This module only compiles the list and the
 * evidence behind it; the decision and the action stay with the registrar.
 * That separation is the whole point. An automatic drop acts on a record the
 * moment a grade lands, which is exactly when a grade is most likely to be
 * wrong — a mis-keyed entry, a sheet approved in haste, an INC that was
 * always going to be resolved next week. Undoing an automatic drop means
 * reinstating a trainee, restoring an enrolment and explaining an audit
 * entry that says the system did it. Presenting the case and waiting costs
 * one click and is reversible by simply not clicking.
 *
 * So this is advisory by construction: a read-only query with no mutation in
 * the file, which is a stronger guarantee than a policy note saying the
 * registrar ought to confirm first.
 *
 * "No credit" is `grade-rules`' definition, not a second one restated here —
 * an effective grade worse than the 3.00 cutoff, which under TESDA Circular
 * 021 s. 2023 means 4.00 (Conditional) or 5.00 (Fail). A resolved INC is
 * judged on its completion grade, since that is what the trainee actually
 * achieved. An unresolved INC is reported separately: it is unfinished work
 * rather than failed work, and dropping somebody over one would be wrong.
 */

import type { EnrollmentSubject } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type { StudentView } from '@/types/views';
import { db } from '../repositories/db';
import { toStudentView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { effectiveGrade, gradeDescriptor, isPassing } from './grade-rules';

/** One subject behind a flag, in the words the registrar needs to see. */
export interface StandingSubject {
  enrollmentSubjectId: string;
  subjectCode: string;
  subjectTitle: string;
  units: number;
  /** The grade that counts — a resolved INC reports its completion grade. */
  grade: string;
  /** The circular's adjectival description for that grade. */
  descriptor: string;
  termLabel: string;
  academicYearLabel: string;
}

export interface StandingReview {
  student: StudentView;
  /** Subjects earning no credit. Non-empty for every returned review. */
  noCredit: StandingSubject[];
  /** Unfinished, not failed. Shown as context; never grounds for a drop. */
  unresolvedInc: StandingSubject[];
  /** Units the trainee carries no credit for. */
  noCreditUnits: number;
  /** True once the registrar has already acted — kept visible, not hidden. */
  alreadyDropped: boolean;
}

function describe(row: EnrollmentSubject, grade: string): StandingSubject {
  const subject = db.subjects.find((s) => s.id === row.subjectId);
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  const semester = enrollment
    ? db.semesters.find((s) => s.id === enrollment.semesterId)
    : undefined;
  const year = semester
    ? db.academicYears.find((y) => y.id === semester.academicYearId)
    : undefined;

  return {
    enrollmentSubjectId: row.id,
    subjectCode: subject?.code ?? '—',
    subjectTitle: subject?.title ?? 'Unknown subject',
    units: row.units,
    grade,
    descriptor: gradeDescriptor(grade),
    termLabel: semester
      ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod)
      : '—',
    academicYearLabel: year?.label ?? '—',
  };
}

/**
 * Every trainee carrying at least one no-credit subject, worst first.
 *
 * Applications and rejected records are excluded — there is no enrolment to
 * question. Already-dropped trainees are kept, flagged rather than filtered,
 * so the list reads as a complete account of who is affected rather than
 * quietly shrinking as the registrar works through it.
 */
export function listStandingReviews(): StandingReview[] {
  requireRole('REGISTRAR');

  const reviews: StandingReview[] = [];

  for (const student of db.students) {
    if (student.status === 'PENDING' || student.status === 'REJECTED') continue;
    if (student.archivedAt) continue;

    const rows = db.enrollments
      .filter((e) => e.studentId === student.id)
      .flatMap((e) => db.enrollmentSubjects.filter((es) => es.enrollmentId === e.id));

    const noCredit: StandingSubject[] = [];
    const unresolvedInc: StandingSubject[] = [];

    for (const row of rows) {
      if (row.finalGrade === null) continue;

      if (row.finalGrade === 'INC' && !row.completionGrade) {
        unresolvedInc.push(describe(row, 'INC'));
        continue;
      }

      const effective = effectiveGrade(row.finalGrade, row.completionGrade);
      if (effective === null) continue;
      if (!isPassing(effective)) noCredit.push(describe(row, effective));
    }

    if (noCredit.length === 0) continue;

    reviews.push({
      student: toStudentView(student),
      noCredit,
      unresolvedInc,
      noCreditUnits: noCredit.reduce((sum, s) => sum + s.units, 0),
      alreadyDropped: student.status === 'DROPPED',
    });
  }

  // Outstanding cases first, then the heaviest — the registrar works down.
  return reviews.sort((a, b) => {
    if (a.alreadyDropped !== b.alreadyDropped) return a.alreadyDropped ? 1 : -1;
    if (b.noCredit.length !== a.noCredit.length) {
      return b.noCredit.length - a.noCredit.length;
    }
    return a.student.lastFirstName.localeCompare(b.student.lastFirstName);
  });
}
