/**
 * The trainee's confirmation that they have seen a term's grades.
 *
 * Before a trainee is enrolled into their next semester they confirm, on
 * their own Grade Evaluation, that they have viewed the grades of the term
 * just finished. It closes the gap where a trainee learns of a failing grade
 * or an INC only after the next term's load has been set around it.
 *
 * A confirmation covers the grades as they stood when it was given. If a
 * grade in that term changes afterwards — an INC completed, a correction
 * approved — the confirmation no longer covers what is on record and is
 * asked for again. That is the difference between "viewed the grades" and
 * "once clicked a button".
 */

import type { Enrollment } from '@/types';
import { semesterPeriodLabel } from '@/types';
import { ApiError, badRequest, notFound } from '@/lib/api-error';
import { db, nowIso } from '../repositories/db';
import { recordAudit } from './audit';
import { requireRole } from '../auth';

export interface GradeViewStatus {
  /** Every subject in the term has a grade, so there is something to confirm. */
  ready: boolean;
  /** When the trainee confirmed, if that confirmation still covers the record. */
  viewedAt: string | null;
  /** Ready and not (validly) confirmed — the state that blocks enrolment. */
  pending: boolean;
}

/**
 * What the term's grades are right now, as one string. Compared rather than
 * timestamps, because it asks the question that matters — "is this what the
 * trainee saw?" — and cannot be fooled by a clock.
 */
export function gradeSignature(enrollmentId: string): string {
  return db.enrollmentSubjects
    .filter((es) => es.enrollmentId === enrollmentId)
    .map((es) => `${es.id}:${es.finalGrade ?? ''}:${es.completionGrade ?? ''}`)
    .sort()
    .join('|');
}

export function gradeViewStatus(enrollment: Enrollment): GradeViewStatus {
  const rows = db.enrollmentSubjects.filter((es) => es.enrollmentId === enrollment.id);
  // An INC is not a finished grade until its completion is recorded.
  const ready =
    rows.length > 0 &&
    rows.every((r) => (r.finalGrade === 'INC' ? r.completionGrade : r.finalGrade) !== null);
  const viewedAt =
    enrollment.gradesViewedAt &&
    enrollment.gradesViewedSignature === gradeSignature(enrollment.id)
      ? enrollment.gradesViewedAt
      : null;
  return { ready, viewedAt, pending: ready && viewedAt === null };
}

/** The trainee confirms they have viewed one term's grades. Trainee only, own record. */
export function confirmGradesViewed(enrollmentId: string): void {
  const user = requireRole('TRAINEE');
  const enrollment = db.enrollments.find((e) => e.id === enrollmentId);
  if (!enrollment) throw notFound('That term could not be found.');
  if (enrollment.studentId !== user.studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only confirm your own grades.');
  }
  const status = gradeViewStatus(enrollment);
  if (!status.ready) {
    throw badRequest('Not every grade for this term is in yet. You can confirm once they are.');
  }
  if (status.viewedAt) return;

  enrollment.gradesViewedAt = nowIso();
  enrollment.gradesViewedSignature = gradeSignature(enrollment.id);
  const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
  recordAudit({
    action: 'GRADES_VIEWED',
    recordType: 'Enrollment',
    recordId: enrollment.id,
    actor: user,
    detail: `Confirmed viewing their ${
      semester ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod) : 'term'
    } grades on the Grade Evaluation.`,
  });
}
