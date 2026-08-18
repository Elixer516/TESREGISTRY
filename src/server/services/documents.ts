/**
 * Document requests, the generation gate, and GSA.
 *
 * Six document types share one pipeline: PENDING → PROCESSING → READY →
 * RELEASED, with CANCELLED available from any open state.
 *
 * Generation always runs the validation gate first. If the data needed to
 * produce a truthful document is missing, generation is refused with a list of
 * what is missing — a blank or half-filled certificate is worse than none.
 */

import type {
  DocumentRequest,
  DocumentSnapshot,
  DocumentSnapshotRow,
  DocumentSnapshotTermGroup,
  DocumentType,
  GeneratedDocument,
  RequestStatus,
} from '@/types';
import {
  ANY_STANDING_STATUSES,
  DOCUMENT_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
} from '@/types';
import type { DocumentRequestView, StudentView } from '@/types/views';
import { ApiError, badRequest, notFound } from '@/lib/api-error';
import { fullName } from '@/lib/format';
import { formatDate } from '@/lib/format';
import { cloneAll, db, nextId, nowIso, clone } from '../repositories/db';
import { getStudent, toStudentView, userDisplayName } from '../repositories/lookups';
import { currentUser, requireRole, requireSession } from '../auth';
import { computeGwa, gradeRemarks } from './grade-rules';
import { buildAcademicRecord } from './records';
import { recordAudit } from './audit';
import { notify } from './notifications';

/* ---------------------------------------------------------------- */
/* Requests                                                          */
/* ---------------------------------------------------------------- */

function toRequestView(request: DocumentRequest): DocumentRequestView {
  const student = db.students.find((s) => s.id === request.studentId);
  const program = student ? db.programs.find((p) => p.id === student.programId) : undefined;
  return {
    ...request,
    studentName: student ? fullName(student) : 'Unknown student',
    studentNumber: student?.studentNumber ?? '—',
    programCode: program?.code ?? '—',
    documentTypeLabel: DOCUMENT_TYPE_LABELS[request.documentType],
    statusLabel: REQUEST_STATUS_LABELS[request.status],
    requestedByName: userDisplayName(request.requestedByUserId),
    hasGeneratedDocument: db.generatedDocuments.some(
      (g) => g.documentRequestId === request.id,
    ),
  };
}

export interface RequestFilters {
  status?: RequestStatus | 'ALL';
  documentType?: DocumentType | 'ALL';
  query?: string;
}

export function listRequests(filters: RequestFilters = {}): DocumentRequestView[] {
  const user = requireSession();

  let rows = [...db.documentRequests];

  // A trainee only ever sees their own requests.
  if (user.role === 'TRAINEE') {
    rows = rows.filter((r) => r.studentId === user.studentId);
  } else if (user.role !== 'REGISTRAR') {
    rows = [];
  }

  if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((r) => r.status === filters.status);
  }
  if (filters.documentType && filters.documentType !== 'ALL') {
    rows = rows.filter((r) => r.documentType === filters.documentType);
  }

  let views = rows.map(toRequestView);
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    views = views.filter((v) =>
      `${v.studentName} ${v.studentNumber} ${v.documentTypeLabel} ${v.purpose}`
        .toLowerCase()
        .includes(needle),
    );
  }

  return views.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** Students the Registrar may raise a document for — anyone with standing. */
export function documentEligibleStudents(query = ''): StudentView[] {
  requireRole('REGISTRAR');
  const allowed = new Set(ANY_STANDING_STATUSES);
  const needle = query.trim().toLowerCase();
  return db.students
    .filter((s) => allowed.has(s.status))
    .filter((s) =>
      !needle ||
      `${s.firstName} ${s.lastName} ${s.studentNumber}`.toLowerCase().includes(needle),
    )
    .map(toStudentView)
    .sort((a, b) => a.lastFirstName.localeCompare(b.lastFirstName));
}

export function createRequest(
  studentId: string,
  documentType: DocumentType,
  purpose: string,
): DocumentRequestView {
  const user = requireSession();
  if (user.role !== 'REGISTRAR' && user.role !== 'TRAINEE') {
    throw new ApiError(403, 'FORBIDDEN', 'Only the Registrar or a trainee may raise a document request.');
  }
  if (user.role === 'TRAINEE' && user.studentId !== studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only request documents for yourself.');
  }

  const student = getStudent(studentId);
  if (!ANY_STANDING_STATUSES.includes(student.status)) {
    throw badRequest(
      `Documents can only be issued to students with standing at the centre. This record is ${student.status}.`,
    );
  }
  if (!purpose.trim()) throw badRequest('State the purpose of the request.');

  const request: DocumentRequest = {
    id: nextId('dr'),
    studentId,
    documentType,
    purpose: purpose.trim(),
    status: 'PENDING',
    requestedByUserId: user.id,
    requestedAt: nowIso(),
    updatedAt: nowIso(),
    releasedAt: null,
    remarks: '',
  };
  db.documentRequests.push(request);

  recordAudit({
    action: 'DOCUMENT_REQUESTED',
    recordType: 'DocumentRequest',
    recordId: request.id,
    actor: user,
    detail: `${DOCUMENT_TYPE_LABELS[documentType]} requested for ${fullName(student)}.`,
    after: { ...request },
  });

  for (const registrar of db.users.filter(
    (u) => u.role === 'REGISTRAR' && u.status === 'APPROVED',
  )) {
    notify({
      userId: registrar.id,
      title: 'New document request',
      body: `${fullName(student)} — ${DOCUMENT_TYPE_LABELS[documentType]}.`,
      category: 'DOCUMENT',
      link: '/documents',
    });
  }

  return toRequestView(request);
}

const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['RELEASED', 'CANCELLED'],
  RELEASED: [],
  CANCELLED: [],
};

export function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  remarks = '',
): DocumentRequestView {
  const actor = requireRole('REGISTRAR');
  const request = db.documentRequests.find((r) => r.id === requestId);
  if (!request) throw notFound('That document request could not be found.');

  const allowed = ALLOWED_TRANSITIONS[request.status];
  if (!allowed.includes(status)) {
    throw badRequest(
      `A ${REQUEST_STATUS_LABELS[request.status]} request cannot move to ${
        REQUEST_STATUS_LABELS[status]
      }.`,
    );
  }

  const before = { ...request };
  request.status = status;
  request.updatedAt = nowIso();
  if (remarks.trim()) request.remarks = remarks.trim();
  if (status === 'RELEASED') request.releasedAt = nowIso();

  recordAudit({
    action: 'DOCUMENT_STATUS_CHANGED',
    recordType: 'DocumentRequest',
    recordId: request.id,
    actor,
    detail: `${DOCUMENT_TYPE_LABELS[request.documentType]} moved from ${
      REQUEST_STATUS_LABELS[before.status]
    } to ${REQUEST_STATUS_LABELS[status]}.`,
    before,
    after: { ...request },
  });

  const requester = db.users.find((u) => u.id === request.requestedByUserId);
  if (requester) {
    notify({
      userId: requester.id,
      title: 'Document request updated',
      body: `${DOCUMENT_TYPE_LABELS[request.documentType]} is now ${
        REQUEST_STATUS_LABELS[status]
      }.`,
      category: 'DOCUMENT',
      link: requester.role === 'TRAINEE' ? '/portal/requests' : '/documents',
    });
  }

  return toRequestView(request);
}

/* ---------------------------------------------------------------- */
/* The validation gate                                               */
/* ---------------------------------------------------------------- */

export interface GateResult {
  ok: boolean;
  issues: string[];
}

/**
 * Decide whether a truthful document can be produced. Called both by the UI
 * (to grey out the button and explain why) and by `generateDocument` (which
 * refuses regardless of what the UI did).
 */
export function checkGenerationGate(
  studentId: string,
  documentType: DocumentType,
): GateResult {
  const student = getStudent(studentId);
  const issues: string[] = [];

  if (!ANY_STANDING_STATUSES.includes(student.status)) {
    issues.push(
      `The student's status is ${student.status}. Documents are only issued to students with standing at the centre.`,
    );
  }
  if (!student.programId || !db.programs.some((p) => p.id === student.programId)) {
    issues.push('No program is attached to this student record.');
  }
  if (!student.curriculumId) {
    issues.push('No curriculum has been assigned. Approve the application to assign one.');
  }

  const record = buildAcademicRecord(studentId);
  const gradedRows = record.groups.flatMap((g) => g.rows).filter((r) => r.finalGrade !== null);

  switch (documentType) {
    case 'TOR':
      if (gradedRows.length === 0) {
        issues.push('There are no graded subjects to transcribe.');
      }
      break;
    case 'GSA':
      if (gradedRows.length === 0) {
        issues.push('There are no graded subjects, so no average can be computed.');
      }
      if (record.hasUnresolvedInc) {
        issues.push(
          'An unresolved INC is on file. Complete or correct it before issuing a General Scholastic Average.',
        );
      }
      break;
    case 'DIPLOMA':
      if (student.status !== 'GRADUATED') {
        issues.push('A diploma can only be issued to a student marked GRADUATED.');
      }
      break;
    case 'CERT_ENROLLMENT': {
      const activeSemester = db.semesters.find((s) => s.isActive);
      const enrolled =
        activeSemester &&
        db.enrollments.some(
          (e) =>
            e.studentId === studentId &&
            e.semesterId === activeSemester.id &&
            e.status !== 'DROPPED',
        );
      if (!enrolled) {
        issues.push('This student has no active enrollment for the current term.');
      }
      break;
    }
    case 'SPECIAL_ORDER':
      if (gradedRows.length === 0) {
        issues.push('A Special Order needs at least one completed term on record.');
      }
      break;
    case 'GOOD_MORAL':
      if (!student.approvedAt) {
        issues.push('This application has not been approved yet.');
      }
      break;
    default:
      break;
  }

  if (!student.birthDate) {
    issues.push('Date of birth is missing from the student record.');
  }
  if (!student.address.trim()) {
    issues.push('Address is missing from the student record.');
  }

  return { ok: issues.length === 0, issues };
}

/* ---------------------------------------------------------------- */
/* Generation                                                        */
/* ---------------------------------------------------------------- */

function buildSnapshot(studentId: string, documentType: DocumentType): DocumentSnapshot {
  const student = getStudent(studentId);
  const view = toStudentView(student);
  const record = buildAcademicRecord(studentId);
  const program = db.programs.find((p) => p.id === student.programId);
  const notes: string[] = [];

  const groups: DocumentSnapshotTermGroup[] = record.groups
    .slice()
    .reverse()
    .map((group) => {
      const rows: DocumentSnapshotRow[] = group.rows.map((row) => ({
        courseCode: row.subjectCode,
        courseTitle: row.subjectTitle,
        units: row.units,
        grade: row.finalGrade ?? '—',
        remarks: gradeRemarks(row.finalGrade, row.completionGrade),
        source: 'REGISTRAR',
      }));
      return {
        academicYearLabel: group.academicYearLabel,
        periodLabel: group.termLabel,
        rows,
        termUnits: group.totalUnits,
        termGwa: group.gwa,
      };
    });

  // Credited previous-school work is transcribed from the hand-entered rows.
  // The uploaded PDF is evidence only — it is never parsed.
  const previous = db.previousSchoolRecords.filter((p) => p.studentId === studentId);
  if (documentType === 'TOR' && previous.length > 0) {
    const bySchoolYear = new Map<string, typeof previous>();
    for (const row of previous) {
      const key = `${row.schoolName} · ${row.schoolYear}`;
      const list = bySchoolYear.get(key) ?? [];
      list.push(row);
      bySchoolYear.set(key, list);
    }
    for (const [key, rows] of bySchoolYear) {
      const gwa = computeGwa(
        rows.map((r) => ({ units: r.units, finalGrade: r.grade, completionGrade: null })),
      );
      groups.unshift({
        academicYearLabel: key,
        periodLabel: 'Credited',
        rows: rows.map((r) => ({
          courseCode: r.courseCode,
          courseTitle: r.courseTitle,
          units: r.units,
          grade: r.grade,
          remarks: 'Credited',
          source: 'PREVIOUS_SCHOOL',
        })),
        termUnits: gwa.totalUnits,
        termGwa: gwa.gwa,
      });
    }
    notes.push(
      'Credited subjects were transcribed from documents submitted by the student and verified by the Registrar.',
    );
  }

  if (record.hasUnresolvedInc) {
    notes.push(
      'This record contains an unresolved INC. The general average is reported as 0.000 until it is resolved.',
    );
  }

  const totalUnits = groups.reduce((sum, g) => sum + g.termUnits, 0);

  return {
    studentNumber: student.studentNumber,
    studentName: view.fullName,
    programCode: program?.code ?? '—',
    programName: program?.name ?? '—',
    curriculumName: view.curriculumName ?? '—',
    sex: student.sex,
    birthDate: formatDate(student.birthDate),
    address: student.address,
    status: student.status,
    groups,
    totalUnits,
    overallGwa: record.overallGwa,
    hasUnresolvedInc: record.hasUnresolvedInc,
    generatedOn: nowIso(),
    notes,
  };
}

export function generateDocument(
  studentId: string,
  documentType: DocumentType,
  documentRequestId: string | null,
): GeneratedDocument {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);

  const gate = checkGenerationGate(studentId, documentType);
  if (!gate.ok) {
    recordAudit({
      action: 'DOCUMENT_GENERATION_REFUSED',
      recordType: 'Student',
      recordId: studentId,
      actor,
      detail: `${DOCUMENT_TYPE_LABELS[documentType]} refused — ${gate.issues.length} missing item(s).`,
      after: { issues: gate.issues },
    });
    throw new ApiError(
      422,
      'GENERATION_REFUSED',
      `${DOCUMENT_TYPE_LABELS[documentType]} cannot be generated yet. Fix the items below and try again — no blank document was produced.`,
      { details: gate.issues },
    );
  }

  const serial = `${documentType}-${new Date().getFullYear()}-${String(
    db.generatedDocuments.length + 1,
  ).padStart(5, '0')}`;

  const generated: GeneratedDocument = {
    id: nextId('gd'),
    documentRequestId,
    studentId,
    documentType,
    // Frozen at generation time. Later grade edits never reach back into an
    // already-issued document.
    snapshot: buildSnapshot(studentId, documentType),
    generatedByUserId: actor.id,
    generatedAt: nowIso(),
    serialNumber: serial,
  };
  db.generatedDocuments.push(generated);

  recordAudit({
    action: 'DOCUMENT_GENERATED',
    recordType: 'GeneratedDocument',
    recordId: generated.id,
    actor,
    detail: `${DOCUMENT_TYPE_LABELS[documentType]} ${serial} generated for ${fullName(student)}.`,
    after: { serial, documentType },
  });

  return clone(generated);
}

export function listGeneratedDocuments(studentId?: string): GeneratedDocument[] {
  requireRole('REGISTRAR');
  const rows = studentId
    ? db.generatedDocuments.filter((g) => g.studentId === studentId)
    : db.generatedDocuments;
  return cloneAll([...rows].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)));
}

export function getGeneratedDocument(id: string): GeneratedDocument {
  const user = requireSession();
  const found = db.generatedDocuments.find((g) => g.id === id);
  if (!found) throw notFound('That generated document could not be found.');
  if (user.role === 'TRAINEE' && user.studentId !== found.studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only view your own documents.');
  }
  return clone(found);
}

/* ---------------------------------------------------------------- */
/* GSA                                                               */
/* ---------------------------------------------------------------- */

export interface GsaSubjectRow {
  courseCode: string;
  courseTitle: string;
  periodLabel: string;
  units: number;
  /** Day pattern, time and room — null when the row has no class attached. */
  scheduleLabel: string | null;
}

export interface GsaResult {
  student: StudentView;
  gwa: string;
  totalUnits: number;
  countedUnits: number;
  hasUnresolvedInc: boolean;
  perTerm: Array<{ label: string; gwa: string; units: number }>;
  /** Every enrolled subject, so the GSA reads alongside what it was computed from. */
  subjects: GsaSubjectRow[];
  note: string | null;
}

export function computeGsa(studentId: string): GsaResult {
  const user = currentUser();
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in first.');
  if (user.role === 'TRAINEE' && user.studentId !== studentId) {
    throw new ApiError(403, 'FORBIDDEN', 'You may only view your own average.');
  }
  if (user.role !== 'REGISTRAR' && user.role !== 'TRAINEE') {
    throw new ApiError(403, 'FORBIDDEN', 'Only the Registrar may compute a GSA.');
  }

  const record = buildAcademicRecord(studentId);
  const allRows = record.groups.flatMap((g) =>
    g.rows.map((r) => ({
      units: r.units,
      finalGrade: r.finalGrade,
      completionGrade: r.completionGrade,
    })),
  );
  const result = computeGwa(allRows);

  return {
    student: record.student,
    gwa: result.gwa,
    totalUnits: result.totalUnits,
    countedUnits: result.countedUnits,
    hasUnresolvedInc: result.hasUnresolvedInc,
    perTerm: record.groups.map((g) => ({
      label: `${g.academicYearLabel} · ${g.termLabel}`,
      gwa: g.gwa,
      units: g.totalUnits,
    })),
    subjects: record.groups.flatMap((g) =>
      g.rows.map((row) => ({
        courseCode: row.subjectCode,
        courseTitle: row.subjectTitle,
        periodLabel: `${g.academicYearLabel} · ${g.termLabel}`,
        units: row.units,
        scheduleLabel: row.scheduleLabel,
      })),
    ),
    note: result.hasUnresolvedInc
      ? 'An unresolved INC forces the average to 0.000. Resolve it in Academic Records to compute a real figure.'
      : null,
  };
}
