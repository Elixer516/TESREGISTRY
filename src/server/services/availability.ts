/**
 * Trainer availability.
 *
 * A one-way declaration: a trainer states when they can teach, and the
 * Training Department marks it INCORPORATED once it has been taken into
 * account. Nothing is scheduled automatically — marking it incorporated
 * creates no class schedule and changes no existing one.
 */

import type { DayCode, TrainerAvailability } from '@/types';
import type { TrainerAvailabilityView } from '@/types/views';
import { badRequest, forbidden, notFound } from '@/lib/api-error';
import {
  formatDayPattern,
  formatTimeRange,
  normalizeTime,
  sortDays,
  timeToMinutes,
} from '@/lib/schedule-time';
import { db, nextId, nowIso } from '../repositories/db';
import { getFaculty, getSemester, toSemesterView, userDisplayName } from '../repositories/lookups';
import { requireRole, requireSession } from '../auth';
import { recordAudit } from './audit';
import { notify } from './notifications';

function toView(row: TrainerAvailability): TrainerAvailabilityView {
  const faculty = db.faculty.find((f) => f.id === row.facultyId);
  const semester = db.semesters.find((s) => s.id === row.semesterId);
  return {
    id: row.id,
    facultyId: row.facultyId,
    facultyName: faculty ? `${faculty.firstName} ${faculty.lastName}` : 'Unknown trainer',
    employeeId: faculty?.employeeId ?? '—',
    department: faculty?.department ?? '—',
    semesterId: row.semesterId,
    semesterLabel: semester ? toSemesterView(semester).label : '—',
    days: sortDays(row.days),
    dayPattern: formatDayPattern(row.days),
    startTime: row.startTime,
    endTime: row.endTime,
    timeRange: formatTimeRange(row.startTime, row.endTime),
    notes: row.notes,
    status: row.status,
    submittedAt: row.submittedAt,
    reviewedByName: row.reviewedByUserId ? userDisplayName(row.reviewedByUserId) : null,
    reviewedAt: row.reviewedAt,
  };
}

export function listAvailability(semesterId?: string): TrainerAvailabilityView[] {
  const user = requireSession();

  let rows = [...db.trainerAvailability];

  // A trainer sees only their own submissions.
  if (user.role === 'TRAINER') {
    rows = rows.filter((r) => r.facultyId === user.facultyId);
  } else if (user.role !== 'TRAINING_OFFICER' && user.role !== 'REGISTRAR') {
    throw forbidden('You do not have access to trainer availability.');
  }

  if (semesterId) rows = rows.filter((r) => r.semesterId === semesterId);

  return rows
    .map(toView)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export interface AvailabilityInput {
  semesterId: string;
  days: DayCode[];
  startTime: string;
  endTime: string;
  notes: string;
}

export function submitAvailability(input: AvailabilityInput): TrainerAvailabilityView {
  const actor = requireRole('TRAINER');
  if (!actor.facultyId) {
    throw badRequest('This account is not linked to a faculty record.');
  }
  getFaculty(actor.facultyId);
  getSemester(input.semesterId);

  const days = sortDays(input.days);
  if (days.length === 0) throw badRequest('Choose at least one day.');

  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (!startTime) throw badRequest(`"${input.startTime}" is not a readable start time.`);
  if (!endTime) throw badRequest(`"${input.endTime}" is not a readable end time.`);
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw badRequest('The end time must be later than the start time.');
  }

  const existing = db.trainerAvailability.find(
    (r) => r.facultyId === actor.facultyId && r.semesterId === input.semesterId,
  );
  if (existing && existing.status === 'INCORPORATED') {
    throw badRequest(
      'This submission has already been incorporated into planning and can no longer be edited. Contact the Training Department if it needs to change.',
    );
  }

  const row: TrainerAvailability = existing ?? {
    id: nextId('av'),
    facultyId: actor.facultyId,
    semesterId: input.semesterId,
    days,
    startTime,
    endTime,
    notes: input.notes.trim(),
    status: 'SUBMITTED',
    submittedAt: nowIso(),
    reviewedByUserId: null,
    reviewedAt: null,
  };

  if (existing) {
    row.days = days;
    row.startTime = startTime;
    row.endTime = endTime;
    row.notes = input.notes.trim();
    row.submittedAt = nowIso();
  } else {
    db.trainerAvailability.push(row);
  }

  recordAudit({
    action: 'AVAILABILITY_SUBMITTED',
    recordType: 'TrainerAvailability',
    recordId: row.id,
    actor,
    detail: `Availability submitted for ${toView(row).semesterLabel}: ${formatDayPattern(
      days,
    )} ${formatTimeRange(startTime, endTime)}.`,
    after: { ...row },
  });

  for (const officer of db.users.filter(
    (u) => u.role === 'TRAINING_OFFICER' && u.status === 'APPROVED',
  )) {
    notify({
      userId: officer.id,
      title: 'New availability submission',
      body: `${actor.firstName} ${actor.lastName} submitted availability for ${
        toView(row).semesterLabel
      }.`,
      category: 'AVAILABILITY',
      link: '/availability',
    });
  }

  return toView(row);
}

/**
 * Mark a submission as taken into account. This is an acknowledgement only —
 * it creates no schedule and moves nothing on the timetable.
 */
export function incorporateAvailability(id: string): TrainerAvailabilityView {
  const actor = requireRole('TRAINING_OFFICER');
  const row = db.trainerAvailability.find((r) => r.id === id);
  if (!row) throw notFound('That availability submission could not be found.');
  if (row.status === 'INCORPORATED') {
    throw badRequest('This submission is already marked as incorporated.');
  }

  const before = { ...row };
  row.status = 'INCORPORATED';
  row.reviewedByUserId = actor.id;
  row.reviewedAt = nowIso();

  recordAudit({
    action: 'AVAILABILITY_INCORPORATED',
    recordType: 'TrainerAvailability',
    recordId: row.id,
    actor,
    detail:
      'Availability marked as incorporated into planning. No schedule was created or changed by this action.',
    before,
    after: { ...row },
  });

  const trainerAccount = db.users.find((u) => u.facultyId === row.facultyId);
  if (trainerAccount) {
    notify({
      userId: trainerAccount.id,
      title: 'Availability reviewed',
      body: 'The Training Department marked your availability as incorporated into planning.',
      category: 'AVAILABILITY',
      link: '/availability',
    });
  }

  return toView(row);
}
