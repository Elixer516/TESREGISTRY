/**
 * Grade deadlines.
 *
 * Each semester carries the day its grading sheets are due. A trainer sees
 * against every class how many days are left — or how many days late they
 * are — and the Registrar is warned of every class whose grades are due
 * within the week or already overdue, so a late sheet is chased before it
 * holds up the next enrolment rather than after.
 *
 * Counted in whole calendar days, in the centre's own time zone, so "due
 * today" means today in Davao and not in UTC.
 */

import type { ClassSchedule, GradingSheet } from '@/types';
import type { GradeDeadline, GradeDeadlineAlert } from '@/types/views';
import { db } from '../repositories/db';
import { facultyDisplayName } from '../repositories/lookups';
import { requireRole } from '../auth';

/** Warn this many days before the due date. */
export const DUE_SOON_DAYS = 7;

/** Today's date in Manila, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const to = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((to - from) / 86_400_000);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Where one class's grades stand against its semester's deadline. A sheet
 * counts as handed in once it has been submitted — whatever the Registrar
 * then does with it — and its lateness is fixed at that moment.
 */
export function deadlineFor(
  schedule: Pick<ClassSchedule, 'id' | 'semesterId'>,
  sheet: Pick<GradingSheet, 'status' | 'submittedAt'> | undefined,
): GradeDeadline {
  const semester = db.semesters.find((s) => s.id === schedule.semesterId);
  const dueDate = semester?.gradesDueDate ?? null;
  if (!dueDate) return { dueDate: null, state: 'NONE', days: 0, label: 'No deadline set' };

  // Grades already on every trainee's record — an older term encoded before
  // grading sheets existed — owe nothing, whatever the sheet says.
  const rows = db.enrollmentSubjects.filter((es) => es.classScheduleId === schedule.id);
  if (!sheet?.submittedAt && rows.length > 0 && rows.every((es) => es.finalGrade !== null)) {
    return { dueDate, state: 'ON_TIME', days: 0, label: 'Grades posted' };
  }

  const handedIn = sheet && sheet.status !== 'DRAFT' && sheet.submittedAt;
  if (handedIn) {
    const late = daysBetween(dueDate, todayIso(new Date(sheet.submittedAt as string)));
    return late > 0
      ? { dueDate, state: 'LATE', days: late, label: `Submitted ${plural(late, 'day')} late` }
      : { dueDate, state: 'ON_TIME', days: 0, label: 'Submitted on time' };
  }

  const left = daysBetween(todayIso(), dueDate);
  if (left < 0) {
    return { dueDate, state: 'OVERDUE', days: -left, label: `${plural(-left, 'day')} late` };
  }
  if (left <= DUE_SOON_DAYS) {
    return {
      dueDate,
      state: 'DUE_SOON',
      days: left,
      label: left === 0 ? 'Due today' : `Due in ${plural(left, 'day')}`,
    };
  }
  return { dueDate, state: 'OPEN', days: left, label: `Due in ${plural(left, 'day')}` };
}

/**
 * Every published class whose grades are due within the week or overdue
 * and not yet handed in — what the Registrar is warned about. Most overdue
 * first.
 */
export function listGradeDeadlineAlerts(): GradeDeadlineAlert[] {
  requireRole('REGISTRAR');
  return gradeDeadlineAlerts();
}

/** The same, without the role check, for the dashboard to compose. */
export function gradeDeadlineAlerts(): GradeDeadlineAlert[] {
  const alerts: GradeDeadlineAlert[] = [];
  for (const schedule of db.classSchedules) {
    if (schedule.status !== 'PUBLISHED') continue;
    const semester = db.semesters.find((s) => s.id === schedule.semesterId);
    // Only a term that is running, or has just ended, owes grades. A closed
    // term in an earlier school year is history.
    if (!semester?.gradesDueDate) continue;
    const sheet = db.gradingSheets.find((g) => g.classScheduleId === schedule.id);
    const deadline = deadlineFor(schedule, sheet);
    if (deadline.state !== 'DUE_SOON' && deadline.state !== 'OVERDUE') continue;
    // A class with nobody enrolled has no grades to give.
    const enrolled = db.enrollmentSubjects.some((es) => es.classScheduleId === schedule.id);
    if (!enrolled) continue;
    const subject = db.subjects.find((s) => s.id === schedule.subjectId);
    const section = db.sections.find((s) => s.id === schedule.sectionId);
    const program = db.programs.find((p) => p.id === semester.programId);
    alerts.push({
      classScheduleId: schedule.id,
      sheetId: sheet?.id ?? null,
      subjectCode: subject?.code.trim() ?? '',
      subjectTitle: subject?.title ?? '',
      sectionCode: section?.code ?? '—',
      programCode: program?.code ?? '—',
      trainerName: facultyDisplayName(schedule.facultyId) || 'No trainer assigned',
      status: sheet?.status ?? 'NOT_STARTED',
      deadline,
    });
  }
  const weight = (a: GradeDeadlineAlert) => (a.deadline.state === 'OVERDUE' ? -a.deadline.days : 100 + a.deadline.days);
  return alerts.sort((a, b) => weight(a) - weight(b) || a.subjectCode.localeCompare(b.subjectCode));
}
