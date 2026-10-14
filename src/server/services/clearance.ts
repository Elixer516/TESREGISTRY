/**
 * Graduation clearance.
 *
 * The last step of a trainee's time at the centre: before the Registrar
 * marks them graduated, every admission requirement they were asked for at
 * enrolment (PSA birth certificate, 2×2 picture, Form 138 and so on) must be
 * on file. A requirement counts as complete when its scan was uploaded, or
 * when the Registrar records receiving it on paper — the date it was
 * submitted, and any remarks.
 *
 * There is no clearance for a trainee who is not finishing: this is asked
 * only at graduation.
 */

import type { EnrollmentDocumentType, Student } from '@/types';
import type { ClearanceItem, GraduationClearance } from '@/types/views';
import { ENROLLMENT_DOCUMENTS } from '@/lib/enrollment-documents';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getStudent, userDisplayName } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';

/** No role check — graduation, requests and the TOR compose it. */
export function clearanceFor(student: Student): GraduationClearance {
  // A record that predates the public form has no standing on file; it is
  // read as a Senior High graduate's checklist, the conservative case.
  const standing = student.applicantStanding ?? 'SHS_GRADUATE';
  const items: ClearanceItem[] = ENROLLMENT_DOCUMENTS.filter(
    (spec) => spec.requirement[standing] === 'REQUIRED',
  ).map((spec) => {
    const upload = db.enrollmentDocuments.find(
      (d) => d.studentId === student.id && d.documentType === spec.type,
    );
    const receipt = (db.requirementReceipts ?? []).find(
      (r) => r.studentId === student.id && r.documentType === spec.type,
    );
    return {
      type: spec.type,
      label: spec.label,
      status: receipt ? 'RECEIVED' : upload ? 'UPLOADED' : 'MISSING',
      submittedOn: receipt?.submittedOn ?? (upload ? upload.uploadedAt.slice(0, 10) : null),
      remarks: receipt?.remarks ?? '',
      receiptId: receipt?.id ?? null,
      recordedByName: receipt ? userDisplayName(receipt.recordedByUserId) : null,
    };
  });
  const missing = items.filter((i) => i.status === 'MISSING').map((i) => i.label);
  return {
    complete: missing.length === 0,
    items,
    missing,
    standingAssumed: student.applicantStanding === null,
  };
}

export function getClearance(studentId: string): GraduationClearance {
  requireRole('REGISTRAR');
  return clearanceFor(getStudent(studentId));
}

/** Records a requirement received on paper: the date submitted and remarks. */
export function recordRequirementReceived(
  studentId: string,
  documentType: EnrollmentDocumentType,
  submittedOn: string,
  remarks = '',
): GraduationClearance {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const spec = ENROLLMENT_DOCUMENTS.find((d) => d.type === documentType);
  if (!spec) throw badRequest('That is not one of the admission requirements.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(submittedOn ?? '')) throw badRequest('Give the date it was submitted.');
  if (remarks.length > 300) throw badRequest('Keep remarks to 300 characters.');

  const existing = db.requirementReceipts.find(
    (r) => r.studentId === studentId && r.documentType === documentType,
  );
  if (existing) {
    existing.submittedOn = submittedOn;
    existing.remarks = remarks.trim();
    existing.recordedByUserId = actor.id;
    existing.recordedAt = nowIso();
  } else {
    db.requirementReceipts.push({
      id: nextId('rr'),
      studentId,
      documentType,
      submittedOn,
      remarks: remarks.trim(),
      recordedByUserId: actor.id,
      recordedAt: nowIso(),
    });
  }
  recordAudit({
    action: 'REQUIREMENT_RECEIVED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${spec.label} received from ${student.firstName} ${student.lastName} (submitted ${submittedOn}).${
      remarks.trim() ? ` ${remarks.trim()}` : ''
    }`,
  });
  return clearanceFor(student);
}

export function removeRequirementReceipt(receiptId: string): GraduationClearance {
  const actor = requireRole('REGISTRAR');
  const receipt = db.requirementReceipts.find((r) => r.id === receiptId);
  if (!receipt) throw notFound('That record could not be found.');
  const student = getStudent(receipt.studentId);
  if (student.status === 'GRADUATED') {
    throw badRequest('This trainee has graduated; their clearance is closed.');
  }
  db.requirementReceipts.splice(db.requirementReceipts.indexOf(receipt), 1);
  recordAudit({
    action: 'REQUIREMENT_RECEIPT_REMOVED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Receipt of ${ENROLLMENT_DOCUMENTS.find((d) => d.type === receipt.documentType)?.label ?? receipt.documentType} removed.`,
    before: { ...receipt },
  });
  return clearanceFor(student);
}
