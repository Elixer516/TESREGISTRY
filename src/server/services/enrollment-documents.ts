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
  buildDocumentFileName,
  buildStudentFolderName,
  requirementFor,
  specFor,
} from '@/lib/enrollment-documents';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getStudent, toStudentView, userDisplayName } from '../repositories/lookups';
import { requireRole, verifyOwnPassword } from '../auth';
import { recordAudit } from './audit';

function toView(document: EnrollmentDocument): EnrollmentDocumentView {
  return {
    ...document,
    // An empty actor means the applicant filed it themselves through the
    // public form, where there is no staff user to name.
    uploadedByName: document.uploadedByUserId
      ? userDisplayName(document.uploadedByUserId)
      : 'Online applicant',
  };
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
 * Removes the record and reports which Drive file went with it.
 *
 * The password is verified here, and the record is dropped here, but the
 * Drive file is trashed by the caller afterwards — this layer is synchronous
 * and cannot do network I/O. The order matters: authorisation is checked
 * before anything is destroyed, so a wrong password can never reach Drive.
 * If the trash call then fails, the caller says so; a file left behind is
 * recoverable, an unauthorised deletion is not.
 */
export function removeEnrollmentDocument(
  id: string,
  password: string,
): { driveFileId: string; label: string } {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(password);

  const index = db.enrollmentDocuments.findIndex((d) => d.id === id);
  if (index === -1) throw notFound('That document could not be found.');

  const [removed] = db.enrollmentDocuments.splice(index, 1);
  const student = db.students.find((s) => s.id === removed.studentId);
  const label = specFor(removed.documentType).label;

  recordAudit({
    action: 'ENROLLMENT_DOC_REMOVED',
    recordType: 'EnrollmentDocument',
    recordId: removed.id,
    actor,
    detail: `${label} removed from ${
      student ? `${student.firstName} ${student.lastName}` : 'a student'
    }, and the file moved to the Google Drive trash.`,
    before: { fileName: removed.fileName, driveFileId: removed.driveFileId },
  });

  return { driveFileId: removed.driveFileId, label };
}

export interface PendingRename {
  driveFileId: string;
  fileName: string;
}

export interface RenamePlan {
  folderId: string | null;
  folderName: string;
  files: PendingRename[];
}

/**
 * Recomputes this student's Drive names after their record was edited, stores
 * the new file names, and reports what the caller must rename in Drive.
 *
 * The names are derived from the record, so correcting a misspelled surname
 * has to reach Drive too — otherwise the folder and its files keep spelling
 * the applicant's name the old way forever. The store is updated here; the
 * Drive calls are the caller's, since this layer cannot do network I/O.
 */
export function planDocumentRename(studentId: string): RenamePlan {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);

  const files: PendingRename[] = [];
  for (const document of db.enrollmentDocuments) {
    if (document.studentId !== studentId) continue;
    const extension = document.fileName.slice(document.fileName.lastIndexOf('.'));
    const fileName = buildDocumentFileName(student, document.documentType, extension);
    if (fileName === document.fileName) continue;
    document.fileName = fileName;
    files.push({ driveFileId: document.driveFileId, fileName });
  }

  if (files.length > 0) student.updatedAt = nowIso();

  return {
    folderId: student.driveFolderId,
    folderName: buildStudentFolderName(student),
    files,
  };
}

/**
 * Forgets a rejected applicant's Drive folder after the caller has trashed it.
 * Their document records go too — the files they point at no longer exist.
 */
export function clearStudentDriveFolder(studentId: string): void {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const folderId = student.driveFolderId;

  for (let i = db.enrollmentDocuments.length - 1; i >= 0; i -= 1) {
    if (db.enrollmentDocuments[i].studentId === studentId) {
      db.enrollmentDocuments.splice(i, 1);
    }
  }

  student.driveFolderId = null;
  student.updatedAt = nowIso();

  recordAudit({
    action: 'DRIVE_FOLDER_DELETED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Google Drive folder for ${student.firstName} ${student.lastName} moved to trash after rejection.`,
    before: { driveFolderId: folderId },
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
