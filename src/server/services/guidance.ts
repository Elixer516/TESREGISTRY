/**
 * The Guidance Office: who has answered the Faculty Evaluation, and what each
 * trainee said.
 *
 * Guidance owns the centre's surveys, so it is the one office that may read
 * a single trainee's answers. Everyone else stays on the anonymous side: the
 * Registrar's report and a trainer's own results are combined figures, and
 * the audit trail records that Guidance opened a response, never what it said.
 */

import type { EnrollmentSubject } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type { GuidanceResponseView, GuidanceSubmissionRow } from '@/types/views';
import { notFound } from '@/lib/api-error';
import { lastFirst } from '@/lib/format';
import {
  EVALUATION_AREAS,
  EVALUATION_COMMENTS,
  EVALUATION_NUMBERS,
  RATING_SCALE,
  TRAINER_ITEMS,
  ratingLabel,
} from '@/lib/faculty-evaluation-form';
import { db } from '../repositories/db';
import { batchOfSection, facultyDisplayName, subjectLabel } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { evaluationOf } from './faculty-evaluations';
import { effectiveGrade } from './grade-rules';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number | null {
  return values.length ? round2(values.reduce((x, y) => x + y, 0) / values.length) : null;
}

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
  const overall = answer
    ? average(TRAINER_ITEMS.map((i) => answer.ratings[i.id]).filter(Number.isFinite))
    : null;
  return {
    enrollmentSubjectId: row.id,
    studentId: student.id,
    studentNumber: student.studentNumber,
    studentName: lastFirst(student),
    programCode: program?.code ?? '—',
    programName: program?.name ?? '',
    yearLevel: semester.yearLevel,
    sectionCode: section?.code ?? '—',
    batch: batchOfSection(schedule.sectionId),
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
    overall,
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

/** One trainee's answers to one subject's evaluation, item by item. */
export function getGuidanceResponse(enrollmentSubjectId: string): GuidanceResponseView {
  const user = requireRole('GUIDANCE');
  const source = db.enrollmentSubjects.find((es) => es.id === enrollmentSubjectId);
  const answer = source ? evaluationOf(source.id) : undefined;
  const row = source && evaluable(source) ? toRow(source) : null;
  if (!source || !answer || !row) throw notFound('That trainee has not submitted this evaluation.');

  const scaleWord = (value: number | null) =>
    value === null ? '—' : RATING_SCALE.find((s) => s.value === value)?.label ?? String(value);

  const areas = EVALUATION_AREAS.map((area) => {
    const items = area.items.map((item) => {
      const value = Number.isFinite(answer.ratings[item.id]) ? answer.ratings[item.id] : null;
      return { id: item.id, text: item.text, rating: value, label: scaleWord(value) };
    });
    return {
      id: area.id,
      title: area.title,
      aboutTrainer: area.aboutTrainer,
      average: average(items.map((i) => i.rating).filter((v): v is number => v !== null)),
      items,
    };
  });

  // Who opened it is recorded; what it says is not.
  recordAudit({
    action: 'FACULTY_EVALUATION_VIEWED',
    recordType: 'EnrollmentSubject',
    recordId: source.id,
    actor: user,
    detail: `Guidance Office opened ${row.studentNumber}'s evaluation of ${row.subjectCode}.`,
  });

  return {
    row,
    overallLabel: row.overall === null ? null : ratingLabel(row.overall),
    areas,
    numbers: EVALUATION_NUMBERS.map((q) => ({
      id: q.id,
      text: q.text,
      value: Number.isFinite(answer.numbers?.[q.id]) ? answer.numbers[q.id] : null,
    })),
    comments: EVALUATION_COMMENTS.map((q) => ({
      id: q.id,
      text: q.text,
      answer: answer.comments?.[q.id] ?? '',
    })),
  };
}
