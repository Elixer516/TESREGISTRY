/**
 * Document requests.
 *
 * A trainee asks for a document from their portal — a TOR, a Certification
 * of Grades, their Certificate of Registration — and the Registrar works the
 * request through to release:
 *
 *   PENDING → PROCESSING → READY (for release) → RELEASED
 *
 * and may cancel it at any point before release, with a reason the trainee
 * reads. The trainee may withdraw their own request while it is PENDING.
 * The request is the paperwork trail only; the document itself is printed
 * from the screen that makes it (the TOR from Transcript & Graduation, and
 * so on).
 */

import type { DocumentRequest, DocumentType, RequestStatus } from '@/types';
import { DOCUMENT_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/types';
import type { DocumentRequestInput, DocumentRequestView } from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { userDisplayName } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { clearanceFor } from './clearance';

/** What a trainee may ask for. A diploma and SO copy only once graduated. */
export const REQUESTABLE_TYPES: readonly DocumentType[] = [
  'TOR',
  'CERT_GRADES',
  'CERT_ENROLLMENT',
  'COR',
  'GOOD_MORAL',
  'DIPLOMA',
  'SPECIAL_ORDER',
];
const GRADUATES_ONLY: readonly DocumentType[] = ['DIPLOMA', 'SPECIAL_ORDER'];

const NEXT: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['RELEASED', 'CANCELLED'],
  RELEASED: [],
  CANCELLED: [],
};

function toView(request: DocumentRequest): DocumentRequestView {
  const student = db.students.find((s) => s.id === request.studentId);
  const program = db.programs.find((p) => p.id === student?.programId);
  return {
    ...request,
    studentName: student ? `${student.lastName}, ${student.firstName}` : 'Unknown trainee',
    studentNumber: student?.studentNumber ?? '—',
    programCode: program?.code ?? '—',
    documentTypeLabel: DOCUMENT_TYPE_LABELS[request.documentType],
    statusLabel: REQUEST_STATUS_LABELS[request.status],
    requestedByName: userDisplayName(request.requestedByUserId),
    hasGeneratedDocument: false,
    lackingRequirements: student ? clearanceFor(student).missing : [],
  };
}

function nextReference(): string {
  const year = new Date().getFullYear();
  const prefix = `DR-${year}-`;
  let seq = 0;
  for (const r of db.documentRequests) {
    if (r.referenceNumber.startsWith(prefix)) seq = Math.max(seq, Number(r.referenceNumber.slice(prefix.length)) || 0);
  }
  return `${prefix}${String(seq + 1).padStart(4, '0')}`;
}

const newestFirst = (a: DocumentRequest, b: DocumentRequest) => b.requestedAt.localeCompare(a.requestedAt);

/* ---- The trainee ---------------------------------------------- */

function myStudent() {
  const user = requireRole('TRAINEE');
  const student = user.studentId ? db.students.find((s) => s.id === user.studentId) : undefined;
  if (!student) throw notFound('This account is not linked to a student record.');
  return { user, student };
}

export function myDocumentRequests(): DocumentRequestView[] {
  const { student } = myStudent();
  return db.documentRequests.filter((r) => r.studentId === student.id).sort(newestFirst).map(toView);
}

export function requestDocument(input: DocumentRequestInput): DocumentRequestView {
  const { user, student } = myStudent();
  if (!REQUESTABLE_TYPES.includes(input.documentType)) throw badRequest('That document cannot be requested here.');
  if (GRADUATES_ONLY.includes(input.documentType) && student.status !== 'GRADUATED') {
    throw badRequest(`A ${DOCUMENT_TYPE_LABELS[input.documentType]} is issued once you have graduated.`);
  }
  const purpose = input.purpose.trim();
  if (!purpose) throw badRequest('Say what the document is for — the Registrar prints it on some documents.');
  if (purpose.length > 200) throw badRequest('Keep the purpose to 200 characters.');
  const deliveryEmail = (input.deliveryEmail ?? '').trim();
  if (!deliveryEmail) throw badRequest('Give the email address the document should be sent to.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(deliveryEmail) || deliveryEmail.length > 120) {
    throw badRequest('That email address does not look right.');
  }
  const copies = Math.round(Number(input.copies));
  if (!Number.isFinite(copies) || copies < 1 || copies > 5) throw badRequest('Request between 1 and 5 copies.');
  const open = db.documentRequests.find(
    (r) => r.studentId === student.id && r.documentType === input.documentType && ['PENDING', 'PROCESSING', 'READY'].includes(r.status),
  );
  if (open) {
    throw badRequest(`You already have a ${DOCUMENT_TYPE_LABELS[input.documentType]} request in progress (${open.referenceNumber}).`);
  }

  const now = nowIso();
  const request: DocumentRequest = {
    id: nextId('dr'),
    studentId: student.id,
    documentType: input.documentType,
    purpose,
    copies,
    deliveryEmail,
    referenceNumber: nextReference(),
    status: 'PENDING',
    requestedByUserId: user.id,
    requestedAt: now,
    updatedAt: now,
    releasedAt: null,
    remarks: '',
  };
  db.documentRequests.push(request);
  recordAudit({
    action: 'DOCUMENT_REQUESTED',
    recordType: 'DocumentRequest',
    recordId: request.id,
    actor: user,
    detail: `${student.firstName} ${student.lastName} requested ${copies} × ${DOCUMENT_TYPE_LABELS[request.documentType]} (${request.referenceNumber}).`,
    after: { ...request },
  });
  return toView(request);
}

export function withdrawMyRequest(requestId: string): DocumentRequestView {
  const { user, student } = myStudent();
  const request = db.documentRequests.find((r) => r.id === requestId && r.studentId === student.id);
  if (!request) throw notFound('That request could not be found.');
  if (request.status !== 'PENDING') {
    throw badRequest('The Registrar has started on this request. Ask at the window to cancel it.');
  }
  request.status = 'CANCELLED';
  request.remarks = 'Withdrawn by the trainee.';
  request.updatedAt = nowIso();
  recordAudit({
    action: 'DOCUMENT_STATUS_CHANGED',
    recordType: 'DocumentRequest',
    recordId: request.id,
    actor: user,
    detail: `${request.referenceNumber} withdrawn by the trainee.`,
  });
  return toView(request);
}

/* ---- The Registrar -------------------------------------------- */

export function listDocumentRequests(status?: RequestStatus | 'OPEN' | 'ALL'): DocumentRequestView[] {
  requireRole('REGISTRAR');
  return db.documentRequests
    .filter((r) => {
      if (!status || status === 'ALL') return true;
      if (status === 'OPEN') return ['PENDING', 'PROCESSING', 'READY'].includes(r.status);
      return r.status === status;
    })
    .sort(newestFirst)
    .map(toView);
}

export function updateDocumentRequest(requestId: string, status: RequestStatus, remarks = ''): DocumentRequestView {
  const actor = requireRole('REGISTRAR');
  const request = db.documentRequests.find((r) => r.id === requestId);
  if (!request) throw notFound('That request could not be found.');
  if (!NEXT[request.status].includes(status)) {
    throw badRequest(`A ${REQUEST_STATUS_LABELS[request.status].toLowerCase()} request cannot be moved to ${REQUEST_STATUS_LABELS[status].toLowerCase()}.`);
  }
  const note = remarks.trim();
  if (status === 'CANCELLED' && !note) throw badRequest('Say why it is cancelled — the trainee reads this.');
  // A request is not processed while the trainee still owes admission
  // requirements; the Registrar emails them the standard list instead.
  if (status === 'PROCESSING') {
    const student = db.students.find((s) => s.id === request.studentId);
    const lacking = student ? clearanceFor(student).missing : [];
    if (lacking.length > 0) {
      throw badRequest(
        `This cannot be processed yet — the trainee still lacks: ${lacking.join(', ')}. Email them the list of what is lacking.`,
      );
    }
  }
  const before = { status: request.status, remarks: request.remarks };
  request.status = status;
  if (note) request.remarks = note;
  request.updatedAt = nowIso();
  if (status === 'RELEASED') request.releasedAt = request.updatedAt;
  recordAudit({
    action: 'DOCUMENT_STATUS_CHANGED',
    recordType: 'DocumentRequest',
    recordId: request.id,
    actor,
    detail: `${request.referenceNumber}: ${REQUEST_STATUS_LABELS[before.status]} → ${REQUEST_STATUS_LABELS[status]}.${note ? ` ${note}` : ''}`,
    before,
    after: { status, remarks: request.remarks },
  });
  return toView(request);
}

/** How many requests are waiting on the Registrar. No role check — the dashboard composes it. */
export function openRequestCount(): number {
  return db.documentRequests.filter((r) => r.status === 'PENDING' || r.status === 'PROCESSING').length;
}
