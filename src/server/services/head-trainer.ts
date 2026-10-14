/**
 * The head trainer's view of their diploma.
 *
 * A head trainer sees every class of the diploma they head — their own and
 * every other trainer's — with where its grading sheet stands, the grades
 * it posted, and its deadline; and every trainee of the diploma, whose
 * Grade Evaluation they may open. Read-only throughout: grades are still
 * entered by the class's own trainer and approved by the Registrar.
 */

import type { GradingSheetView, HeadTrainerClassView, HeadTrainerOverview } from '@/types/views';
import { STUDENT_STATUS_LABELS } from '@/types';
import { ApiError } from '@/lib/api-error';
import { db } from '../repositories/db';
import { toSemesterView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { headTrainerProgramId } from './head-scope';
import { effectiveGrade, isPassing } from './grade-rules';
import { getSheetForClassUnchecked, summaryForClass } from './grading-sheets';

function requireHead() {
  const user = requireRole('TRAINER');
  const programId = headTrainerProgramId(user);
  if (!programId) {
    throw new ApiError(403, 'FORBIDDEN', 'Only a diploma’s head trainer has this view.');
  }
  return { user, programId };
}

/** Whether the signed-in trainer heads a diploma. Never throws. */
export function amIHeadTrainer(): boolean {
  const user = requireRole('TRAINER');
  return headTrainerProgramId(user) !== null;
}

export function getHeadTrainerOverview(): HeadTrainerOverview {
  const { user, programId } = requireHead();
  const program = db.programs.find((p) => p.id === programId);
  const semesters = db.semesters.filter((s) => s.programId === programId);
  const semesterIds = new Set(semesters.map((s) => s.id));

  const classes: HeadTrainerClassView[] = db.classSchedules
    .filter((c) => semesterIds.has(c.semesterId) && c.status === 'PUBLISHED')
    // Only classes somebody is enrolled in carry grades worth reading.
    .filter((c) => db.enrollmentSubjects.some((es) => es.classScheduleId === c.id))
    .map((schedule) => {
      const semester = semesters.find((s) => s.id === schedule.semesterId);
      const rows = db.enrollmentSubjects.filter((es) => es.classScheduleId === schedule.id);
      let passed = 0;
      let failed = 0;
      let inc = 0;
      for (const row of rows) {
        if (row.finalGrade === null) continue;
        if (row.finalGrade === 'INC' && !row.completionGrade) inc += 1;
        else if (isPassing(effectiveGrade(row.finalGrade, row.completionGrade))) passed += 1;
        else failed += 1;
      }
      const semesterView = semester ? toSemesterView(semester) : null;
      return {
        ...summaryForClass(schedule.id),
        isMine: schedule.facultyId === user.facultyId,
        semesterId: schedule.semesterId,
        semesterLabel: semesterView ? `${semesterView.termLabel} · ${semesterView.academicYearLabel}` : '—',
        semesterIsActive: semester?.isActive ?? false,
        passed,
        failed,
        inc,
        rosterSize: rows.length,
        batches: batchesOf(rows.map((r) => r.enrollmentId)),
      };
    })
    .sort(
      (a, b) =>
        Number(b.semesterIsActive) - Number(a.semesterIsActive) ||
        a.levelSemester.localeCompare(b.levelSemester) ||
        a.courseCode.localeCompare(b.courseCode),
    );

  const trainerIds = new Set(
    db.classSchedules.filter((c) => semesterIds.has(c.semesterId) && c.facultyId).map((c) => c.facultyId as string),
  );

  const trainees = db.students
    .filter((s) => s.programId === programId && !s.archivedAt && !['PENDING', 'REJECTED'].includes(s.status))
    .map((s) => ({
      studentId: s.id,
      studentNumber: s.studentNumber,
      name: `${s.lastName}, ${s.firstName}`,
      yearLevel: s.yearLevel,
      sectionCode: db.sections.find((sec) => sec.id === s.sectionId)?.code ?? null,
      status: STUDENT_STATUS_LABELS[s.status],
      batch: batchOfStudent(s.studentNumber),
    }))
    .sort((a, b) => a.yearLevel - b.yearLevel || a.name.localeCompare(b.name));

  return {
    programCode: program?.code ?? '—',
    programName: program?.name ?? '—',
    trainerCount: trainerIds.size,
    classes,
    trainees,
  };
}

/** One class's grading sheet, read-only, for a class in the head's diploma. */
export function getHeadTrainerSheet(classScheduleId: string): GradingSheetView {
  const { programId } = requireHead();
  const schedule = db.classSchedules.find((c) => c.id === classScheduleId);
  const semester = schedule ? db.semesters.find((s) => s.id === schedule.semesterId) : undefined;
  if (!schedule || semester?.programId !== programId) {
    throw new ApiError(403, 'FORBIDDEN', 'That class is not in the diploma you head.');
  }
  return getSheetForClassUnchecked(classScheduleId);
}

/** A batch is the year a trainee was admitted — the first four digits of their ID Number. */
export function batchOfStudent(studentNumber: string): string {
  return /^\d{4}/.exec(studentNumber)?.[0] ?? '—';
}

function batchesOf(enrollmentIds: string[]): string[] {
  const years = new Set<string>();
  for (const id of enrollmentIds) {
    const enrollment = db.enrollments.find((e) => e.id === id);
    const student = enrollment ? db.students.find((s) => s.id === enrollment.studentId) : undefined;
    if (student) years.add(batchOfStudent(student.studentNumber));
  }
  return [...years].sort();
}
