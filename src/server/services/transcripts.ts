/**
 * Uploaded transcripts and hand-entered previous-school records.
 *
 * The PDF is *evidence*. It is stored, viewed and downloaded, but it is never
 * parsed — a credited subject only reaches a transcript if a registrar typed
 * it in as a PreviousSchoolRecord row.
 */

import type { PreviousSchoolRecord, TorDocument } from '@/types';
import type { TorDocumentView } from '@/types/views';
import { badRequest, notFound, validationFailed } from '@/lib/api-error';
import { cloneAll, db, nextId, nowIso } from '../repositories/db';
import { getStudent, userDisplayName } from '../repositories/lookups';
import { requireRole, verifyOwnPassword } from '../auth';
import { recordAudit } from './audit';

const PDF_MAGIC = '%PDF-';

/**
 * Confirm the payload really is a PDF by reading its leading bytes. A file
 * renamed to `.pdf` does not get through this.
 */
function assertPdfMagicBytes(dataUrl: string): void {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw validationFailed('The uploaded file could not be read.');
  }
  const header = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  let leading: string;
  try {
    leading = header.includes('base64')
      ? atob(payload.slice(0, 16)).slice(0, 8)
      : decodeURIComponent(payload).slice(0, 8);
  } catch {
    throw validationFailed('The uploaded file could not be decoded.');
  }

  if (!leading.startsWith(PDF_MAGIC)) {
    throw validationFailed(
      'That file is not a PDF. Its contents begin with something else, whatever the file name says.',
    );
  }
}

function toTorView(doc: TorDocument): TorDocumentView {
  return { ...doc, uploadedByName: userDisplayName(doc.uploadedByUserId) };
}

export function getTorDocument(studentId: string): TorDocumentView | null {
  requireRole('REGISTRAR');
  const found = db.torDocuments.find((t) => t.studentId === studentId);
  return found ? toTorView(found) : null;
}

export interface TorUploadInput {
  studentId: string;
  fileName: string;
  fileSize: number;
  dataUrl: string;
}

/** Re-uploading replaces the held file and bumps its version — no pile-up. */
export function uploadTor(input: TorUploadInput): TorDocumentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(input.studentId);

  if (!input.fileName.trim()) throw badRequest('The file has no name.');
  assertPdfMagicBytes(input.dataUrl);

  const existing = db.torDocuments.find((t) => t.studentId === input.studentId);

  if (existing) {
    const before = { fileName: existing.fileName, version: existing.version };
    existing.fileName = input.fileName;
    existing.fileSize = input.fileSize;
    existing.dataUrl = input.dataUrl;
    existing.version += 1;
    existing.uploadedByUserId = actor.id;
    existing.uploadedAt = nowIso();

    recordAudit({
      action: 'TOR_REPLACED',
      recordType: 'TorDocument',
      recordId: existing.id,
      actor,
      detail: `Transcript for ${student.firstName} ${student.lastName} replaced (now version ${existing.version}).`,
      before,
      after: { fileName: existing.fileName, version: existing.version },
    });
    return toTorView(existing);
  }

  const doc: TorDocument = {
    id: nextId('tor'),
    studentId: input.studentId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    dataUrl: input.dataUrl,
    version: 1,
    uploadedByUserId: actor.id,
    uploadedAt: nowIso(),
  };
  db.torDocuments.push(doc);

  recordAudit({
    action: 'TOR_UPLOADED',
    recordType: 'TorDocument',
    recordId: doc.id,
    actor,
    detail: `Transcript uploaded for ${student.firstName} ${student.lastName}.`,
    after: { fileName: doc.fileName, version: doc.version },
  });
  return toTorView(doc);
}

/** Removal is destructive and irreversible here, so the password is re-checked. */
export function removeTor(studentId: string, password: string): void {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(password);

  const index = db.torDocuments.findIndex((t) => t.studentId === studentId);
  if (index === -1) throw notFound('There is no transcript on file for this student.');

  const [removed] = db.torDocuments.splice(index, 1);
  const student = getStudent(studentId);

  recordAudit({
    action: 'TOR_REMOVED',
    recordType: 'TorDocument',
    recordId: removed.id,
    actor,
    detail: `Transcript removed for ${student.firstName} ${student.lastName} (was version ${removed.version}).`,
    before: { fileName: removed.fileName, version: removed.version },
  });
}

/* ---------------------------------------------------------------- */
/* Previous school records                                           */
/* ---------------------------------------------------------------- */

export function listPreviousRecords(studentId: string): PreviousSchoolRecord[] {
  requireRole('REGISTRAR');
  return cloneAll(
    db.previousSchoolRecords
      .filter((p) => p.studentId === studentId)
      .sort(
        (a, b) =>
          a.schoolYear.localeCompare(b.schoolYear) || a.courseCode.localeCompare(b.courseCode),
      ),
  );
}

export interface PreviousRecordInput {
  studentId: string;
  schoolName: string;
  schoolYear: string;
  courseCode: string;
  courseTitle: string;
  grade: string;
  units: number;
}

export function addPreviousRecord(input: PreviousRecordInput): PreviousSchoolRecord[] {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(input.studentId);

  if (!input.schoolName.trim()) throw badRequest('School name is required.');
  if (!input.courseCode.trim()) throw badRequest('Course code is required.');
  if (!input.courseTitle.trim()) throw badRequest('Course title is required.');
  if (!input.grade.trim()) throw badRequest('Grade is required.');
  if (!(input.units > 0)) throw badRequest('Units must be greater than zero.');

  const row: PreviousSchoolRecord = {
    id: nextId('psr'),
    studentId: input.studentId,
    schoolName: input.schoolName.trim(),
    schoolYear: input.schoolYear.trim(),
    courseCode: input.courseCode.trim().toUpperCase(),
    courseTitle: input.courseTitle.trim(),
    grade: input.grade.trim(),
    units: input.units,
    createdAt: nowIso(),
  };
  db.previousSchoolRecords.push(row);

  recordAudit({
    action: 'PREV_RECORD_ADDED',
    recordType: 'PreviousSchoolRecord',
    recordId: row.id,
    actor,
    detail: `${row.courseCode} from ${row.schoolName} credited to ${student.firstName} ${student.lastName}.`,
    after: { ...row },
  });
  return listPreviousRecords(input.studentId);
}

export function removePreviousRecord(id: string): PreviousSchoolRecord[] {
  const actor = requireRole('REGISTRAR');
  const index = db.previousSchoolRecords.findIndex((p) => p.id === id);
  if (index === -1) throw notFound('That credited subject could not be found.');

  const [removed] = db.previousSchoolRecords.splice(index, 1);
  recordAudit({
    action: 'PREV_RECORD_REMOVED',
    recordType: 'PreviousSchoolRecord',
    recordId: removed.id,
    actor,
    detail: `${removed.courseCode} from ${removed.schoolName} removed. It will no longer appear on the transcript.`,
    before: { ...removed },
  });
  return listPreviousRecords(removed.studentId);
}
