/**
 * "My" queries — the signed-in user's own records.
 *
 * A trainee reaches their data only through these functions, and every one of
 * them resolves the student id from the session rather than from an argument.
 */

import type { ClassSchedule } from '@/types';
import type {
  ClassScheduleView,
  CurriculumProgressSubject,
  CurriculumProgressView,
  GradeEvaluationForm,
  ScheduleAssessmentResult,
} from '@/types/views';
import { semesterPeriodLabel } from '@/types';
import { notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { subjectLabel, toScheduleView } from '../repositories/lookups';
import { effectiveGrade, isPassing } from './grade-rules';
import { requireRole } from '../auth';
import { getGradeEvaluation } from './grade-evaluation';
import { evaluationOf, evaluationRequired, maskForTrainee } from './faculty-evaluations';
import { computeScheduleAssessment } from './gsa';

/**
 * The trainee's own open semester.
 *
 * Semesters belong to a diploma and a year level, and a trainee sits in
 * exactly one of each — so this is unambiguous, where a global lookup would
 * have returned some other diploma's calendar.
 */
function myOpenSemester(studentId: string) {
  const student = db.students.find((s) => s.id === studentId);
  if (!student) return undefined;
  return db.semesters.find(
    (s) => s.isActive && s.programId === student.programId && s.yearLevel === student.yearLevel,
  );
}

function myStudentId(): string {
  const user = requireRole('TRAINEE');
  if (!user.studentId) {
    throw notFound('This account is not linked to a student record.');
  }
  return user.studentId;
}

function myFacultyId(): string {
  const user = requireRole('TRAINER');
  if (!user.facultyId) {
    throw notFound(
      'This trainer account is not linked to a faculty record, so it has no classes. Ask the Registrar to link it.',
    );
  }
  return user.facultyId;
}

/**
 * The trainer's own weekly teaching timetable.
 *
 * Scoped to their currently open semesters only — a trainer is assigned to
 * one year level of one diploma, which carries two semesters (1st and 2nd),
 * and showing a closed one alongside the open one would put two unrelated
 * terms' classes on the same calendar day and hour.
 */
export function myTeachingSchedule(): ClassScheduleView[] {
  const facultyId = myFacultyId();
  return db.classSchedules
    .filter((s) => s.facultyId === facultyId && s.status === 'PUBLISHED')
    .filter((s) => {
      const semester = db.semesters.find((sem) => sem.id === s.semesterId);
      return semester?.isActive ?? false;
    })
    .map(toScheduleView);
}

/** The trainee's own published schedule for the active term. */
export function myWeeklySchedule(): ClassScheduleView[] {
  const studentId = myStudentId();
  const active = myOpenSemester(studentId);
  if (!active) return [];

  const enrollment = db.enrollments.find(
    (e) => e.studentId === studentId && e.semesterId === active.id,
  );
  if (!enrollment) return [];

  const schedules: ClassSchedule[] = [];
  for (const row of db.enrollmentSubjects) {
    if (row.enrollmentId !== enrollment.id || !row.classScheduleId) continue;
    const schedule = db.classSchedules.find((s) => s.id === row.classScheduleId);
    if (schedule && schedule.status === 'PUBLISHED') schedules.push(schedule);
  }
  return schedules.map(toScheduleView);
}

/**
 * A trainee sees exactly the evaluation the registrar sees for them. One
 * derivation, so the two can never disagree about their own grades.
 */
export function myGradeEvaluation(): GradeEvaluationForm {
  // Grades the trainee has not unlocked by evaluating the trainer stay
  // hidden here; the Registrar's copy of the same form is never masked.
  return maskForTrainee(getGradeEvaluation(myStudentId()));
}

/** The trainee's own General Schedule and Assessment for the active term. */
export function myScheduleAssessment(): ScheduleAssessmentResult {
  const studentId = myStudentId();
  return computeScheduleAssessment(studentId);
}

/**
 * The trainee's whole curriculum, subject by subject, and where they stand on
 * each — the portal's "My Curriculum". A grade still waiting on its faculty
 * evaluation reads LOCKED here too, so this page is no way round the lock.
 */
export function myCurriculumProgress(): CurriculumProgressView {
  const studentId = myStudentId();
  const student = db.students.find((s) => s.id === studentId);
  if (!student?.curriculumId) throw notFound('No curriculum has been assigned to you yet.');
  const curriculum = db.curricula.find((c) => c.id === student.curriculumId);

  const enrollments = db.enrollments.filter((e) => e.studentId === studentId && e.status !== 'DROPPED');
  const rowsBySubject = new Map<string, typeof db.enrollmentSubjects>();
  for (const row of db.enrollmentSubjects) {
    if (!enrollments.some((e) => e.id === row.enrollmentId)) continue;
    const list = rowsBySubject.get(row.subjectId) ?? [];
    list.push(row);
    rowsBySubject.set(row.subjectId, list);
  }

  const mappings = db.programSubjects
    .filter((ps) => ps.curriculumId === student.curriculumId)
    .sort((a, b) => a.yearLevel - b.yearLevel || a.semesterPeriod.localeCompare(b.semesterPeriod));
  const order = { FIRST: 0, SECOND: 1, SUMMER: 2 } as const;
  const termKeys = [...new Set(mappings.map((m) => `${m.yearLevel}|${m.semesterPeriod}`))].sort((a, b) => {
    const [ya, pa] = a.split('|');
    const [yb, pb] = b.split('|');
    return Number(ya) - Number(yb) || order[pa as keyof typeof order] - order[pb as keyof typeof order];
  });

  let unitsTotal = 0;
  let unitsEarned = 0;
  let subjectsPassed = 0;
  const terms = termKeys.map((key) => {
    const [yearLevel, period] = key.split('|');
    const subjects: CurriculumProgressSubject[] = mappings
      .filter((m) => `${m.yearLevel}|${m.semesterPeriod}` === key)
      .map((mapping) => {
        const subject = db.subjects.find((s) => s.id === mapping.subjectId);
        const units = subject?.units ?? 0;
        unitsTotal += units;
        // The most recent attempt is the one that counts.
        const attempts = rowsBySubject.get(mapping.subjectId) ?? [];
        const row = attempts[attempts.length - 1];
        const enrollment = row ? enrollments.find((e) => e.id === row.enrollmentId) : undefined;
        const semester = enrollment ? db.semesters.find((s) => s.id === enrollment.semesterId) : undefined;
        const takenIn = semester ? (db.academicYears.find((y) => y.id === semester.academicYearId)?.label ?? null) : null;

        let status: CurriculumProgressSubject['status'] = 'NOT_TAKEN';
        let grade: string | null = null;
        let percentage: number | null = null;
        if (row) {
          const effective = effectiveGrade(row.finalGrade, row.completionGrade);
          if (row.finalGrade === null) status = 'ENROLLED';
          else if (evaluationRequired(row) && !evaluationOf(row.id)) status = 'LOCKED';
          else {
            grade = effective ?? row.finalGrade;
            percentage = row.finalGrade === 'INC' ? row.completionPercentage : row.finalPercentage;
            if (row.finalGrade === 'INC' && !row.completionGrade) status = 'INC';
            else if (effective === 'CRD' || isPassing(effective)) status = 'PASSED';
            else status = 'FAILED';
          }
        }
        if (status === 'PASSED') {
          subjectsPassed += 1;
          unitsEarned += units;
        }
        return {
          subjectId: mapping.subjectId,
          subjectCode: subjectLabel(subject),
          subjectTitle: subject?.title ?? '',
          units,
          prerequisite: mapping.prerequisiteNote,
          status,
          grade,
          percentage,
          takenIn,
        };
      });
    return {
      key,
      label: semesterPeriodLabel(Number(yearLevel), period as 'FIRST' | 'SECOND' | 'SUMMER'),
      units: subjects.reduce((sum, s) => sum + s.units, 0),
      subjects,
    };
  });

  return {
    curriculumName: curriculum?.name ?? '—',
    batchYear: curriculum?.effectiveYear ?? '—',
    subjectsTotal: mappings.length,
    subjectsPassed,
    unitsTotal,
    unitsEarned,
    terms,
  };
}

export function myStudentIdOrThrow(): string {
  return myStudentId();
}

/* ---------------------------------------------------------------- */
/* Notifications — scoped to the recipient, for every role           */
/* ---------------------------------------------------------------- */




