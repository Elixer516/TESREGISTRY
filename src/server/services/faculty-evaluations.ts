/**
 * Faculty evaluation — trainees rate the trainer of each subject they took.
 *
 * The grade is the reason a trainee answers: once the Registrar approves a
 * grading sheet, the subject's grade stays hidden in the trainee's portal
 * until they evaluate that subject's trainer. The Registrar sees every grade
 * regardless, and cannot enrol a trainee into their next term until the
 * previous term is fully evaluated (or overrides, with a reason).
 *
 * The answers are anonymous to the trainer. A trainer sees only combined
 * results and the comments, only after the term is over, and only for a
 * class with enough answers that no single trainee can be picked out. The
 * Registrar holds the answers for now; the Guidance office owns surveys and
 * will take them over.
 */

import type { EnrollmentSubject, FacultyEvaluation } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type {
  EvaluationTaskView,
  FacultyEvaluationResultView,
  GradeEvaluationForm,
  ReportFilters,
} from '@/types/views';
import { ApiError, badRequest, notFound, validationFailed } from '@/lib/api-error';
import {
  ALL_EVALUATION_ITEMS,
  EVALUATION_AREAS,
  EVALUATION_COMMENTS,
  EVALUATION_NUMBERS,
  MIN_RESPONSES_FOR_TRAINER,
  TRAINER_ITEMS,
  ratingLabel,
} from '@/lib/faculty-evaluation-form';
import { db, nextId, nowIso } from '../repositories/db';
import { facultyDisplayName, subjectLabel } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { effectiveGrade } from './grade-rules';

/* ---------------------------------------------------------------- */
/* The rule                                                          */
/* ---------------------------------------------------------------- */

/** Whether this subject asks for an evaluation at all, grade or not. */
function evaluable(row: EnrollmentSubject): boolean {
  if (!row.classScheduleId) return false;
  const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
  if (!schedule?.facultyId) return false;
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  if (!enrollment || enrollment.status === 'DROPPED') return false;
  // A credited or dropped subject was never taught to this trainee.
  const effective = effectiveGrade(row.finalGrade, row.completionGrade);
  return effective !== 'CRD' && effective !== 'DRP';
}

/** The grade is posted and the trainee owes — or has given — an evaluation. */
export function evaluationRequired(row: EnrollmentSubject): boolean {
  return row.finalGrade !== null && evaluable(row);
}

export function evaluationOf(enrollmentSubjectId: string): FacultyEvaluation | undefined {
  return db.facultyEvaluations.find((e) => e.enrollmentSubjectId === enrollmentSubjectId);
}

/** Subject codes in one enrolment whose grade is posted but not yet evaluated. */
export function pendingEvaluationCodes(enrollmentId: string): string[] {
  return db.enrollmentSubjects
    .filter((row) => row.enrollmentId === enrollmentId)
    .filter((row) => evaluationRequired(row) && !evaluationOf(row.id))
    .map((row) => subjectLabel(db.subjects.find((s) => s.id === row.subjectId)));
}

/**
 * The trainee's Grade Evaluation as the trainee may see it: every grade they
 * have not yet unlocked is blanked out, and so is any average that would
 * reveal it. The Registrar's copy is never passed through this.
 */
export function maskForTrainee(form: GradeEvaluationForm): GradeEvaluationForm {
  let anyLocked = false;
  const groups = form.groups.map((group) => {
    let groupLocked = false;
    const rows = group.rows.map((row) => {
      const source = db.enrollmentSubjects.find((es) => es.id === row.enrollmentSubjectId);
      const locked = Boolean(source && evaluationRequired(source) && !evaluationOf(source.id));
      if (!locked) return { ...row, lockedForEvaluation: false };
      groupLocked = true;
      return {
        ...row,
        lockedForEvaluation: true,
        grade: null,
        percentage: '',
        remarks: '',
        completionGrade: null,
        completionPercentage: null,
        isPassed: null,
      };
    });
    anyLocked = anyLocked || groupLocked;
    return groupLocked
      ? { ...group, rows, gwa: '—', unitsEarned: 0, gradesViewPending: false }
      : { ...group, rows };
  });
  return anyLocked ? { ...form, groups, overallGwa: '—' } : { ...form, groups };
}

/* ---------------------------------------------------------------- */
/* The trainee                                                       */
/* ---------------------------------------------------------------- */

function myStudentId(): string {
  const user = requireRole('TRAINEE');
  if (!user.studentId) throw notFound('This account is not linked to a student record.');
  return user.studentId;
}

function termOf(row: EnrollmentSubject) {
  const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
  const semester = enrollment ? db.semesters.find((s) => s.id === enrollment.semesterId) : undefined;
  const year = semester ? db.academicYears.find((y) => y.id === semester.academicYearId) : undefined;
  return { semester, year };
}

/** Every subject the trainee evaluates, owed ones first. */
export function myEvaluationTasks(): EvaluationTaskView[] {
  const studentId = myStudentId();
  const enrollmentIds = new Set(
    db.enrollments.filter((e) => e.studentId === studentId).map((e) => e.id),
  );
  const order = { PENDING: 0, AWAITING_GRADE: 1, DONE: 2 } as const;
  return db.enrollmentSubjects
    .filter((row) => enrollmentIds.has(row.enrollmentId) && evaluable(row))
    .map((row) => {
      const { semester, year } = termOf(row);
      const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
      const done = evaluationOf(row.id);
      const status: EvaluationTaskView['status'] = done
        ? 'DONE'
        : row.finalGrade === null
          ? 'AWAITING_GRADE'
          : 'PENDING';
      return {
        enrollmentSubjectId: row.id,
        semesterId: semester?.id ?? '',
        subjectCode: subjectLabel(db.subjects.find((s) => s.id === row.subjectId)),
        subjectTitle: db.subjects.find((s) => s.id === row.subjectId)?.title ?? '',
        trainerName: schedule ? facultyDisplayName(schedule.facultyId) : '',
        termLabel: semester ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod) : '',
        academicYearLabel: year?.label ?? '',
        status,
        submittedAt: done?.submittedAt ?? null,
      };
    })
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        b.academicYearLabel.localeCompare(a.academicYearLabel) ||
        a.subjectCode.localeCompare(b.subjectCode),
    );
}

export interface FacultyEvaluationInput {
  ratings: Record<string, number>;
  numbers: Record<string, number>;
  comments: Record<string, string>;
}

/** The trainee answers the evaluation for one subject. Once only. */
export function submitFacultyEvaluation(
  enrollmentSubjectId: string,
  input: FacultyEvaluationInput,
): EvaluationTaskView[] {
  const user = requireRole('TRAINEE');
  const studentId = myStudentId();
  const row = db.enrollmentSubjects.find((es) => es.id === enrollmentSubjectId);
  const enrollment = row ? db.enrollments.find((e) => e.id === row.enrollmentId) : undefined;
  if (!row || !enrollment) throw notFound('That subject could not be found.');
  if (enrollment.studentId !== studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only evaluate your own subjects.');
  }
  if (!evaluable(row)) throw badRequest('This subject does not have a trainer to evaluate.');
  if (row.finalGrade === null) {
    throw badRequest('The evaluation opens once your grade for this subject is posted.');
  }
  if (evaluationOf(row.id)) throw badRequest('You have already evaluated this subject.');

  const ratings: Record<string, number> = {};
  const missing: string[] = [];
  for (const item of ALL_EVALUATION_ITEMS) {
    const value = Number(input.ratings?.[item.id]);
    if (!Number.isInteger(value) || value < 1 || value > 5) missing.push(item.id);
    else ratings[item.id] = value;
  }
  if (missing.length > 0) {
    throw validationFailed(
      `Rate every statement before submitting — ${missing.length} still unanswered (${missing.join(', ')}).`,
    );
  }
  const numbers: Record<string, number> = {};
  for (const question of EVALUATION_NUMBERS) {
    const value = Number(input.numbers?.[question.id]);
    if (!Number.isFinite(value) || value < question.min || value > question.max) {
      throw validationFailed(`${question.id}: enter a number from ${question.min} to ${question.max}.`);
    }
    numbers[question.id] = Math.round(value);
  }
  const comments: Record<string, string> = {};
  for (const question of EVALUATION_COMMENTS) {
    const text = (input.comments?.[question.id] ?? '').trim().slice(0, 1000);
    if (question.required && text.length < 2) {
      throw validationFailed(`Answer "${question.text}"`);
    }
    if (text) comments[question.id] = text;
  }

  const schedule = db.classSchedules.find((c) => c.id === row.classScheduleId);
  const evaluation: FacultyEvaluation = {
    id: nextId('fe'),
    enrollmentSubjectId: row.id,
    studentId,
    classScheduleId: row.classScheduleId ?? '',
    facultyId: schedule?.facultyId ?? '',
    subjectId: row.subjectId,
    semesterId: enrollment.semesterId,
    ratings,
    numbers,
    comments,
    submittedAt: nowIso(),
  };
  db.facultyEvaluations.push(evaluation);

  // The audit says that it happened and for which subject — never what was
  // said, which would undo the anonymity the trainer is promised.
  recordAudit({
    action: 'FACULTY_EVALUATION_SUBMITTED',
    recordType: 'EnrollmentSubject',
    recordId: row.id,
    actor: user,
    detail: `Faculty evaluation submitted for ${subjectLabel(db.subjects.find((s) => s.id === row.subjectId))}.`,
  });
  return myEvaluationTasks();
}

/* ---------------------------------------------------------------- */
/* Results                                                           */
/* ---------------------------------------------------------------- */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resultFor(classScheduleId: string, forTrainer: boolean): FacultyEvaluationResultView | null {
  const schedule = db.classSchedules.find((c) => c.id === classScheduleId);
  if (!schedule?.facultyId) return null;
  const answers = db.facultyEvaluations.filter((e) => e.classScheduleId === classScheduleId);
  const semester = db.semesters.find((s) => s.id === schedule.semesterId);
  const year = semester ? db.academicYears.find((y) => y.id === semester.academicYearId) : undefined;
  const program = semester ? db.programs.find((p) => p.id === semester.programId) : undefined;
  const subject = db.subjects.find((s) => s.id === schedule.subjectId);
  const section = db.sections.find((s) => s.id === schedule.sectionId);
  const eligible = db.enrollmentSubjects.filter(
    (row) => row.classScheduleId === classScheduleId && evaluationRequired(row),
  ).length;

  const withheld = forTrainer && answers.length < MIN_RESPONSES_FOR_TRAINER;
  // The self-evaluation is about the trainee, so it is not shown as one of
  // the trainer's areas and never enters their overall.
  const areas = EVALUATION_AREAS.filter((area) => area.aboutTrainer).map((area) => {
    const values = answers.flatMap((a) => area.items.map((item) => a.ratings[item.id]).filter(Number.isFinite));
    return {
      id: area.id,
      title: area.title,
      average: withheld || values.length === 0 ? null : round2(values.reduce((x, y) => x + y, 0) / values.length),
    };
  });
  const all = answers.flatMap((a) => TRAINER_ITEMS.map((i) => a.ratings[i.id]).filter(Number.isFinite));
  const overall = withheld || all.length === 0 ? null : round2(all.reduce((x, y) => x + y, 0) / all.length);

  return {
    classScheduleId,
    facultyId: schedule.facultyId,
    trainerName: facultyDisplayName(schedule.facultyId),
    programCode: program?.code ?? '—',
    subjectCode: subjectLabel(subject),
    subjectTitle: subject?.title ?? '',
    sectionCode: section?.code ?? '—',
    termLabel: semester ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod) : '—',
    academicYearLabel: year?.label ?? '—',
    respondents: answers.length,
    eligible,
    areas,
    overall,
    overallLabel: overall === null ? null : ratingLabel(overall),
    // Grouped by question and sorted alphabetically, so an answer cannot be
    // matched to the order trainees submitted — or appear on the class list.
    comments: withheld
      ? []
      : EVALUATION_COMMENTS.map((question) => ({
          questionId: question.id,
          question: question.text,
          answers: answers
            .map((a) => a.comments?.[question.id] ?? '')
            .filter(Boolean)
            .sort((x, y) => x.localeCompare(y)),
        })).filter((group) => group.answers.length > 0),
    withheld,
  };
}

/**
 * The Registrar's view: every class with at least one answer, for the
 * report filters. Combined figures and comments — never who said what.
 */
export function listEvaluationResults(filters: ReportFilters = {}): FacultyEvaluationResultView[] {
  requireRole('REGISTRAR');
  const classIds = new Set(db.facultyEvaluations.map((e) => e.classScheduleId));
  return [...classIds]
    .map((id) => db.classSchedules.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => {
      const semester = db.semesters.find((s) => s.id === c.semesterId);
      if (!semester) return false;
      if (filters.academicYearId && semester.academicYearId !== filters.academicYearId) return false;
      if (filters.programId && semester.programId !== filters.programId) return false;
      if (filters.semesterPeriod && semester.semesterPeriod !== filters.semesterPeriod) return false;
      return true;
    })
    .map((c) => resultFor(c.id, false))
    .filter((r): r is FacultyEvaluationResultView => r !== null)
    .sort(
      (a, b) =>
        a.trainerName.localeCompare(b.trainerName) ||
        b.academicYearLabel.localeCompare(a.academicYearLabel) ||
        a.subjectCode.localeCompare(b.subjectCode),
    );
}

/**
 * A trainer's own results — only for terms that are over (closed after they
 * began), and only for classes with enough answers to stay anonymous.
 */
export function myEvaluationResults(): FacultyEvaluationResultView[] {
  const user = requireRole('TRAINER');
  if (!user.facultyId) return [];
  const today = nowIso().slice(0, 10);
  return db.classSchedules
    .filter((c) => c.facultyId === user.facultyId)
    .filter((c) => {
      const semester = db.semesters.find((s) => s.id === c.semesterId);
      return Boolean(semester && !semester.isActive && semester.startDate <= today);
    })
    .filter((c) => db.facultyEvaluations.some((e) => e.classScheduleId === c.id))
    .map((c) => resultFor(c.id, true))
    .filter((r): r is FacultyEvaluationResultView => r !== null)
    .sort(
      (a, b) =>
        b.academicYearLabel.localeCompare(a.academicYearLabel) || a.subjectCode.localeCompare(b.subjectCode),
    );
}
