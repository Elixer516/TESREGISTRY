/**
 * Admission documents attached to a student record.
 *
 * The bytes are not here — they are in Google Drive. This service owns the
 * *metadata*: which slot a file fills, what it was renamed to, where it lives
 * in Drive, and who filed it. The page uploads to Drive first and only calls
 * `recordEnrollmentDocument` once Drive has confirmed, so a failed upload
 * cannot leave a record pointing at nothing.
 *
 * The requirement matrix in `@/lib/enrollment-documents` is enforced here as
 * well as in the UI. A slot the UI hides is a courtesy; this is the rule.
 */

import type { EnrollmentDocument, EnrollmentDocumentType } from '@/types';
import { APPLICANT_STANDING_LABELS } from '@/types';
import type {
  EnrollmentDocumentChecklist,
  EnrollmentDocumentSlotView,
  EnrollmentDocumentView,
} from '@/types/views';
import {
  ENROLLMENT_DOCUMENTS,
  requirementFor,
  specFor,
} from '@/lib/enrollment-documents';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getStudent, toStudentView, userDisplayName } from '../repositories/lookups';
import { requireRole, verifyOwnPassword } from '../auth';
import { recordAudit } from './audit';

function toView(document: EnrollmentDocument): EnrollmentDocumentView {
  return { ...document, uploadedByName: userDisplayName(document.uploadedByUserId) };
}

/**
 * The whole checklist, blocked and empty slots included — the registrar needs
 * to see what is still outstanding, not only what has been filed.
 */
export function getChecklist(studentId: string): EnrollmentDocumentChecklist {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const standing = student.applicantStanding;

  const slots: EnrollmentDocumentSlotView[] = ENROLLMENT_DOCUMENTS.map((spec) => {
    const document = db.enrollmentDocuments.find(
      (d) => d.studentId === studentId && d.documentType === spec.type,
    );
    return {
      type: spec.type,
      label: spec.label,
      note: spec.note ?? null,
      accept: [...spec.accept],
      requirement: requirementFor(spec.type, standing),
      document: document ? toView(document) : null,
    };
  });

  const required = slots.filter((slot) => slot.requirement === 'REQUIRED');

  return {
    student: toStudentView(student),
    standing,
    slots,
    requiredCount: required.length,
    submittedRequiredCount: required.filter((slot) => slot.document !== null).length,
    isComplete: required.length > 0 && required.every((slot) => slot.document !== null),
  };
}

export interface RecordDocumentInput {
  studentId: string;
  documentType: EnrollmentDocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveFileId: string;
  driveWebViewLink: string;
}

export function recordEnrollmentDocument(
  input: RecordDocumentInput,
): EnrollmentDocumentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(input.studentId);
  const spec = specFor(input.documentType);

  if (!student.applicantStanding) {
    throw badRequest(
      'This student has no educational standing on record, so it is not yet known which documents apply. Set it under Edit first.',
    );
  }

  // The rule, not the courtesy: refuse a document that cannot belong to this
  // applicant even if the UI somehow offered the slot.
  if (requirementFor(input.documentType, student.applicantStanding) === 'NOT_APPLICABLE') {
    throw badRequest(
      `${spec.label} does not apply to a ${APPLICANT_STANDING_LABELS[student.applicantStanding]}.`,
    );
  }

  if (!input.driveFileId.trim()) {
    throw badRequest('The upload did not return a Google Drive file id.');
  }

  const existing = db.enrollmentDocuments.find(
    (d) => d.studentId === input.studentId && d.documentType === input.documentType,
  );

  if (existing) {
    const before = { fileName: existing.fileName, version: existing.version };
    existing.fileName = input.fileName;
    existing.fileSize = input.fileSize;
    existing.mimeType = input.mimeType;
    existing.driveFileId = input.driveFileId;
    existing.driveWebViewLink = input.driveWebViewLink;
    existing.version += 1;
    existing.uploadedByUserId = actor.id;
    existing.uploadedAt = nowIso();

    recordAudit({
      action: 'ENROLLMENT_DOC_REPLACED',
      recordType: 'EnrollmentDocument',
      recordId: existing.id,
      actor,
      detail: `${spec.label} replaced for ${student.firstName} ${student.lastName} (now version ${existing.version}).`,
      before,
      after: { fileName: existing.fileName, version: existing.version },
    });
    return toView(existing);
  }

  const document: EnrollmentDocument = {
    id: nextId('edoc'),
    studentId: input.studentId,
    documentType: input.documentType,
    fileName: input.fileName,
    fileSize: input.fileSize,
    mimeType: input.mimeType,
    driveFileId: input.driveFileId,
    driveWebViewLink: input.driveWebViewLink,
    version: 1,
    uploadedByUserId: actor.id,
    uploadedAt: nowIso(),
  };
  db.enrollmentDocuments.push(document);

  recordAudit({
    action: 'ENROLLMENT_DOC_UPLOADED',
    recordType: 'EnrollmentDocument',
    recordId: document.id,
    actor,
    detail: `${spec.label} filed for ${student.firstName} ${student.lastName} as ${document.fileName}.`,
    after: { fileName: document.fileName, driveFileId: document.driveFileId },
  });
  return toView(document);
}

/**
 * Removes the pointer, not the file. The document stays in Drive, where it
 * can still be recovered — deleting someone's birth certificate on a stray
 * click is not a thing this should be able to do.
 */
export function removeEnrollmentDocument(id: string, password: string): void {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(password);

  const index = db.enrollmentDocuments.findIndex((d) => d.id === id);
  if (index === -1) throw notFound('That document could not be found.');

  const [removed] = db.enrollmentDocuments.splice(index, 1);
  const student = db.students.find((s) => s.id === removed.studentId);

  recordAudit({
    action: 'ENROLLMENT_DOC_REMOVED',
    recordType: 'EnrollmentDocument',
    recordId: removed.id,
    actor,
    detail: `${specFor(removed.documentType).label} unlinked from ${
      student ? `${student.firstName} ${student.lastName}` : 'a student'
    }. The file remains in Google Drive.`,
    before: { fileName: removed.fileName, driveFileId: removed.driveFileId },
  });
}

/**
 * Caches the Drive folder id after the upload path resolved it. Purely an
 * optimisation — the folder is always searched for by name first, so losing
 * this on reload costs one extra Drive query, not a duplicate folder.
 */
export function setStudentDriveFolder(studentId: string, folderId: string): void {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  if (student.driveFolderId === folderId) return;

  const isFirst = student.driveFolderId === null;
  student.driveFolderId = folderId;
  student.updatedAt = nowIso();

  if (isFirst) {
    recordAudit({
      action: 'DRIVE_FOLDER_CREATED',
      recordType: 'Student',
      recordId: student.id,
      actor,
      detail: `Google Drive folder linked for ${student.firstName} ${student.lastName}.`,
      after: { driveFolderId: folderId },
    });
  }
}
