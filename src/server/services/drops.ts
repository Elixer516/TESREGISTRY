/**
 * Drop cases — the Registrar's handling of a trainee leaving their diploma.
 *
 * A drop is the one status change that ends a trainee's enrolment, so it is
 * not a dropdown. It is a case: opened (by the 79% standing line or by hand),
 * looked into, and then either confirmed with a reason and proof, or closed
 * without a drop. A confirmed drop can later be reinstated, and the case
 * keeps every step, so the record never forgets that it happened.
 *
 * Nothing here acts on its own. The standing line only proposes; the
 * Registrar opens the case and makes the decision. Proof is required to
 * confirm a drop — the paper backs the action, and it lives with the case.
 *
 * Only dropping from the diploma is handled here. A single subject marked
 * DRP is a grade, entered on the grading sheet.
 */

import type {
  AttachmentInput,
  DepartureReason,
  DropCase,
  DropCaseEvent,
  DropCaseStatus,
  User,
} from '@/types';
import {
  ALL_DEPARTURE_REASONS,
  DEPARTURE_REASON_LABELS,
  isInstitutionInitiated,
  semesterPeriodLabel,
} from '@/types';
import type { DropCandidateView, DropCaseView, DropStandingSubject } from '@/types/views';
import { badRequest, notFound, validationFailed } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getStudent, subjectLabel, toStudentView, userDisplayName } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { acceptAttachments, mergeAttachments, toAttachmentView } from './attachments';
import { effectiveGrade } from './grade-rules';
import { standingTier } from './academic-standing';
import { changeStudentStatus } from './students';

/* ---------------------------------------------------------------- */
/* Reading                                                           */
/* ---------------------------------------------------------------- */

/** The trainee's subjects at or below the 79% line, worst tier first. */
function standingOf(studentId: string): DropCaseView['standing'] {
  const enrollmentIds = new Set(
    db.enrollments.filter((e) => e.studentId === studentId && e.status !== 'DROPPED').map((e) => e.id),
  );
  const subjects: Array<DropStandingSubject & { tier: 'DROP' | 'REVIEW' }> = [];
  for (const row of db.enrollmentSubjects) {
    if (!enrollmentIds.has(row.enrollmentId)) continue;
    const tier = standingTier(row);
    if (!tier) continue;
    const enrollment = db.enrollments.find((e) => e.id === row.enrollmentId);
    const semester = enrollment ? db.semesters.find((s) => s.id === enrollment.semesterId) : undefined;
    const subject = db.subjects.find((s) => s.id === row.subjectId);
    subjects.push({
      tier,
      subjectCode: subjectLabel(subject),
      subjectTitle: subject?.title ?? 'Unknown subject',
      percentage: row.finalGrade === 'INC' ? row.completionPercentage : row.finalPercentage,
      grade: effectiveGrade(row.finalGrade, row.completionGrade) ?? '',
      termLabel: semester ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod) : '—',
    });
  }
  if (subjects.length === 0) return null;
  const recommendation = subjects.some((s) => s.tier === 'DROP') ? 'DROP' : 'REVIEW';
  return {
    recommendation,
    subjects: subjects
      .sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101))
      .map(({ tier: _tier, ...rest }) => rest),
  };
}

function toView(dropCase: DropCase): DropCaseView {
  const { attachments, history, ...rest } = dropCase;
  return {
    ...rest,
    student: toStudentView(getStudent(dropCase.studentId)),
    attachments: attachments.map(toAttachmentView),
    history: history.map((event) => ({ ...event, byName: userDisplayName(event.byUserId) })),
    reasonLabel: dropCase.reason ? DEPARTURE_REASON_LABELS[dropCase.reason] : null,
    institutionInitiated: dropCase.reason ? isInstitutionInitiated(dropCase.reason) : null,
    standing: standingOf(dropCase.studentId),
  };
}

export interface DropCaseFilters {
  status?: DropCaseStatus | 'ALL';
  search?: string;
  programId?: string;
}

export function listDropCases(filters: DropCaseFilters = {}): DropCaseView[] {
  requireRole('REGISTRAR');
  const needle = (filters.search ?? '').trim().toLowerCase();
  return db.dropCases
    .filter((c) => !filters.status || filters.status === 'ALL' || c.status === filters.status)
    .map(toView)
    .filter((c) => !filters.programId || c.student.programId === filters.programId)
    .filter(
      (c) =>
        !needle ||
        c.caseNumber.toLowerCase().includes(needle) ||
        c.student.fullName.toLowerCase().includes(needle) ||
        c.student.studentNumber.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDropCase(id: string): DropCaseView {
  requireRole('REGISTRAR');
  return toView(findCase(id));
}

/**
 * Trainees the 79% standing line flags who have no case open or decided.
 * These are proposals only — a case exists once the Registrar opens one.
 */
export function listDropCandidates(): DropCandidateView[] {
  requireRole('REGISTRAR');
  const withCase = new Set(
    db.dropCases.filter((c) => c.status === 'FOR_REVIEW' || c.status === 'DROPPED').map((c) => c.studentId),
  );
  const out: DropCandidateView[] = [];
  for (const student of db.students) {
    if (['PENDING', 'REJECTED', 'DROPPED', 'GRADUATED'].includes(student.status)) continue;
    if (student.archivedAt || withCase.has(student.id)) continue;
    const standing = standingOf(student.id);
    if (!standing) continue;
    out.push({
      student: toStudentView(student),
      recommendation: standing.recommendation,
      lowestPercentage: standing.subjects[0]?.percentage ?? null,
      subjects: standing.subjects,
    });
  }
  return out.sort(
    (a, b) =>
      (a.recommendation === 'DROP' ? 0 : 1) - (b.recommendation === 'DROP' ? 0 : 1) ||
      (a.lowestPercentage ?? 101) - (b.lowestPercentage ?? 101),
  );
}

/* ---------------------------------------------------------------- */
/* Acting                                                            */
/* ---------------------------------------------------------------- */

function findCase(id: string): DropCase {
  const found = db.dropCases.find((c) => c.id === id);
  if (!found) throw notFound('That drop case could not be found.');
  return found;
}

function nextCaseNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `DC-${year}-`;
  const used = db.dropCases
    .filter((c) => c.caseNumber.startsWith(prefix))
    .map((c) => Number(c.caseNumber.slice(prefix.length)))
    .filter(Number.isFinite);
  return `${prefix}${String((used.length ? Math.max(...used) : 0) + 1).padStart(4, '0')}`;
}

function log(dropCase: DropCase, actor: User, action: DropCaseEvent['action'], note: string) {
  const at = nowIso();
  dropCase.history.push({ at, byUserId: actor.id, action, note });
  dropCase.updatedAt = at;
}

function checkReason(reason: DepartureReason | null | undefined, note: string): DepartureReason {
  if (!reason) throw validationFailed('Choose the reason for the drop.');
  if (!ALL_DEPARTURE_REASONS.includes(reason)) throw validationFailed(`${reason} is not a recognised reason.`);
  if (reason === 'OTHER' && !note.trim()) {
    throw validationFailed('Choosing "Other" needs a note saying what happened.');
  }
  return reason;
}

export interface OpenDropCaseInput {
  studentId: string;
  origin?: 'STANDING' | 'MANUAL';
  reason?: DepartureReason | null;
  note?: string;
}

/** Opens a case for a trainee, or returns the one already open. */
export function openDropCase(input: OpenDropCaseInput): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(input.studentId);

  const open = db.dropCases.find((c) => c.studentId === student.id && c.status === 'FOR_REVIEW');
  if (open) return toView(open);
  if (student.status === 'DROPPED') {
    throw badRequest(`${student.firstName} ${student.lastName} is already dropped.`);
  }
  if (['PENDING', 'REJECTED'].includes(student.status)) {
    throw badRequest('An application that has not been approved cannot be dropped — reject it instead.');
  }
  if (student.status === 'GRADUATED') {
    throw badRequest(`${student.firstName} ${student.lastName} has graduated.`);
  }

  const now = nowIso();
  const dropCase: DropCase = {
    id: nextId('drop'),
    caseNumber: nextCaseNumber(),
    studentId: student.id,
    status: 'FOR_REVIEW',
    origin: input.origin ?? 'MANUAL',
    reason: input.reason ?? null,
    note: (input.note ?? '').trim(),
    effectiveDate: null,
    attachments: [],
    history: [],
    previousStudentStatus: null,
    openedAt: now,
    openedByUserId: actor.id,
    droppedAt: null,
    updatedAt: now,
  };
  log(
    dropCase,
    actor,
    'OPENED',
    dropCase.origin === 'STANDING' ? 'Opened from the academic standing review.' : 'Opened by the Registrar.',
  );
  db.dropCases.push(dropCase);

  recordAudit({
    action: 'DROP_CASE_OPENED',
    recordType: 'DropCase',
    recordId: dropCase.id,
    actor,
    detail: `${dropCase.caseNumber} opened for ${student.firstName} ${student.lastName} (${student.studentNumber}).`,
  });
  return toView(dropCase);
}

export interface DropCaseDetailsInput {
  reason?: DepartureReason | null;
  note?: string;
  effectiveDate?: string | null;
  /** The whole list; attachments already on the case are recognised by id. */
  attachments?: Array<AttachmentInput & { id?: string }>;
}

function applyDetails(dropCase: DropCase, input: DropCaseDetailsInput, actor: User) {
  if (input.reason !== undefined) dropCase.reason = input.reason;
  if (input.note !== undefined) {
    if (input.note.length > 1000) throw validationFailed('The note is limited to 1000 characters.');
    dropCase.note = input.note.trim();
  }
  if (input.effectiveDate !== undefined) {
    if (input.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
      throw validationFailed('The effective date is not a valid date.');
    }
    dropCase.effectiveDate = input.effectiveDate || null;
  }
  if (input.attachments !== undefined) {
    dropCase.attachments = mergeAttachments(dropCase.attachments, input.attachments, actor);
  }
}

/** Saves what has been gathered so far, without deciding anything. */
export function updateDropCase(id: string, input: DropCaseDetailsInput): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const dropCase = findCase(id);
  if (dropCase.status !== 'FOR_REVIEW') {
    throw badRequest('Only a case still under review can be edited.');
  }
  applyDetails(dropCase, input, actor);
  log(dropCase, actor, 'UPDATED', 'Details saved.');
  recordAudit({
    action: 'DROP_CASE_UPDATED',
    recordType: 'DropCase',
    recordId: dropCase.id,
    actor,
    detail: `${dropCase.caseNumber} updated (${dropCase.attachments.length} attachment(s)).`,
  });
  return toView(dropCase);
}

/**
 * Confirms the drop. Needs a reason and at least one piece of proof; the
 * trainee becomes Dropped and can no longer be enrolled.
 */
export function confirmDrop(id: string, input: DropCaseDetailsInput): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const dropCase = findCase(id);
  if (dropCase.status !== 'FOR_REVIEW') {
    throw badRequest('Only a case under review can be confirmed as a drop.');
  }
  const student = getStudent(dropCase.studentId);
  if (student.status === 'DROPPED') throw badRequest('This trainee is already dropped.');

  applyDetails(dropCase, input, actor);
  const reason = checkReason(dropCase.reason, dropCase.note);
  if (dropCase.attachments.length === 0) {
    throw validationFailed(
      'Attach proof before confirming the drop — a drop slip, a letter, a record of absences, or a link to one.',
    );
  }

  dropCase.previousStudentStatus = student.status;
  changeStudentStatus(student, 'DROPPED', { reason, note: dropCase.note }, actor);
  if (dropCase.effectiveDate) {
    // The drop slip's own date is the one that counts in the reports.
    student.departedAt = `${dropCase.effectiveDate}T08:00:00.000Z`;
  }
  dropCase.status = 'DROPPED';
  dropCase.droppedAt = nowIso();
  log(dropCase, actor, 'DROPPED', `Dropped. Reason: ${DEPARTURE_REASON_LABELS[reason]}.`);

  recordAudit({
    action: 'TRAINEE_DROPPED',
    recordType: 'DropCase',
    recordId: dropCase.id,
    actor,
    detail: `${dropCase.caseNumber}: ${student.firstName} ${student.lastName} dropped from their diploma. Reason: ${DEPARTURE_REASON_LABELS[reason]}. ${dropCase.attachments.length} attachment(s).`,
  });
  return toView(dropCase);
}

/** Ends a case without a drop — looked into, and the trainee stays. */
export function closeDropCase(id: string, note: string): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const dropCase = findCase(id);
  if (dropCase.status !== 'FOR_REVIEW') throw badRequest('Only a case under review can be closed.');
  if (!note.trim()) throw validationFailed('Say why the trainee is not being dropped.');
  dropCase.status = 'CLOSED';
  log(dropCase, actor, 'CLOSED', note.trim());
  recordAudit({
    action: 'DROP_CASE_CLOSED',
    recordType: 'DropCase',
    recordId: dropCase.id,
    actor,
    detail: `${dropCase.caseNumber} closed without a drop. ${note.trim()}`,
  });
  return toView(dropCase);
}

/**
 * Undoes a drop. The trainee returns to the status they had before it, and
 * the case keeps both the drop and the reinstatement.
 */
export function reinstateTrainee(id: string, reason: string): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const dropCase = findCase(id);
  if (dropCase.status !== 'DROPPED') throw badRequest('Only a confirmed drop can be reinstated.');
  if (!reason.trim()) throw validationFailed('Say why the trainee is being reinstated.');
  const student = getStudent(dropCase.studentId);

  const back =
    dropCase.previousStudentStatus && dropCase.previousStudentStatus !== 'DROPPED'
      ? dropCase.previousStudentStatus
      : 'ACTIVE';
  changeStudentStatus(student, back, undefined, actor);
  dropCase.status = 'REINSTATED';
  log(dropCase, actor, 'REINSTATED', reason.trim());

  recordAudit({
    action: 'TRAINEE_REINSTATED',
    recordType: 'DropCase',
    recordId: dropCase.id,
    actor,
    detail: `${dropCase.caseNumber}: ${student.firstName} ${student.lastName} reinstated. ${reason.trim()}`,
  });
  return toView(dropCase);
}

/** Proof added to a case after the fact — a late document, say. */
export function addDropCaseAttachments(
  id: string,
  attachments: AttachmentInput[],
): DropCaseView {
  const actor = requireRole('REGISTRAR');
  const dropCase = findCase(id);
  if (attachments.length === 0) throw validationFailed('Nothing to attach.');
  dropCase.attachments.push(...acceptAttachments(attachments, actor));
  log(dropCase, actor, 'UPDATED', `${attachments.length} attachment(s) added.`);
  return toView(dropCase);
}
