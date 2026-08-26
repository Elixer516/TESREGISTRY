/**
 * The admission-requirement registry.
 *
 * One table, read by both halves of the app: the UI asks it which slots to
 * render, and the service layer asks it which uploads to refuse. Keeping a
 * single source of truth is what stops the two drifting apart — a document
 * hidden in the UI is a courtesy, the server refusing it is the rule.
 *
 * Which documents apply depends entirely on what the applicant had finished
 * before applying. A Senior High graduate has a Form 138 and no Transcript of
 * Records; a college transferee has the reverse. Offering both to everyone
 * would invite the wrong scan into the wrong slot.
 */

import type { ApplicantStanding, EnrollmentDocumentType, Student } from '@/types';

export type DocumentRequirement = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';

export interface EnrollmentDocumentSpec {
  type: EnrollmentDocumentType;
  /** Official name, as it reads on the admission checklist. */
  label: string;
  /** Goes into the filename: LASTNAME_FIRSTNAME_<fileSlug>.pdf */
  fileSlug: string;
  /** Extensions the registrar may upload for this slot. */
  accept: string[];
  note?: string;
  requirement: Record<ApplicantStanding, DocumentRequirement>;
}

const ALL_REQUIRED: Record<ApplicantStanding, DocumentRequirement> = {
  SHS_GRADUATE: 'REQUIRED',
  COLLEGE_UNDERGRADUATE: 'REQUIRED',
  COLLEGE_GRADUATE: 'REQUIRED',
};

const ALL_OPTIONAL: Record<ApplicantStanding, DocumentRequirement> = {
  SHS_GRADUATE: 'OPTIONAL',
  COLLEGE_UNDERGRADUATE: 'OPTIONAL',
  COLLEGE_GRADUATE: 'OPTIONAL',
};

const PDF = ['.pdf'];
const SCAN = ['.pdf', '.jpg', '.jpeg', '.png'];
const IMAGE = ['.jpg', '.jpeg', '.png'];

export const ENROLLMENT_DOCUMENTS: EnrollmentDocumentSpec[] = [
  {
    type: 'REGISTRATION_FORM',
    label: 'Accomplished copies of the Registration Forms',
    fileSlug: 'REGISTRATION_FORM',
    accept: SCAN,
    requirement: ALL_REQUIRED,
  },
  {
    type: 'BIRTH_CERTIFICATE',
    label: 'Photocopy of Birth Certificate',
    fileSlug: 'BIRTH_CERTIFICATE',
    accept: SCAN,
    note: 'PSA-issued preferred.',
    requirement: ALL_REQUIRED,
  },
  {
    type: 'FORM_138',
    label: 'Original Form 138 (Report Card)',
    fileSlug: 'FORM_138',
    accept: SCAN,
    note: 'Senior High School graduates only.',
    requirement: {
      SHS_GRADUATE: 'REQUIRED',
      COLLEGE_UNDERGRADUATE: 'NOT_APPLICABLE',
      COLLEGE_GRADUATE: 'NOT_APPLICABLE',
    },
  },
  {
    type: 'TOR',
    label: 'Original Transcript of Records',
    fileSlug: 'TOR',
    accept: PDF,
    note: 'College undergraduates and graduates only.',
    requirement: {
      SHS_GRADUATE: 'NOT_APPLICABLE',
      COLLEGE_UNDERGRADUATE: 'REQUIRED',
      COLLEGE_GRADUATE: 'REQUIRED',
    },
  },
  {
    type: 'TOR_PHOTOCOPY',
    label: 'Transcript of Records — photocopy',
    fileSlug: 'TOR_PHOTOCOPY',
    accept: SCAN,
    note: 'One (1) photocopy accompanies the original.',
    requirement: {
      SHS_GRADUATE: 'NOT_APPLICABLE',
      COLLEGE_UNDERGRADUATE: 'REQUIRED',
      COLLEGE_GRADUATE: 'REQUIRED',
    },
  },
  {
    type: 'HONORABLE_DISMISSAL',
    label: 'Honorable Dismissal',
    fileSlug: 'HONORABLE_DISMISSAL',
    accept: SCAN,
    note: 'Issued when transferring out — college undergraduates only.',
    requirement: {
      SHS_GRADUATE: 'NOT_APPLICABLE',
      COLLEGE_UNDERGRADUATE: 'REQUIRED',
      COLLEGE_GRADUATE: 'NOT_APPLICABLE',
    },
  },
  {
    type: 'GOOD_MORAL',
    label: 'Original Certificate of Good Moral Character',
    fileSlug: 'GOOD_MORAL',
    accept: SCAN,
    requirement: ALL_REQUIRED,
  },
  {
    type: 'CLEARANCE',
    label: 'Barangay, Police or NBI Clearance',
    fileSlug: 'CLEARANCE',
    accept: SCAN,
    note: 'May be submitted after enrollment.',
    requirement: ALL_OPTIONAL,
  },
  {
    type: 'ID_PICTURE',
    label: '2×2 ID Picture',
    fileSlug: 'ID_PICTURE',
    accept: IMAGE,
    note: 'One (1) copy.',
    requirement: ALL_REQUIRED,
  },
];

export function specFor(type: EnrollmentDocumentType): EnrollmentDocumentSpec {
  const found = ENROLLMENT_DOCUMENTS.find((doc) => doc.type === type);
  if (!found) throw new Error(`Unknown enrollment document type: ${type}`);
  return found;
}

/**
 * What this document is to this applicant. A null standing means the record
 * predates the public form (or came from a CSV), so nothing can be decided
 * yet — the registrar has to set the standing first.
 */
export function requirementFor(
  type: EnrollmentDocumentType,
  standing: ApplicantStanding | null,
): DocumentRequirement {
  if (!standing) return 'NOT_APPLICABLE';
  return specFor(type).requirement[standing];
}

/** The documents an applicant of this standing must or may submit. */
export function documentsFor(standing: ApplicantStanding): EnrollmentDocumentSpec[] {
  return ENROLLMENT_DOCUMENTS.filter(
    (doc) => doc.requirement[standing] !== 'NOT_APPLICABLE',
  );
}

/* ------------------------------------------------------------------ */
/* Naming                                                              */
/* ------------------------------------------------------------------ */

type NameParts = Pick<Student, 'firstName' | 'middleName' | 'lastName' | 'extensionName'>;

/**
 * Fold to plain uppercase ASCII: "Cerdeña" becomes "CERDENA". Real trainee
 * names carry Ñ and accents, which survive Drive fine but make filenames
 * awkward to type, search and match across systems.
 */
function asciiFold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function fileToken(value: string): string {
  return asciiFold(value)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * The student's Drive folder: "CERDEÑA, NIZZY V."
 *
 * Real characters are kept here — a human browsing Drive should see the name
 * as it is actually spelled. Only the slash is stripped, since Drive treats
 * it as a path separator in some clients.
 */
export function buildStudentFolderName(student: NameParts): string {
  const initial = student.middleName.trim().charAt(0);
  const middle = initial ? ` ${initial.toUpperCase()}.` : '';
  const suffix = student.extensionName.trim() ? ` ${student.extensionName.trim()}` : '';
  const last = student.lastName.trim().replace(/\//g, '-');
  const first = student.firstName.trim().replace(/\//g, '-');
  return `${last.toUpperCase()}, ${first.toUpperCase()}${middle}${suffix}`;
}

/**
 * The stored filename: "CERDENA_NIZZY_BIRTH_CERTIFICATE.pdf"
 *
 * The extension comes from the file the registrar actually picked, not from
 * the slot, so a JPEG scan of a birth certificate stays a .jpg.
 */
export function buildDocumentFileName(
  student: NameParts,
  type: EnrollmentDocumentType,
  originalFileName: string,
): string {
  const extension = extensionOf(originalFileName);
  const slug = specFor(type).fileSlug;
  const stem = [fileToken(student.lastName), fileToken(student.firstName), slug]
    .filter(Boolean)
    .join('_');
  return `${stem}${extension}`;
}

/** Lowercased extension including the dot, or '' when there is none. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot <= 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot).toLowerCase();
}

/** True when the picked file's extension is allowed for this slot. */
export function isAcceptedExtension(
  type: EnrollmentDocumentType,
  fileName: string,
): boolean {
  return specFor(type).accept.includes(extensionOf(fileName));
}
