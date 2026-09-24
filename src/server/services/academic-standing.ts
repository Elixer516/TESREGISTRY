/**
 * Academic standing review — who the registrar should look at, and why.
 *
 * The centre's retention line sits above TESDA's passing grade. KorPhil
 * reviews every trainee with a subject at **79% or below**, in two tiers:
 *
 *   75% and below   grounds for dropping — recommended for drop.
 *   76% to 79%      flagged for review — the registrar looks, and decides.
 *
 * These are the centre's standards, not the grading scale's: 75% still
 * transmutes to 3.00 and prints PASSED on the Grade Evaluation, because the
 * grade is TESDA's and the retention decision is the centre's. A subject
 * with no credit at all (4.00 or 5.00) is below both lines regardless.
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
 * The percentage is the trainer's own entry. A record graded before
 * percentages were captured has only its grade, and is judged on that: no
 * credit counts as grounds, anything passing does not. A resolved INC is
 * judged on its completion, since that is what the trainee actually
 * achieved. An unresolved INC is reported separately: it is unfinished work
 * rather than failed work, and dropping somebody over one would be wrong.
 */

import type { EnrollmentSubject } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type { StudentView } from '@/types/views';
import { db } from '../repositories/db';
import { toStudentView,
  subjectLabel,
} from '../repositories/lookups';
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
  /** The percentage behind it, where one was entered. */
  percentage: number | null;
  /** The circular's adjectival description for that grade. */
  descriptor: string;
  termLabel: string;
  academicYearLabel: string;
}

/** At or below this, a subject is grounds for dropping. */
export const DROP_AT_OR_BELOW = 75;
/** At or below this (and above the drop line), a subject is flagged for review. */
export const REVIEW_AT_OR_BELOW = 79;

export interface StandingReview {
  student: StudentView;
  /** DROP when any subject is at 75% or below; REVIEW when the lowest is 76–79%. */
  recommendation: 'DROP' | 'REVIEW';
  /** Subjects at 75% or below, or with no credit — the grounds for a drop. */
  noCredit: StandingSubject[];
  /** Subjects at 76–79%: below the centre's line, not yet grounds. */
  forReview: StandingSubject[];
  /** Unfinished, not failed. Shown as context; never grounds for a drop. */
  unresolvedInc: StandingSubject[];
  /** Units the trainee carries no credit for. */
  noCreditUnits: number;
  /** True once the registrar has already acted — kept visible, not hidden. */
  alreadyDropped: boolean;
}

function describe(
  row: EnrollmentSubject,
  grade: string,
  percentage: number | null = null,
): StandingSubject {
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
    subjectCode: subjectLabel(subject),
    subjectTitle: subject?.title ?? 'Unknown subject',
    units: row.units,
    grade,
    percentage,
    descriptor: gradeDescriptor(grade),
    termLabel: semester
      ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod)
      : '—',
    academicYearLabel: year?.label ?? '—',
  };
}

/**
 * Every trainee with a subject at 79% or below, those recommended for a
 * drop first.
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
    const forReview: StandingSubject[] = [];
    const unresolvedInc: StandingSubject[] = [];

    for (const row of rows) {
      if (row.finalGrade === null) continue;

      if (row.finalGrade === 'INC' && !row.completionGrade) {
        unresolvedInc.push(describe(row, 'INC'));
        continue;
      }

      const effective = effectiveGrade(row.finalGrade, row.completionGrade);
      if (effective === null) continue;
      const percentage =
        row.finalGrade === 'INC' ? row.completionPercentage : row.finalPercentage;

      if (!isPassing(effective) || (percentage !== null && percentage <= DROP_AT_OR_BELOW)) {
        noCredit.push(describe(row, effective, percentage));
      } else if (percentage !== null && percentage <= REVIEW_AT_OR_BELOW) {
        forReview.push(describe(row, effective, percentage));
      }
    }

    if (noCredit.length === 0 && forReview.length === 0) continue;

    reviews.push({
      student: toStudentView(student),
      recommendation: noCredit.length > 0 ? 'DROP' : 'REVIEW',
      noCredit,
      forReview,
      unresolvedInc,
      noCreditUnits: noCredit.reduce((sum, s) => sum + s.units, 0),
      alreadyDropped: student.status === 'DROPPED',
    });
  }

  // Outstanding cases first, then the heaviest — the registrar works down.
  return reviews.sort((a, b) => {
    if (a.alreadyDropped !== b.alreadyDropped) return a.alreadyDropped ? 1 : -1;
    if (a.recommendation !== b.recommendation) return a.recommendation === 'DROP' ? -1 : 1;
    if (b.noCredit.length !== a.noCredit.length) {
      return b.noCredit.length - a.noCredit.length;
    }
    return a.student.lastFirstName.localeCompare(b.student.lastFirstName);
  });
}
