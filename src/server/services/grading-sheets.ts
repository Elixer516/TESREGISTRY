/**
 * Grading sheets — the trainer's submission and the registrar's review.
 *
 * This inverts who owns grades. Before V8 the registrar encoded them
 * directly; now the trainer encodes and the registrar reviews, and the two
 * roles are enforced separately here rather than by hiding buttons.
 *
 * The one rule everything else rests on: **grades reach a trainee's record
 * only when a sheet is APPROVED**. A submitted sheet posts nothing, so a
 * transcript can never be built from figures a registrar has not seen.
 */

import type {
  ClassSchedule,
  GradeMarker,
  GradingSheet,
  GradingSheetRow,
  GradingSheetStatus,
} from '@/types';
import { ALL_GRADE_MARKERS } from '@/types';
import type {
  GradingSheetSummaryView,
  GradingSheetView,
  GradingSheetRowView,
} from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import {
  getSchedule,
  getSemester,
  toScheduleView,
  userDisplayName,
} from '../repositories/lookups';
import { lastFirst } from '@/lib/format';
import { currentUser, requireRole } from '../auth';
import { recordAudit } from './audit';
import { deriveGradeStatus, parseGrade } from './grade-rules';

/* ---------------------------------------------------------------- */
/* Reference numbers                                                 */
/* ---------------------------------------------------------------- */

/** GS-YYYYMM-XXXXX, sequential within the month. */
function nextReferenceNumber(): string {
  const now = new Date();
  const prefix = `GS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;
  let seq = 1;
  for (const sheet of db.gradingSheets) {
    if (sheet.referenceNumber.startsWith(prefix)) {
      const n = Number(sheet.referenceNumber.slice(prefix.length));
      if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

/* ---------------------------------------------------------------- */
/* Scoping                                                           */
/* ---------------------------------------------------------------- */

/**
 * The faculty record behind the signed-in trainer.
 *
 * A trainer account is bound to exactly one faculty row, and that binding is
 * what limits them to their own classes. An account without it can see
 * nothing — which is the safe direction to fail.
 */
function requireOwnFacultyId(): string {
  const user = currentUser();
  if (!user || user.role !== 'TRAINER') {
    throw badRequest('Only a trainer can do that.');
  }
  if (!user.facultyId) {
    throw badRequest(
      'This trainer account is not linked to a faculty record, so it has no classes. Ask the Registrar to link it.',
    );
  }
  return user.facultyId;
}

/** Refuses a schedule that does not belong to the signed-in trainer. */
function assertOwnSchedule(schedule: ClassSchedule): void {
  const facultyId = requireOwnFacultyId();
  if (schedule.facultyId !== facultyId) {
    throw badRequest('That class is assigned to another trainer.');
  }
}

/* ---------------------------------------------------------------- */
/* Views                                                             */
/* ---------------------------------------------------------------- */

/** "LASTNAME, Firstname" for sorting and display, or a fallback. */
function nameOf(studentId: string): string {
  const student = db.students.find((s) => s.id === studentId);
  return student ? lastFirst(student) : 'Unknown trainee';
}

function rowsFor(schedule: ClassSchedule): GradingSheetRow[] {
  // The roster is whoever is enrolled in this class, alphabetically — the
  // order the paper sheet uses.
  const enrolled = db.enrollmentSubjects.filter((es) => es.classScheduleId === schedule.id);
  const studentIds = new Set<string>();
  for (const row of enrolled) {
    const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
    if (enrollment) studentIds.add(enrollment.studentId);
  }

  return [...studentIds]
    .map((studentId) => ({
      studentId,
      marker: null,
      grade: null,
      remarks: '',
    }))
    .sort((a, b) => nameOf(a.studentId).localeCompare(nameOf(b.studentId)));
}

function toRowView(
  row: GradingSheetRow,
  index: number,
  classScheduleId: string,
): GradingSheetRowView {
  const student = db.students.find((s) => s.id === row.studentId);

  // Units and any completion grade come from the trainee's enrolled row for
  // this class — the sheet itself carries neither, and the review table shows
  // Grade | Units | Completion.
  let units = 0;
  let completionGrade: string | null = null;
  for (const enrollment of db.enrollments) {
    if (enrollment.studentId !== row.studentId) continue;
    const enrolled = db.enrollmentSubjects.find(
      (es) => es.enrollmentId === enrollment.id && es.classScheduleId === classScheduleId,
    );
    if (enrolled) {
      units = enrolled.units;
      completionGrade = enrolled.completionGrade;
      break;
    }
  }

  return {
    ...row,
    number: index + 1,
    studentName: nameOf(row.studentId),
    studentNumber: student?.studentNumber ?? '—',
    units,
    completionGrade,
  };
}

export function toGradingSheetView(sheet: GradingSheet): GradingSheetView {
  const schedule = db.classSchedules.find((s) => s.id === sheet.classScheduleId);
  const scheduleView = schedule ? toScheduleView(schedule) : null;
  const semester = schedule ? db.semesters.find((s) => s.id === schedule.semesterId) : undefined;
  const program = semester ? db.programs.find((p) => p.id === semester.programId) : undefined;
  const section = schedule ? db.sections.find((s) => s.id === schedule.sectionId) : undefined;

  const filled = sheet.rows.filter((r) => r.grade !== null || r.marker !== null).length;

  return {
    id: sheet.id,
    referenceNumber: sheet.referenceNumber,
    classScheduleId: sheet.classScheduleId,
    status: sheet.status,
    // The header block of the paper form, in its own words.
    courseCode: scheduleView?.subjectCode ?? '—',
    description: scheduleView?.subjectTitle ?? '—',
    course: program?.name ?? '—',
    // Batch is the entry year, read off the student number rather than stored
    // a second time. The section's own cohort is what the sheet is about.
    batch: batchOf(sheet.rows),
    levelSemester: scheduleView?.semesterLabel ?? '—',
    academicYearLabel: scheduleView?.academicYearLabel ?? '—',
    sectionCode: section?.code ?? '—',
    trainerName: scheduleView?.trainerName ?? 'Unassigned',
    dayPattern: scheduleView?.dayPattern ?? '—',
    timeRange: scheduleView?.timeRange ?? '—',
    room: scheduleView?.room ?? '—',
    rows: sheet.rows.map((row, index) => toRowView(row, index, sheet.classScheduleId)),
    filledCount: filled,
    rowCount: sheet.rows.length,
    isComplete: sheet.rows.length > 0 && filled === sheet.rows.length,
    registrarRemarks: sheet.registrarRemarks,
    submittedByName: sheet.submittedByUserId ? userDisplayName(sheet.submittedByUserId) : null,
    submittedAt: sheet.submittedAt,
    reviewedByName: sheet.reviewedByUserId ? userDisplayName(sheet.reviewedByUserId) : null,
    reviewedAt: sheet.reviewedAt,
    submissionCount: sheet.submissionCount,
  };
}

/** The earliest entry year on the roster — "Batch 2024" on the paper form. */
function batchOf(rows: GradingSheetRow[]): string {
  const years: number[] = [];
  for (const row of rows) {
    const student = db.students.find((s) => s.id === row.studentId);
    const year = Number(student?.studentNumber.slice(0, 4));
    if (Number.isFinite(year)) years.push(year);
  }
  if (years.length === 0) return '—';
  return String(Math.min(...years));
}

function toSummary(sheet: GradingSheet): GradingSheetSummaryView {
  const view = toGradingSheetView(sheet);
  return {
    id: view.id,
    referenceNumber: view.referenceNumber,
    status: view.status,
    courseCode: view.courseCode,
    description: view.description,
    course: view.course,
    sectionCode: view.sectionCode,
    levelSemester: view.levelSemester,
    academicYearLabel: view.academicYearLabel,
    trainerName: view.trainerName,
    dayPattern: view.dayPattern,
    timeRange: view.timeRange,
    room: view.room,
    filledCount: view.filledCount,
    rowCount: view.rowCount,
    isComplete: view.isComplete,
    submittedAt: view.submittedAt,
    reviewedAt: view.reviewedAt,
    submissionCount: view.submissionCount,
  };
}

/* ---------------------------------------------------------------- */
/* Trainer side                                                      */
/* ---------------------------------------------------------------- */

/**
 * Every class the signed-in trainer is assigned, with its sheet if one has
 * been started. Published schedules only — a draft class has no roster worth
 * grading yet.
 */
export function myClasses(): GradingSheetSummaryView[] {
  requireRole('TRAINER');
  const facultyId = requireOwnFacultyId();

  return db.classSchedules
    .filter((s) => s.facultyId === facultyId && s.status === 'PUBLISHED')
    .map((schedule) => {
      const existing = db.gradingSheets.find((g) => g.classScheduleId === schedule.id);
      return existing ? toSummary(existing) : toSummary(draftFor(schedule));
    })
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
}

/** An unsaved sheet, so a class with no submission still renders a roster. */
function draftFor(schedule: ClassSchedule): GradingSheet {
  const now = nowIso();
  return {
    id: `draft-${schedule.id}`,
    referenceNumber: '',
    classScheduleId: schedule.id,
    status: 'DRAFT',
    rows: rowsFor(schedule),
    submittedByUserId: null,
    submittedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    registrarRemarks: '',
    submissionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** The sheet for one class, creating an in-memory draft if none exists yet. */
export function getSheetForClass(classScheduleId: string): GradingSheetView {
  requireRole('TRAINER');
  const schedule = getSchedule(classScheduleId);
  assertOwnSchedule(schedule);

  const existing = db.gradingSheets.find((g) => g.classScheduleId === classScheduleId);
  if (existing) return toGradingSheetView(existing);
  return toGradingSheetView(draftFor(schedule));
}

/**
 * Reopen a sent-back sheet by its reference number.
 *
 * This is how a trainer returns to a PENDING sheet — the registrar gives them
 * the number over the phone. It resolves only their own sheets, so a guessed
 * number reaches nothing.
 */
export function getSheetByReference(referenceNumber: string): GradingSheetView {
  requireRole('TRAINER');
  const facultyId = requireOwnFacultyId();
  const code = referenceNumber.trim().toUpperCase();
  if (!code) throw badRequest('Enter a reference number.');

  const sheet = db.gradingSheets.find((g) => g.referenceNumber.toUpperCase() === code);
  if (!sheet) throw notFound('No grading sheet matches that reference number.');

  const schedule = db.classSchedules.find((s) => s.id === sheet.classScheduleId);
  if (!schedule || schedule.facultyId !== facultyId) {
    throw notFound('No grading sheet matches that reference number.');
  }
  return toGradingSheetView(sheet);
}

export interface SheetEntryInput {
  studentId: string;
  /** Raw text as typed: a grade like 1.75, a marker, or blank. */
  value: string;
  remarks: string;
}

/**
 * Submit or resubmit a sheet.
 *
 * A sheet that has been sent back is EDITED, never re-keyed — the caller sends
 * the whole roster back, pre-filled from what it received, and the existing
 * rows are replaced wholesale. Approval requires every row to carry something,
 * so a blank is refused here rather than silently accepted and caught later.
 */
export function submitGradingSheet(
  classScheduleId: string,
  entries: SheetEntryInput[],
): GradingSheetView {
  const actor = requireRole('TRAINER');
  const schedule = getSchedule(classScheduleId);
  assertOwnSchedule(schedule);

  const existing = db.gradingSheets.find((g) => g.classScheduleId === classScheduleId);
  if (existing && existing.status === 'APPROVED') {
    throw badRequest(
      `${existing.referenceNumber} has already been approved. Ask the Registrar to reopen it before changing anything.`,
    );
  }
  if (existing && existing.status === 'SUBMITTED') {
    throw badRequest(
      `${existing.referenceNumber} is already with the Registrar for review. You will be able to edit it if it is sent back.`,
    );
  }

  const roster = existing ? existing.rows : rowsFor(schedule);
  if (roster.length === 0) {
    throw badRequest('Nobody is enrolled in this class yet, so there is nothing to grade.');
  }

  const byStudent = new Map(entries.map((e) => [e.studentId, e]));
  const problems: string[] = [];
  const rows: GradingSheetRow[] = [];

  for (const existingRow of roster) {
    const entry = byStudent.get(existingRow.studentId);
    const who = nameOf(existingRow.studentId);
    const raw = (entry?.value ?? '').trim();

    if (!raw) {
      problems.push(`${who} has no grade.`);
      continue;
    }

    const marker = ALL_GRADE_MARKERS.find((m) => m === raw.toUpperCase()) as
      | GradeMarker
      | undefined;
    if (marker) {
      rows.push({
        studentId: existingRow.studentId,
        marker,
        grade: null,
        remarks: (entry?.remarks ?? '').trim(),
      });
      continue;
    }

    const parsed = parseGrade(raw);
    if (!parsed.ok || !parsed.value) {
      problems.push(`${who}: ${parsed.message || 'that is not a valid grade.'}`);
      continue;
    }
    rows.push({
      studentId: existingRow.studentId,
      marker: null,
      // Stored as typed. There is no conversion step any more, so what the
      // registrar reviews is exactly what the trainer entered.
      grade: parsed.value,
      remarks: (entry?.remarks ?? '').trim(),
    });
  }

  if (problems.length > 0) {
    throw badRequest(
      `This sheet was not submitted. Every trainee needs a grade from 1.00 to 5.00, or one of ${ALL_GRADE_MARKERS.join(', ')}.\n\n${problems.join('\n')}`,
    );
  }

  const now = nowIso();
  const isResubmission = Boolean(existing);

  const sheet: GradingSheet = existing ?? {
    id: nextId('gs'),
    referenceNumber: nextReferenceNumber(),
    classScheduleId,
    status: 'SUBMITTED',
    rows: [],
    submittedByUserId: null,
    submittedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    registrarRemarks: '',
    submissionCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  sheet.rows = rows;
  sheet.status = 'SUBMITTED';
  sheet.submittedByUserId = actor.id;
  sheet.submittedAt = now;
  sheet.submissionCount += 1;
  sheet.updatedAt = now;
  // The previous round's remarks are cleared — they described a version that
  // no longer exists.
  sheet.registrarRemarks = '';

  if (!existing) db.gradingSheets.push(sheet);

  recordAudit({
    action: isResubmission ? 'GRADING_SHEET_RESUBMITTED' : 'GRADING_SHEET_SUBMITTED',
    recordType: 'GradingSheet',
    recordId: sheet.id,
    actor,
    detail: `${sheet.referenceNumber} ${isResubmission ? 'resubmitted' : 'submitted'} for ${
      toScheduleView(schedule).subjectCode
    } (${rows.length} trainees, submission ${sheet.submissionCount}).`,
    after: { referenceNumber: sheet.referenceNumber, status: sheet.status },
  });

  return toGradingSheetView(sheet);
}

/* ---------------------------------------------------------------- */
/* Registrar side                                                    */
/* ---------------------------------------------------------------- */

export interface GradingSheetFilters {
  status?: GradingSheetStatus | 'ALL';
  semesterId?: string;
  search?: string;
}

/** The review queue. Registrar only. */
export function listGradingSheets(
  filters: GradingSheetFilters = {},
): GradingSheetSummaryView[] {
  requireRole('REGISTRAR');
  const needle = filters.search?.trim().toLowerCase() ?? '';

  return db.gradingSheets
    .filter((sheet) => {
      if (filters.status && filters.status !== 'ALL' && sheet.status !== filters.status) {
        return false;
      }
      if (filters.semesterId) {
        const schedule = db.classSchedules.find((s) => s.id === sheet.classScheduleId);
        if (!schedule || schedule.semesterId !== filters.semesterId) return false;
      }
      if (needle) {
        const view = toSummary(sheet);
        const haystack =
          `${view.referenceNumber} ${view.courseCode} ${view.description} ${view.sectionCode} ${view.trainerName}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .map(toSummary)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export function getGradingSheet(id: string): GradingSheetView {
  requireRole('REGISTRAR');
  const sheet = db.gradingSheets.find((g) => g.id === id);
  if (!sheet) throw notFound('That grading sheet could not be found.');
  return toGradingSheetView(sheet);
}

/**
 * Approve a sheet and post its grades.
 *
 * This is the only path by which a grade reaches a trainee's record. The
 * grade is copied across exactly as the trainer entered it — V9 removed the
 * percentage layer, so there is no conversion to get wrong.
 */
export function approveGradingSheet(id: string): GradingSheetView {
  const actor = requireRole('REGISTRAR');
  const sheet = db.gradingSheets.find((g) => g.id === id);
  if (!sheet) throw notFound('That grading sheet could not be found.');
  if (sheet.status === 'APPROVED') {
    throw badRequest(`${sheet.referenceNumber} is already approved.`);
  }
  if (sheet.status !== 'SUBMITTED') {
    throw badRequest('Only a submitted sheet can be approved.');
  }

  const blank = sheet.rows.filter((r) => r.grade === null && r.marker === null);
  if (blank.length > 0) {
    throw badRequest(
      `${sheet.referenceNumber} still has ${blank.length} trainee(s) without a grade. Send it back to the trainer instead.`,
    );
  }

  const schedule = db.classSchedules.find((s) => s.id === sheet.classScheduleId);
  if (!schedule) throw notFound('The class behind this sheet no longer exists.');

  const now = nowIso();
  let posted = 0;

  for (const row of sheet.rows) {
    // An INC is carried as a marker on the sheet and becomes the grade on the
    // record; DRP and NG stay markers and post nothing.
    if (row.marker === 'INC') row.grade = 'INC';

    const enrollment = db.enrollments.find(
      (e) => e.studentId === row.studentId && e.semesterId === schedule.semesterId,
    );
    if (!enrollment) continue;
    const target = db.enrollmentSubjects.find(
      (es) => es.enrollmentId === enrollment.id && es.classScheduleId === schedule.id,
    );
    if (!target) continue;

    // DRP and NG leave the row ungraded rather than inventing a mark for it.
    target.finalGrade = row.grade;
    target.gradeStatus = deriveGradeStatus(target.finalGrade, target.completionGrade);
    target.gradedAt = now;
    target.gradedByUserId = actor.id;
    posted += 1;
  }

  sheet.status = 'APPROVED';
  sheet.reviewedByUserId = actor.id;
  sheet.reviewedAt = now;
  sheet.registrarRemarks = '';
  sheet.updatedAt = now;

  recordAudit({
    action: 'GRADING_SHEET_APPROVED',
    recordType: 'GradingSheet',
    recordId: sheet.id,
    actor,
    detail: `${sheet.referenceNumber} approved. ${posted} grade(s) posted to trainee records.`,
    after: { status: sheet.status, posted },
  });
  return toGradingSheetView(sheet);
}

/**
 * Send a sheet back to its trainer.
 *
 * Nothing is posted and nothing is erased — the trainer reopens it by
 * reference number and edits what they submitted.
 */
export function markGradingSheetPending(id: string, remarks: string): GradingSheetView {
  const actor = requireRole('REGISTRAR');
  const sheet = db.gradingSheets.find((g) => g.id === id);
  if (!sheet) throw notFound('That grading sheet could not be found.');

  const reason = remarks.trim();
  if (!reason) {
    throw badRequest(
      'Say what needs fixing. The trainer sees this when they reopen the sheet.',
    );
  }
  if (sheet.status === 'PENDING') {
    throw badRequest(`${sheet.referenceNumber} is already marked pending.`);
  }

  const now = nowIso();
  sheet.status = 'PENDING';
  sheet.registrarRemarks = reason;
  sheet.reviewedByUserId = actor.id;
  sheet.reviewedAt = now;
  sheet.updatedAt = now;

  recordAudit({
    action: 'GRADING_SHEET_MARKED_PENDING',
    recordType: 'GradingSheet',
    recordId: sheet.id,
    actor,
    detail: `${sheet.referenceNumber} sent back to the trainer. Reason: ${reason}`,
    after: { status: sheet.status },
  });
  return toGradingSheetView(sheet);
}

/** Which semesters have sheets, for the registrar's filter. */
export function gradingSheetSemesters(): string[] {
  requireRole('REGISTRAR');
  const ids = new Set<string>();
  for (const sheet of db.gradingSheets) {
    const schedule = db.classSchedules.find((s) => s.id === sheet.classScheduleId);
    if (schedule) ids.add(schedule.semesterId);
  }
  return [...ids].filter((id) => {
    try {
      getSemester(id);
      return true;
    } catch {
      return false;
    }
  });
}
