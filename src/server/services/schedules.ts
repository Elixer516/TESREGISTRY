/**
 * Class schedules and conflict detection.
 *
 * A conflict exists when two schedules share a term, share at least one day,
 * overlap in time, AND contend for the same exclusive resource — the section,
 * the trainer, or a real room. Time ranges are half-open, so 09:00–11:00 and
 * 11:00–13:00 sit next to each other without conflicting.
 *
 * When a conflict is found the save is refused. There is no override.
 */

import type { ClassSchedule, CsvRowError, DayCode, Faculty, ScheduleConflictDetail, Term } from '@/types';
import type { ClassScheduleView, FacultyScheduleImportResult, FacultyScheduleImportRow } from '@/types/views';
import { ApiError, badRequest, notFound, validationFailed } from '@/lib/api-error';
import {
  daysIntersect,
  formatDayPattern,
  formatTimeRange,
  normalizeTime,
  parseDayPattern,
  rangesOverlap,
  sameRoom,
  sortDays,
  timeToMinutes,
} from '@/lib/schedule-time';
import { db, nextId, nowIso } from '../repositories/db';
import {
  facultyDisplayName,
  getFaculty,
  getSection,
  getSemester,
  getSubject,
  toScheduleView,
} from '../repositories/lookups';
import { requireRole, requireSession } from '../auth';
import { recordAudit } from './audit';
import { notify } from './notifications';

/* ---------------------------------------------------------------- */
/* Visibility                                                        */
/* ---------------------------------------------------------------- */

/**
 * DRAFT rows belong to the Registrar alone. This is enforced here, in the
 * service — pages that forget to filter still cannot leak them.
 */
function visibleTo(schedule: ClassSchedule, role: string): boolean {
  if (schedule.status === 'PUBLISHED') return true;
  return role === 'REGISTRAR';
}

export interface ScheduleFilters {
  semesterId?: string;
  sectionId?: string;
  facultyId?: string;
  subjectId?: string;
  status?: 'ALL' | 'DRAFT' | 'PUBLISHED';
  query?: string;
}

export function listSchedules(filters: ScheduleFilters = {}): ClassScheduleView[] {
  const user = requireSession();

  let rows = db.classSchedules.filter((s) => visibleTo(s, user.role));

  if (filters.semesterId) rows = rows.filter((s) => s.semesterId === filters.semesterId);
  if (filters.sectionId) rows = rows.filter((s) => s.sectionId === filters.sectionId);
  if (filters.facultyId) rows = rows.filter((s) => s.facultyId === filters.facultyId);
  if (filters.subjectId) rows = rows.filter((s) => s.subjectId === filters.subjectId);
  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((s) => s.status === filters.status);
  }

  let views = rows.map(toScheduleView);

  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    views = views.filter((v) =>
      [v.subjectCode, v.subjectTitle, v.sectionCode, v.trainerName, v.room, v.dayPattern]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }

  return views.sort(
    (a, b) =>
      a.sectionCode.localeCompare(b.sectionCode) ||
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      a.subjectCode.localeCompare(b.subjectCode),
  );
}

export function getScheduleView(id: string): ClassScheduleView {
  const user = requireSession();
  const schedule = db.classSchedules.find((s) => s.id === id);
  if (!schedule || !visibleTo(schedule, user.role)) {
    throw notFound('That class schedule could not be found.');
  }
  return toScheduleView(schedule);
}

/* ---------------------------------------------------------------- */
/* Conflict detection                                                */
/* ---------------------------------------------------------------- */

const RULE_LABELS: Record<ScheduleConflictDetail['rule'], string> = {
  SECTION: 'The section is already in another class at that time',
  TRAINER: 'The trainer is already handling another class at that time',
  ROOM: 'The room is already booked at that time',
};

interface ConflictCandidate {
  semesterId: string;
  sectionId: string;
  facultyId: string | null;
  days: DayCode[];
  startTime: string;
  endTime: string;
  room: string;
}

/**
 * Return every conflict the candidate would create. Draft rows are included —
 * a room a draft is holding is genuinely contested, and letting a save through
 * now would only break at publish time.
 *
 * `pool` defaults to the live table but accepts a scratch array instead, so a
 * bulk import can validate a whole batch against a virtual "what if every row
 * so far had committed" view before touching the real data at all.
 */
export function findConflicts(
  candidate: ConflictCandidate,
  ignoreScheduleId?: string,
  pool: ClassSchedule[] = db.classSchedules,
): ScheduleConflictDetail[] {
  const conflicts: ScheduleConflictDetail[] = [];

  for (const existing of pool) {
    if (existing.id === ignoreScheduleId) continue;
    if (existing.semesterId !== candidate.semesterId) continue;

    const sharedDays = daysIntersect(candidate.days, existing.days);
    if (sharedDays.length === 0) continue;

    if (
      !rangesOverlap(
        candidate.startTime,
        candidate.endTime,
        existing.startTime,
        existing.endTime,
      )
    ) {
      continue;
    }

    const rules: ScheduleConflictDetail['rule'][] = [];
    if (existing.sectionId === candidate.sectionId) rules.push('SECTION');
    if (
      candidate.facultyId &&
      existing.facultyId &&
      existing.facultyId === candidate.facultyId
    ) {
      rules.push('TRAINER');
    }
    if (sameRoom(existing.room, candidate.room)) rules.push('ROOM');

    if (rules.length === 0) continue;

    const subject = db.subjects.find((s) => s.id === existing.subjectId);
    const section = db.sections.find((s) => s.id === existing.sectionId);

    for (const rule of rules) {
      conflicts.push({
        rule,
        ruleLabel: RULE_LABELS[rule],
        scheduleId: existing.id,
        subjectCode: subject?.code ?? '—',
        subjectTitle: subject?.title ?? 'Unknown subject',
        sectionCode: section?.code ?? '—',
        days: sortDays(existing.days),
        timeRange: formatTimeRange(existing.startTime, existing.endTime),
        room: existing.room,
        trainerName: facultyDisplayName(existing.facultyId),
      });
    }
  }

  return conflicts;
}

/* ---------------------------------------------------------------- */
/* Writes                                                            */
/* ---------------------------------------------------------------- */

export interface ScheduleInput {
  semesterId: string;
  subjectId: string;
  sectionId: string;
  facultyId: string | null;
  /** Either canonical day codes or a raw pattern such as "TTh". */
  days: DayCode[];
  startTime: string;
  endTime: string;
  room: string;
}

interface NormalizedInput {
  days: DayCode[];
  startTime: string;
  endTime: string;
  room: string;
}

function normalizeInput(input: ScheduleInput): NormalizedInput {
  const days = sortDays(input.days);
  if (days.length === 0) {
    throw badRequest('Choose at least one day for this class.');
  }

  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (!startTime) throw badRequest(`"${input.startTime}" is not a readable start time.`);
  if (!endTime) throw badRequest(`"${input.endTime}" is not a readable end time.`);
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw badRequest('The end time must be later than the start time.');
  }

  return { days, startTime, endTime, room: input.room.trim() };
}

function conflictError(conflicts: ScheduleConflictDetail[]): ApiError {
  const first = conflicts[0];
  return new ApiError(
    409,
    'SCHEDULE_CONFLICT',
    `This class clashes with ${first.subjectCode} (${first.sectionCode}). ${first.ruleLabel}.`,
    { conflicts },
  );
}

export function createSchedule(input: ScheduleInput): ClassScheduleView {
  const actor = requireRole('REGISTRAR');
  getSemester(input.semesterId);
  const subject = getSubject(input.subjectId);
  const section = getSection(input.sectionId);
  if (input.facultyId) getFaculty(input.facultyId);

  const normalized = normalizeInput(input);

  const conflicts = findConflicts({
    semesterId: input.semesterId,
    sectionId: input.sectionId,
    facultyId: input.facultyId,
    ...normalized,
  });

  if (conflicts.length > 0) {
    recordAudit({
      action: 'SCHEDULE_CONFLICT_BLOCKED',
      recordType: 'ClassSchedule',
      recordId: 'new',
      actor,
      detail: `Save blocked — ${subject.code} for ${section.code} clashes with ${conflicts.length} existing schedule row(s).`,
      after: { conflicts: conflicts.map((c) => c.scheduleId) },
    });
    throw conflictError(conflicts);
  }

  const schedule: ClassSchedule = {
    id: nextId('sch'),
    semesterId: input.semesterId,
    subjectId: input.subjectId,
    sectionId: input.sectionId,
    facultyId: input.facultyId,
    days: normalized.days,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    room: normalized.room,
    status: 'DRAFT',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.classSchedules.push(schedule);

  if (input.facultyId) {
    db.facultyAssignments.push({
      id: nextId('fa'),
      facultyId: input.facultyId,
      classScheduleId: schedule.id,
      assignedAt: nowIso(),
    });
  }

  recordAudit({
    action: 'SCHEDULE_CREATED',
    recordType: 'ClassSchedule',
    recordId: schedule.id,
    actor,
    detail: `${subject.code} for ${section.code} created as a draft (${formatDayPattern(
      schedule.days,
    )} ${formatTimeRange(schedule.startTime, schedule.endTime)}).`,
    after: { ...schedule },
  });
  return toScheduleView(schedule);
}

export function updateSchedule(id: string, input: ScheduleInput): ClassScheduleView {
  const actor = requireRole('REGISTRAR');
  const schedule = db.classSchedules.find((s) => s.id === id);
  if (!schedule) throw notFound('That class schedule could not be found.');

  getSemester(input.semesterId);
  const subject = getSubject(input.subjectId);
  const section = getSection(input.sectionId);
  if (input.facultyId) getFaculty(input.facultyId);

  const normalized = normalizeInput(input);

  const conflicts = findConflicts(
    {
      semesterId: input.semesterId,
      sectionId: input.sectionId,
      facultyId: input.facultyId,
      ...normalized,
    },
    id,
  );

  if (conflicts.length > 0) {
    recordAudit({
      action: 'SCHEDULE_CONFLICT_BLOCKED',
      recordType: 'ClassSchedule',
      recordId: schedule.id,
      actor,
      detail: `Edit blocked — ${subject.code} for ${section.code} would clash with ${conflicts.length} existing schedule row(s).`,
      after: { conflicts: conflicts.map((c) => c.scheduleId) },
    });
    throw conflictError(conflicts);
  }

  const before = { ...schedule };
  schedule.semesterId = input.semesterId;
  schedule.subjectId = input.subjectId;
  schedule.sectionId = input.sectionId;
  schedule.facultyId = input.facultyId;
  schedule.days = normalized.days;
  schedule.startTime = normalized.startTime;
  schedule.endTime = normalized.endTime;
  schedule.room = normalized.room;
  schedule.updatedAt = nowIso();

  recordAudit({
    action: 'SCHEDULE_UPDATED',
    recordType: 'ClassSchedule',
    recordId: schedule.id,
    actor,
    detail: `${subject.code} for ${section.code} updated.`,
    before,
    after: { ...schedule },
  });
  return toScheduleView(schedule);
}

export function publishSchedule(id: string): ClassScheduleView {
  const actor = requireRole('REGISTRAR');
  const schedule = db.classSchedules.find((s) => s.id === id);
  if (!schedule) throw notFound('That class schedule could not be found.');
  if (schedule.status === 'PUBLISHED') {
    throw badRequest('This schedule is already published.');
  }

  // Re-check at publish time: the grid may have changed since the draft was saved.
  const conflicts = findConflicts(
    {
      semesterId: schedule.semesterId,
      sectionId: schedule.sectionId,
      facultyId: schedule.facultyId,
      days: schedule.days,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      room: schedule.room,
    },
    schedule.id,
  );
  if (conflicts.length > 0) throw conflictError(conflicts);

  schedule.status = 'PUBLISHED';
  schedule.updatedAt = nowIso();

  const view = toScheduleView(schedule);

  // Everyone attached to the section learns about it.
  const students = db.students.filter((s) => s.sectionId === schedule.sectionId);
  for (const student of students) {
    const account = db.users.find((u) => u.studentId === student.id);
    if (account) {
      notify({
        userId: account.id,
        title: 'Class schedule published',
        body: `${view.subjectCode} — ${view.dayPattern} ${view.timeRange}, ${view.room}.`,
        category: 'SCHEDULE',
        link: '/portal/schedule',
      });
    }
  }
  if (schedule.facultyId) {
    const trainerAccount = db.users.find((u) => u.facultyId === schedule.facultyId);
    if (trainerAccount) {
      notify({
        userId: trainerAccount.id,
        title: 'You have a published class',
        body: `${view.subjectCode} for ${view.sectionCode} — ${view.dayPattern} ${view.timeRange}.`,
        category: 'SCHEDULE',
        link: '/schedules',
      });
    }
  }

  recordAudit({
    action: 'SCHEDULE_PUBLISHED',
    recordType: 'ClassSchedule',
    recordId: schedule.id,
    actor,
    detail: `${view.subjectCode} for ${view.sectionCode} published.`,
    after: { ...schedule },
  });
  return view;
}

export function unpublishSchedule(id: string): ClassScheduleView {
  const actor = requireRole('REGISTRAR');
  const schedule = db.classSchedules.find((s) => s.id === id);
  if (!schedule) throw notFound('That class schedule could not be found.');
  if (schedule.status === 'DRAFT') {
    throw badRequest('This schedule is already a draft.');
  }

  schedule.status = 'DRAFT';
  schedule.updatedAt = nowIso();
  const view = toScheduleView(schedule);

  recordAudit({
    action: 'SCHEDULE_UNPUBLISHED',
    recordType: 'ClassSchedule',
    recordId: schedule.id,
    actor,
    detail: `${view.subjectCode} for ${view.sectionCode} returned to draft. It is now hidden from trainees until republished.`,
  });
  return view;
}

export function deleteSchedule(id: string): void {
  const actor = requireRole('REGISTRAR');
  const index = db.classSchedules.findIndex((s) => s.id === id);
  if (index === -1) throw notFound('That class schedule could not be found.');

  const schedule = db.classSchedules[index];
  const attached = db.enrollmentSubjects.filter((es) => es.classScheduleId === schedule.id);
  if (attached.length > 0) {
    throw badRequest(
      `${attached.length} enrolled subject row${attached.length === 1 ? '' : 's'} point at this schedule. Unenroll them first, or unpublish it instead of deleting.`,
    );
  }

  const view = toScheduleView(schedule);
  db.classSchedules.splice(index, 1);
  db.facultyAssignments = db.facultyAssignments.filter(
    (fa) => fa.classScheduleId !== schedule.id,
  );

  recordAudit({
    action: 'SCHEDULE_DELETED',
    recordType: 'ClassSchedule',
    recordId: schedule.id,
    actor,
    detail: `${view.subjectCode} for ${view.sectionCode} deleted.`,
    before: { ...schedule },
  });
}

/* ---------------------------------------------------------------- */
/* Convenience reads                                                 */
/* ---------------------------------------------------------------- */

/** Published schedules for one section — what a trainee's week is built from. */
export function schedulesForSection(
  sectionId: string,
  semesterId: string,
): ClassScheduleView[] {
  requireSession();
  return db.classSchedules
    .filter(
      (s) =>
        s.sectionId === sectionId &&
        s.semesterId === semesterId &&
        s.status === 'PUBLISHED',
    )
    .map(toScheduleView)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/* ---------------------------------------------------------------- */
/* Dataset import — Faculty and their schedules, combined            */
/* ---------------------------------------------------------------- */

interface ResolvedFacultyScheduleRow {
  row: FacultyScheduleImportRow;
  rowNumber: number;
  subjectId: string;
  subjectCode: string;
  sectionId: string;
  sectionCode: string;
  days: DayCode[];
  startTime: string;
  endTime: string;
  room: string;
}

/**
 * A trainor's row already carries their subject's schedule, so importing the
 * file both creates/updates the Faculty record (matched by Employee ID) and
 * publishes the class in one pass — there is no separate "assign a trainor"
 * step afterwards. Validated in two stages, fully atomic: field-level
 * problems (unknown subject, unreadable time, …) are collected first; only if
 * every row clears that does the function check for schedule conflicts
 * against a scratch copy of the live data, so a conflict discovered on row 40
 * still leaves rows 1–39 uncommitted.
 */
export function importFacultyAndSchedules(
  rows: FacultyScheduleImportRow[],
  semesterId: string,
): FacultyScheduleImportResult {
  const actor = requireRole('REGISTRAR');

  if (rows.length === 0) {
    throw badRequest('The file contained no data rows.');
  }
  getSemester(semesterId);

  const errors: CsvRowError[] = [];
  const resolved: ResolvedFacultyScheduleRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    if (!row.employeeId?.trim()) {
      errors.push({ row: rowNumber, field: 'employeeId', message: 'Employee ID is required.' });
    }
    if (!row.firstName?.trim()) {
      errors.push({ row: rowNumber, field: 'firstName', message: 'First name is required.' });
    }
    if (!row.lastName?.trim()) {
      errors.push({ row: rowNumber, field: 'lastName', message: 'Last name is required.' });
    }

    const subjectCode = row.subjectCode?.trim().toUpperCase() ?? '';
    const subject = db.subjects.find((s) => s.code.toUpperCase() === subjectCode);
    if (!subjectCode) {
      errors.push({ row: rowNumber, field: 'subjectCode', message: 'Subject code is required.' });
    } else if (!subject) {
      errors.push({
        row: rowNumber,
        field: 'subjectCode',
        message: `Unknown subject code "${row.subjectCode}".`,
      });
    }

    const sectionCode = row.sectionCode?.trim().toUpperCase() ?? '';
    const section = db.sections.find((s) => s.code.toUpperCase() === sectionCode);
    if (!sectionCode) {
      errors.push({ row: rowNumber, field: 'sectionCode', message: 'Section code is required.' });
    } else if (!section) {
      errors.push({
        row: rowNumber,
        field: 'sectionCode',
        message: `Unknown section code "${row.sectionCode}".`,
      });
    }

    const days = parseDayPattern(row.days ?? '');
    if (days.length === 0) {
      errors.push({
        row: rowNumber,
        field: 'days',
        message: `Could not read any day from "${row.days}".`,
      });
    }

    const startTime = normalizeTime(row.startTime ?? '');
    const endTime = normalizeTime(row.endTime ?? '');
    if (!startTime) {
      errors.push({
        row: rowNumber,
        field: 'startTime',
        message: `"${row.startTime}" is not a readable start time.`,
      });
    }
    if (!endTime) {
      errors.push({
        row: rowNumber,
        field: 'endTime',
        message: `"${row.endTime}" is not a readable end time.`,
      });
    }
    if (startTime && endTime && timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      errors.push({
        row: rowNumber,
        field: 'endTime',
        message: 'The end time must be later than the start time.',
      });
    }

    if (subject && section && days.length > 0 && startTime && endTime) {
      resolved.push({
        row,
        rowNumber,
        subjectId: subject.id,
        subjectCode: subject.code,
        sectionId: section.id,
        sectionCode: section.code,
        days,
        startTime,
        endTime,
        room: row.room?.trim() ?? '',
      });
    }
  });

  if (errors.length > 0) {
    throw validationFailed(
      `${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was imported — fix the file and try again.`,
      { rowErrors: errors },
    );
  }

  // Stage two: resolve Faculty and check schedule conflicts against scratch
  // copies. Nothing below this line touches the real tables until every row
  // has been proven conflict-free.
  const facultyPool = [...db.faculty];
  const schedulePool = [...db.classSchedules];
  const employeeIdToFacultyId = new Map<string, string>();
  const toCreateFaculty: Faculty[] = [];
  const toUpdateFaculty: Faculty[] = [];
  const toCreateSchedules: ClassSchedule[] = [];
  const scheduleErrors: CsvRowError[] = [];

  for (const item of resolved) {
    const employeeId = item.row.employeeId.trim();
    const key = employeeId.toLowerCase();

    let facultyId = employeeIdToFacultyId.get(key);
    if (!facultyId) {
      const existing = facultyPool.find((f) => f.employeeId.toLowerCase() === key);
      if (existing) {
        existing.firstName = item.row.firstName.trim();
        existing.lastName = item.row.lastName.trim();
        existing.department = item.row.department?.trim() || existing.department;
        existing.position = item.row.position?.trim() || existing.position;
        existing.email = item.row.email?.trim() || existing.email;
        existing.contactNumber = item.row.contactNumber?.trim() || existing.contactNumber;
        if (!toUpdateFaculty.includes(existing)) toUpdateFaculty.push(existing);
        facultyId = existing.id;
      } else {
        const created: Faculty = {
          id: nextId('fac'),
          employeeId,
          firstName: item.row.firstName.trim(),
          lastName: item.row.lastName.trim(),
          department: item.row.department?.trim() ?? '',
          position: item.row.position?.trim() ?? '',
          email: item.row.email?.trim() ?? '',
          contactNumber: item.row.contactNumber?.trim() ?? '',
          isActive: true,
          createdAt: nowIso(),
        };
        facultyPool.push(created);
        toCreateFaculty.push(created);
        facultyId = created.id;
      }
      employeeIdToFacultyId.set(key, facultyId);
    }

    const conflicts = findConflicts(
      {
        semesterId,
        sectionId: item.sectionId,
        facultyId,
        days: item.days,
        startTime: item.startTime,
        endTime: item.endTime,
        room: item.room,
      },
      undefined,
      schedulePool,
    );

    if (conflicts.length > 0) {
      scheduleErrors.push({
        row: item.rowNumber,
        field: 'days',
        message: `${item.subjectCode} for ${item.sectionCode} clashes with ${conflicts[0].subjectCode} (${conflicts[0].sectionCode}). ${conflicts[0].ruleLabel}.`,
      });
      continue;
    }

    const schedule: ClassSchedule = {
      id: nextId('sch'),
      semesterId,
      subjectId: item.subjectId,
      sectionId: item.sectionId,
      facultyId,
      days: item.days,
      startTime: item.startTime,
      endTime: item.endTime,
      room: item.room,
      status: 'PUBLISHED',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    schedulePool.push(schedule);
    toCreateSchedules.push(schedule);
  }

  if (scheduleErrors.length > 0) {
    throw validationFailed(
      `${scheduleErrors.length} schedule conflict${scheduleErrors.length === 1 ? '' : 's'} found. Nothing was imported — fix the file and try again.`,
      { rowErrors: scheduleErrors },
    );
  }

  // Every row passed — commit for real.
  db.faculty.push(...toCreateFaculty);
  db.classSchedules.push(...toCreateSchedules);
  for (const schedule of toCreateSchedules) {
    if (!schedule.facultyId) continue;
    db.facultyAssignments.push({
      id: nextId('fa'),
      facultyId: schedule.facultyId,
      classScheduleId: schedule.id,
      assignedAt: nowIso(),
    });
  }

  recordAudit({
    action: 'SCHEDULE_CREATED',
    recordType: 'ClassSchedule',
    recordId: toCreateSchedules.map((s) => s.id).join(','),
    actor,
    detail: `${toCreateSchedules.length} class(es) imported and published from a Faculty & Schedule file (${toCreateFaculty.length} new trainor(s), ${toUpdateFaculty.length} updated).`,
    after: { count: toCreateSchedules.length },
  });

  return {
    facultyCreated: toCreateFaculty.length,
    facultyUpdated: toUpdateFaculty.length,
    schedulesPublished: toCreateSchedules.length,
  };
}

export function termOf(semesterId: string): Term {
  return getSemester(semesterId).term;
}
