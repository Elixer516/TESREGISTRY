/**
 * The Guidance Office's submission monitor: who has answered the Faculty
 * Evaluation and who still owes one. It says that a trainee answered, never
 * what they answered. The results Guidance reads are the combined, per-class
 * figures (listEvaluationResults).
 */

import type { EnrollmentSubject } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type { GuidanceSubmissionRow } from '@/types/views';
import { lastFirst } from '@/lib/format';
import { db } from '../repositories/db';
import { batchOfStudent, facultyDisplayName, subjectLabel } from '../repositories/lookups';
import { requireRole } from '../auth';
import { evaluationOf } from './faculty-evaluations';
import { effectiveGrade } from './grade-rules';

/** The same rule the trainee's portal uses: a taught subject with a trainer, not dropped or credited. */
function evaluable(row: EnrollmentSubject): boolean {
  if (!row.classScheduleId) return false;
  const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
  if (!schedule?.facultyId) return false;
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  if (!enrollment || enrollment.status === 'DROPPED') return false;
  const effective = effectiveGrade(row.finalGrade, row.completionGrade);
  return effective !== 'CRD' && effective !== 'DRP';
}

function toRow(row: EnrollmentSubject): GuidanceSubmissionRow | null {
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  const student = enrollment ? db.students.find((s) => s.id === enrollment.studentId) : undefined;
  const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
  const semester = enrollment ? db.semesters.find((s) => s.id === enrollment.semesterId) : undefined;
  if (!enrollment || !student || !schedule || !semester) return null;
  const year = db.academicYears.find((y) => y.id === semester.academicYearId);
  const program = db.programs.find((p) => p.id === semester.programId);
  const subject = db.subjects.find((s) => s.id === row.subjectId);
  const section = db.sections.find((s) => s.id === schedule.sectionId);
  const answer = evaluationOf(row.id);
  return {
    enrollmentSubjectId: row.id,
    studentId: student.id,
    studentNumber: student.studentNumber,
    studentName: lastFirst(student),
    programCode: program?.code ?? '—',
    programName: program?.name ?? '',
    yearLevel: semester.yearLevel,
    sectionCode: section?.code ?? '—',
    batch: batchOfStudent(student),
    classScheduleId: schedule.id,
    subjectCode: subjectLabel(subject),
    subjectTitle: subject?.title ?? '',
    facultyId: schedule.facultyId ?? '',
    trainerName: facultyDisplayName(schedule.facultyId),
    semesterId: semester.id,
    academicYearLabel: year?.label ?? '—',
    semesterPeriod: semester.semesterPeriod,
    termLabel: semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod),
    semesterIsActive: semester.isActive,
    status: answer ? 'SUBMITTED' : row.finalGrade === null ? 'NOT_OPEN' : 'PENDING',
    submittedAt: answer?.submittedAt ?? null,
  };
}

/**
 * Every trainee × subject that asks for an evaluation, answered or not. The
 * page filters and groups these itself, so one read serves every view.
 */
export function listGuidanceSubmissions(): GuidanceSubmissionRow[] {
  requireRole('GUIDANCE');
  return db.enrollmentSubjects
    .filter(evaluable)
    .map(toRow)
    .filter((r): r is GuidanceSubmissionRow => r !== null)
    .sort(
      (a, b) =>
        b.academicYearLabel.localeCompare(a.academicYearLabel) ||
        a.studentName.localeCompare(b.studentName) ||
        a.subjectCode.localeCompare(b.subjectCode),
    );
}
