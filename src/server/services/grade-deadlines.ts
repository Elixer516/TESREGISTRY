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
import { SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type { ClassDeadlineView, GradeDeadline, GradeDeadlineAlert, GradeDeadlineOverrideView } from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { facultyDisplayName, subjectLabel } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';

/** Year admitted of every trainee in a class — the class's batches. */
function batchesInClass(classScheduleId: string): Set<string> {
  const years = new Set<string>();
  for (const es of db.enrollmentSubjects) {
    if (es.classScheduleId !== classScheduleId) continue;
    const enrollment = db.enrollments.find((e) => e.id === es.enrollmentId);
    const student = enrollment ? db.students.find((x) => x.id === enrollment.studentId) : undefined;
    const year = student ? /^\d{4}/.exec(student.studentNumber)?.[0] : undefined;
    if (year) years.add(year);
  }
  return years;
}

/**
 * The due date that applies to one class: an exception set for its subject
 * and batch, else for its subject, else for its batch, else the semester's.
 */
export function dueDateFor(schedule: Pick<ClassSchedule, 'id' | 'semesterId' | 'subjectId'>): string | null {
  const semester = db.semesters.find((s) => s.id === schedule.semesterId);
  const overrides = (db.gradeDeadlineOverrides ?? []).filter((o) => o.semesterId === schedule.semesterId);
  if (overrides.length > 0) {
    const batches = batchesInClass(schedule.id);
    const matching = overrides
      .filter(
        (o) =>
          (o.classScheduleId == null || o.classScheduleId === schedule.id) &&
          (o.subjectId === null || o.subjectId === schedule.subjectId) &&
          (o.batch === null || batches.has(o.batch)),
      )
      .sort((a, b) => specificity(b) - specificity(a));
    if (matching[0]) return matching[0].dueDate;
  }
  return semester?.gradesDueDate ?? null;
}

function specificity(o: { subjectId: string | null; batch: string | null; classScheduleId?: string | null }): number {
  return (o.classScheduleId ? 4 : 0) + (o.subjectId ? 2 : 0) + (o.batch ? 1 : 0);
}

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
  schedule: Pick<ClassSchedule, 'id' | 'semesterId' | 'subjectId'>,
  sheet: Pick<GradingSheet, 'status' | 'submittedAt'> | undefined,
): GradeDeadline {
  const dueDate = dueDateFor(schedule);
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
    if (!semester) continue;
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

/* ---------------------------------------------------------------- */
/* Exceptions: a deadline for one subject or one batch               */
/* ---------------------------------------------------------------- */

function toOverrideView(o: (typeof db.gradeDeadlineOverrides)[number]): GradeDeadlineOverrideView {
  const subject = o.subjectId ? db.subjects.find((x) => x.id === o.subjectId) : undefined;
  const schedule = o.classScheduleId ? db.classSchedules.find((c) => c.id === o.classScheduleId) : undefined;
  const section = schedule ? db.sections.find((s) => s.id === schedule.sectionId) : undefined;
  return {
    id: o.id,
    semesterId: o.semesterId,
    subjectId: o.subjectId,
    subjectLabel: subject ? subjectLabel(subject) : 'All subjects',
    batch: o.batch,
    sectionCode: o.classScheduleId ? section?.code ?? 'One class' : null,
    dueDate: o.dueDate,
  };
}

/** A semester's exceptions, and the subjects and batches it has to choose from. */
export function listDeadlineOverrides(semesterId: string) {
  requireRole('REGISTRAR');
  const classes = db.classSchedules.filter((c) => c.semesterId === semesterId && c.status === 'PUBLISHED');
  const subjects = [...new Set(classes.map((c) => c.subjectId))]
    .map((id) => db.subjects.find((x) => x.id === id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .map((x) => ({ subjectId: x.id, label: subjectLabel(x) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const batches = new Set<string>();
  for (const c of classes) for (const b of batchesInClass(c.id)) batches.add(b);
  return {
    overrides: (db.gradeDeadlineOverrides ?? []).filter((o) => o.semesterId === semesterId).map(toOverrideView),
    subjects,
    batches: [...batches].sort().reverse(),
  };
}

export function addDeadlineOverride(input: { semesterId: string; subjectId: string | null; batch: string | null; dueDate: string }) {
  const actor = requireRole('REGISTRAR');
  const semester = db.semesters.find((s) => s.id === input.semesterId);
  if (!semester) throw notFound('That semester could not be found.');
  if (!input.subjectId && !input.batch) throw badRequest('Choose a subject, a batch, or both — otherwise it is just the semester\'s deadline.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? '')) throw badRequest('Give the due date.');
  if (input.dueDate < semester.startDate) throw badRequest('Grades cannot fall due before the semester starts.');
  const clash = db.gradeDeadlineOverrides.find(
    (o) =>
      o.semesterId === input.semesterId &&
      o.classScheduleId == null &&
      o.subjectId === (input.subjectId || null) &&
      o.batch === (input.batch || null),
  );
  if (clash) {
    clash.dueDate = input.dueDate;
  } else {
    db.gradeDeadlineOverrides.push({
      id: nextId('gdo'),
      semesterId: input.semesterId,
      subjectId: input.subjectId || null,
      batch: input.batch || null,
      classScheduleId: null,
      dueDate: input.dueDate,
      createdByUserId: actor.id,
      createdAt: nowIso(),
    });
  }
  const subject = input.subjectId ? db.subjects.find((x) => x.id === input.subjectId) : undefined;
  recordAudit({
    action: 'GRADE_DEADLINE_SET',
    recordType: 'Semester',
    recordId: semester.id,
    actor,
    detail: `Grades due ${input.dueDate} for ${subject ? subjectLabel(subject) : 'all subjects'}${input.batch ? `, batch ${input.batch}` : ''}.`,
  });
  return listDeadlineOverrides(input.semesterId);
}

export function removeDeadlineOverride(overrideId: string) {
  requireRole('REGISTRAR');
  const o = db.gradeDeadlineOverrides.find((x) => x.id === overrideId);
  if (!o) throw notFound('That deadline could not be found.');
  db.gradeDeadlineOverrides.splice(db.gradeDeadlineOverrides.indexOf(o), 1);
  return listDeadlineOverrides(o.semesterId);
}

/* ---- One class's deadline, from Grading Sheets ------------------------- */

function classOf(classScheduleId: string) {
  const schedule = db.classSchedules.find((c) => c.id === classScheduleId);
  if (!schedule) throw notFound('That class could not be found.');
  const semester = db.semesters.find((s) => s.id === schedule.semesterId);
  if (!semester) throw notFound('That class has no semester.');
  return { schedule, semester };
}

function classDeadlineView(classScheduleId: string): ClassDeadlineView {
  const { schedule, semester } = classOf(classScheduleId);
  const own = db.gradeDeadlineOverrides.find((o) => o.classScheduleId === schedule.id);
  // What would apply without this class's own date: set it aside and ask again.
  if (own) db.gradeDeadlineOverrides.splice(db.gradeDeadlineOverrides.indexOf(own), 1);
  const fallbackDueDate = dueDateFor(schedule);
  if (own) db.gradeDeadlineOverrides.push(own);
  const fromException = fallbackDueDate !== null && fallbackDueDate !== semester.gradesDueDate;

  const subject = db.subjects.find((x) => x.id === schedule.subjectId);
  const section = db.sections.find((x) => x.id === schedule.sectionId);
  const program = db.programs.find((x) => x.id === semester.programId);
  const academicYear = db.academicYears.find((y) => y.id === semester.academicYearId);
  return {
    classScheduleId: schedule.id,
    classLabel: `${subject ? subjectLabel(subject) : 'Class'} · ${section?.code ?? ''}`,
    semesterLabel: `${program?.code ?? ''} ${yearLevelLabel(semester.yearLevel)}, ${SEMESTER_PERIOD_LABELS[semester.semesterPeriod]} · ${academicYear?.label ?? ''}`,
    dueDate: own?.dueDate ?? fallbackDueDate,
    source: own ? 'CLASS' : fallbackDueDate === null ? 'NONE' : fromException ? 'EXCEPTION' : 'SEMESTER',
    fallbackDueDate,
    semesterStartDate: semester.startDate,
  };
}

export function getClassDeadline(classScheduleId: string): ClassDeadlineView {
  requireRole('REGISTRAR');
  return classDeadlineView(classScheduleId);
}

/**
 * Gives one class its own grade deadline, or (null) takes it away so the
 * semester's deadline, or its exceptions, apply again.
 */
export function setClassDeadline(classScheduleId: string, dueDate: string | null): ClassDeadlineView {
  const actor = requireRole('REGISTRAR');
  const { schedule, semester } = classOf(classScheduleId);
  const own = db.gradeDeadlineOverrides.find((o) => o.classScheduleId === schedule.id);
  const label = classDeadlineView(classScheduleId).classLabel;
  if (dueDate === null) {
    if (own) db.gradeDeadlineOverrides.splice(db.gradeDeadlineOverrides.indexOf(own), 1);
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw badRequest('Give the due date.');
    if (dueDate < semester.startDate) throw badRequest('Grades cannot fall due before the semester starts.');
    if (own) {
      own.dueDate = dueDate;
    } else {
      db.gradeDeadlineOverrides.push({
        id: nextId('gdo'),
        semesterId: semester.id,
        subjectId: schedule.subjectId,
        batch: null,
        classScheduleId: schedule.id,
        dueDate,
        createdByUserId: actor.id,
        createdAt: nowIso(),
      });
    }
  }
  recordAudit({
    action: 'GRADE_DEADLINE_SET',
    recordType: 'Semester',
    recordId: semester.id,
    actor,
    detail:
      dueDate === null
        ? `${label}: its own grade deadline removed; the semester's applies again.`
        : `Grades due ${dueDate} for ${label}.`,
  });
  return classDeadlineView(classScheduleId);
}
