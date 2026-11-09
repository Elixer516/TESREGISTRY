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

import type { ClassSchedule, GradingSheet, ScholarshipCode } from '@/types';
import { SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type {
  ClassDeadlineView,
  DeadlineRuleOptions,
  DeadlineRuleView,
  GradeDeadline,
  GradeDeadlineAlert,
  GradeDeadlineOverrideView,
} from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { batchesOfClass, facultyDisplayName, subjectLabel, toSemesterView } from '../repositories/lookups';
import { SCHOLARSHIPS, scholarshipSpec } from '@/lib/scholarships';
import { requireRole } from '../auth';
import { recordAudit } from './audit';

/** What a deadline rule can match a class on: its trainees' batches and scholarships. */
function classFacts(classScheduleId: string): { batches: Set<string>; scholarships: Set<string> } {
  const scholarships = new Set<string>();
  for (const row of db.enrollmentSubjects) {
    if (row.classScheduleId !== classScheduleId) continue;
    const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
    if (enrollment) scholarships.add(enrollment.scholarship ?? 'REGULAR');
  }
  return { batches: new Set(batchesOfClass(classScheduleId)), scholarships };
}

type Rule = (typeof db.gradeDeadlineOverrides)[number];

function ruleMatches(
  o: Rule,
  schedule: Pick<ClassSchedule, 'id' | 'subjectId'> & { sectionId?: string },
  facts: () => { batches: Set<string>; scholarships: Set<string> },
): boolean {
  if (o.classScheduleId != null && o.classScheduleId !== schedule.id) return false;
  if (o.subjectId != null && o.subjectId !== schedule.subjectId) return false;
  if (o.sectionId != null && o.sectionId !== schedule.sectionId) return false;
  if (o.batch != null && !facts().batches.has(o.batch)) return false;
  if (o.scholarship != null && !facts().scholarships.has(o.scholarship)) return false;
  return true;
}

/**
 * The due date that applies to one class: the most specific deadline rule
 * that matches it — its own, else one naming its subject, else one naming
 * its section, scholarship and/or batch — else the semester's. Between
 * equally specific rules, the earliest date: a class holding one TWSP
 * scholar owes its sheet when the TWSP grades are due.
 */
export function dueDateFor(schedule: Pick<ClassSchedule, 'id' | 'semesterId' | 'subjectId'>): string | null {
  const semester = db.semesters.find((s) => s.id === schedule.semesterId);
  const overrides = (db.gradeDeadlineOverrides ?? []).filter((o) => o.semesterId === schedule.semesterId);
  if (overrides.length > 0) {
    const full = db.classSchedules.find((c) => c.id === schedule.id);
    let facts: ReturnType<typeof classFacts> | null = null;
    const lazyFacts = () => (facts ??= classFacts(schedule.id));
    const matching = overrides
      .filter((o) => ruleMatches(o, { ...schedule, sectionId: full?.sectionId }, lazyFacts))
      .sort((a, b) => specificity(b) - specificity(a) || a.dueDate.localeCompare(b.dueDate));
    if (matching[0]) return matching[0].dueDate;
  }
  return semester?.gradesDueDate ?? null;
}

function specificity(o: Rule): number {
  return (
    // A class's own date first; then one set for its subject, which beats any
    // mix of section, scholarship and batch (Francis, 2026-11-09).
    (o.classScheduleId ? 64 : 0) +
    (o.subjectId ? 16 : 0) +
    (o.sectionId ? 4 : 0) +
    (o.scholarship ? 2 : 0) +
    (o.batch ? 1 : 0)
  );
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
      batches: batchesOfClass(schedule.id),
    });
  }
  const weight = (a: GradeDeadlineAlert) => (a.deadline.state === 'OVERDUE' ? -a.deadline.days : 100 + a.deadline.days);
  return alerts.sort((a, b) => weight(a) - weight(b) || a.subjectCode.localeCompare(b.subjectCode));
}

/* ---------------------------------------------------------------- */
/* Exceptions: a deadline for one subject or one batch               */
/* ---------------------------------------------------------------- */

function toOverrideView(o: Rule): GradeDeadlineOverrideView {
  const subject = o.subjectId ? db.subjects.find((x) => x.id === o.subjectId) : undefined;
  const schedule = o.classScheduleId ? db.classSchedules.find((c) => c.id === o.classScheduleId) : undefined;
  const sectionId = schedule?.sectionId ?? o.sectionId ?? null;
  const section = sectionId ? db.sections.find((s) => s.id === sectionId) : undefined;
  return {
    id: o.id,
    semesterId: o.semesterId,
    subjectId: o.subjectId,
    subjectLabel: subject ? subjectLabel(subject) : 'All subjects',
    batch: o.batch,
    sectionCode: sectionId ? section?.code ?? 'One section' : null,
    scholarship: o.scholarship ? scholarshipSpec(o.scholarship).label : null,
    isClass: Boolean(o.classScheduleId),
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
  for (const c of classes) for (const b of batchesOfClass(c.id)) batches.add(b);
  return {
    overrides: (db.gradeDeadlineOverrides ?? []).filter((o) => o.semesterId === semesterId).map(toOverrideView),
    subjects,
    batches: [...batches].sort((a, b) => Number(a) - Number(b)),
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
      (o.sectionId ?? null) === null &&
      (o.scholarship ?? null) === null &&
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
      sectionId: null,
      scholarship: null,
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
        sectionId: null,
        scholarship: null,
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

/* ---- One step: a deadline by diploma, section, scholarship and batch --- */

/** An open term's name on the form: "1st Year, 1st Semester". */
function termName(semesterId: string): { programCode: string; termLabel: string } {
  const semester = db.semesters.find((s) => s.id === semesterId);
  const program = semester ? db.programs.find((p) => p.id === semester.programId) : undefined;
  return {
    programCode: program?.code ?? '—',
    termLabel: semester
      ? `${yearLevelLabel(semester.yearLevel)}, ${SEMESTER_PERIOD_LABELS[semester.semesterPeriod]}`
      : '—',
  };
}

function openSemesters() {
  return db.semesters.filter((s) => s.isActive);
}

/** Open classes with trainees in them: what a deadline can cover. */
function openClasses() {
  const open = new Set(openSemesters().map((s) => s.id));
  return db.classSchedules.filter(
    (c) =>
      open.has(c.semesterId) &&
      c.status === 'PUBLISHED' &&
      db.enrollmentSubjects.some((es) => es.classScheduleId === c.id),
  );
}

export function getDeadlineRuleOptions(): DeadlineRuleOptions {
  requireRole('REGISTRAR');
  const semesters = openSemesters();
  const programIds = new Set(semesters.map((s) => s.programId));
  const classes = openClasses();
  const rules = db.gradeDeadlineOverrides.filter(
    (o) => o.classScheduleId == null && semesters.some((s) => s.id === o.semesterId),
  );
  return {
    programs: db.programs
      .filter((p) => programIds.has(p.id))
      .map((p) => ({ programId: p.id, code: p.code, name: p.name }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    terms: semesters
      .map((s) => ({
        semesterId: s.id,
        programId: s.programId,
        yearLevel: s.yearLevel,
        label: `${termName(s.id).termLabel} · ${toSemesterView(s).academicYearLabel}`,
        gradesDueDate: s.gradesDueDate,
        startDate: s.startDate,
      }))
      .sort((a, b) => a.yearLevel - b.yearLevel || a.label.localeCompare(b.label)),
    sections: db.sections
      .filter(
        (sec) =>
          sec.isActive && semesters.some((s) => s.programId === sec.programId && s.yearLevel === sec.yearLevel),
      )
      .map((sec) => ({ sectionId: sec.id, programId: sec.programId, yearLevel: sec.yearLevel, code: sec.code }))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    scholarships: SCHOLARSHIPS.map((x) => ({ code: x.code, label: x.label })),
    classes: classes.map((c) => {
      const facts = classFacts(c.id);
      const semester = semesters.find((s) => s.id === c.semesterId);
      return {
        classScheduleId: c.id,
        semesterId: c.semesterId,
        programId: semester?.programId ?? '',
        sectionId: c.sectionId,
        batches: [...facts.batches],
        scholarships: [...facts.scholarships],
      };
    }),
    rules: rules
      .map(
        (o): DeadlineRuleView => ({
          ...toOverrideView(o),
          ...termName(o.semesterId),
          classCount: classes.filter(
            (c) =>
              c.semesterId === o.semesterId &&
              ruleMatches(o, c, () => classFacts(c.id)) &&
              dueDateFor(c) === o.dueDate,
          ).length,
        }),
      )
      .sort((a, b) => a.programCode.localeCompare(b.programCode) || a.dueDate.localeCompare(b.dueDate)),
  };
}

export interface DeadlineRuleInput {
  programId: string;
  /** One open term, or null for every open term of the diploma (or of the section's year level). */
  semesterId: string | null;
  sectionId: string | null;
  scholarship: ScholarshipCode | null;
  batch: string | null;
  dueDate: string;
}

/**
 * Sets one grade deadline across a diploma in a single step, narrowed by
 * section, scholarship and batch as chosen. With nothing narrowed it is the
 * terms' own deadline. Setting the same choice again moves its date.
 */
export function setDeadlineRule(input: DeadlineRuleInput): DeadlineRuleOptions {
  const actor = requireRole('REGISTRAR');
  if (!input?.programId) throw badRequest('Choose the diploma.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? '')) throw badRequest('Give the due date.');
  const section = input.sectionId ? db.sections.find((x) => x.id === input.sectionId) : undefined;
  if (input.sectionId && (!section || section.programId !== input.programId)) {
    throw badRequest('That section is not in this diploma.');
  }
  if (input.scholarship && !SCHOLARSHIPS.some((x) => x.code === input.scholarship)) {
    throw badRequest('That is not one of the scholarships.');
  }
  const batch = input.batch?.trim() || null;
  if (batch && !/^\d{4}$/.test(batch)) throw badRequest('A batch is a year, e.g. 2026.');

  const semesters = openSemesters().filter(
    (s) =>
      s.programId === input.programId &&
      (!input.semesterId || s.id === input.semesterId) &&
      (!section || s.yearLevel === section.yearLevel),
  );
  if (semesters.length === 0) {
    throw badRequest('No open term matches that choice. Open the term first under School Years & Semesters.');
  }
  const early = semesters.find((s) => input.dueDate < s.startDate);
  if (early) throw badRequest(`Grades cannot fall due before the term starts (${early.startDate}).`);

  const narrowed = Boolean(section || input.scholarship || batch);
  for (const semester of semesters) {
    if (!narrowed) {
      semester.gradesDueDate = input.dueDate;
      continue;
    }
    const same = db.gradeDeadlineOverrides.find(
      (o) =>
        o.semesterId === semester.id &&
        o.classScheduleId == null &&
        o.subjectId == null &&
        (o.sectionId ?? null) === (section?.id ?? null) &&
        (o.scholarship ?? null) === (input.scholarship ?? null) &&
        (o.batch ?? null) === batch,
    );
    if (same) {
      same.dueDate = input.dueDate;
    } else {
      db.gradeDeadlineOverrides.push({
        id: nextId('gdo'),
        semesterId: semester.id,
        subjectId: null,
        batch,
        sectionId: section?.id ?? null,
        scholarship: input.scholarship ?? null,
        classScheduleId: null,
        dueDate: input.dueDate,
        createdByUserId: actor.id,
        createdAt: nowIso(),
      });
    }
  }

  const program = db.programs.find((p) => p.id === input.programId);
  const scope = [
    program?.code ?? 'Diploma',
    section?.code,
    input.scholarship ? scholarshipSpec(input.scholarship).label : null,
    batch ? `Batch ${batch}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  for (const semester of semesters) {
    recordAudit({
      action: 'GRADE_DEADLINE_SET',
      recordType: 'Semester',
      recordId: semester.id,
      actor,
      detail: `Grades due ${input.dueDate} for ${scope} (${termName(semester.id).termLabel}).`,
    });
  }
  return getDeadlineRuleOptions();
}

/** Removes a rule; its classes fall back to the next rule that matches, or the term's date. */
export function removeDeadlineRule(overrideId: string): DeadlineRuleOptions {
  removeDeadlineOverride(overrideId);
  return getDeadlineRuleOptions();
}
