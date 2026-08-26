/**
 * Public online applications.
 *
 * These are the only functions in the whole server that do NOT call
 * `requireRole` — every other student function does, including the reads.
 * That is deliberate and contained: an applicant has no account, so the
 * enrollment form has to reach the store without one.
 *
 * The trade of skipping authentication is made back in three ways:
 *   · a submission can only ever create a PENDING record — never approve,
 *     edit or read an existing one;
 *   · the status lookup returns a deliberately thin view, because a short
 *     reference code is guessable and must not expose an applicant's
 *     contact details;
 *   · every submission is written to the audit trail as anonymous.
 */

import type { ApplicantStanding, Student } from '@/types';
import { APPLICANT_STANDING_LABELS, STUDENT_STATUS_LABELS } from '@/types';
import type { ApplicationReceipt, ApplicationStatusView } from '@/types/views';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { recordAnonymousAudit } from './audit';
import { nextAutoStudentNumber } from './students';

export interface ApplicationInput {
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  email: string;
  contactNumber: string;
  address: string;
  birthDate: string;
  birthPlace: string;
  sex: Student['sex'];
  civilStatus: string;
  nationality: string;
  applicantStanding: ApplicantStanding | '';
  /** Where they finished Senior High or their previous college. */
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  programId: string;
}

/**
 * Crockford-style alphabet: no I, L, O or U, so a code read off a screen and
 * typed back in by hand cannot be confused with 1, 0 or spelled into a word.
 */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateReferenceCode(): string {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let body = '';
    for (let i = 0; i < 6; i += 1) {
      body += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
    }
    const code = `RS-${year}-${body}`;
    if (!db.students.some((s) => s.referenceCode === code)) return code;
  }
  // 32^6 is ~1e9 combinations; 50 collisions in a row means something is
  // badly wrong rather than unlucky.
  throw new Error('Could not generate a unique reference code.');
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function submitApplication(input: ApplicationInput): ApplicationReceipt {
  /* --- Validate everything before anything is written. --- */

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!firstName) throw badRequest('First name is required.');
  if (!lastName) throw badRequest('Last name is required.');
  if (!input.birthDate.trim()) throw badRequest('Date of birth is required.');
  if (!input.applicantStanding) {
    throw badRequest(
      'Tell us what you have finished so far — it decides which documents you need to bring.',
    );
  }
  if (!input.programId) throw badRequest('Choose the program you are applying for.');

  const program = db.programs.find((p) => p.id === input.programId && p.isActive);
  if (!program) throw badRequest('That program is not open for applications.');

  const email = input.email.trim();
  if (!email) throw badRequest('Email address is required.');
  if (!EMAIL_PATTERN.test(email)) throw badRequest(`"${email}" is not a valid email address.`);

  const contactNumber = input.contactNumber.trim();
  if (!contactNumber) throw badRequest('Contact number is required.');

  /* --- Commit. --- */

  const standing = input.applicantStanding;
  const referenceCode = generateReferenceCode();
  const studentNumber = nextAutoStudentNumber(new Set());
  const now = nowIso();

  const student: Student = {
    id: nextId('stu'),
    studentNumber,
    firstName,
    middleName: input.middleName.trim(),
    lastName,
    extensionName: input.extensionName.trim(),
    email,
    contactNumber,
    address: input.address.trim(),
    birthDate: input.birthDate.trim(),
    birthPlace: input.birthPlace.trim(),
    sex: input.sex,
    civilStatus: input.civilStatus.trim(),
    nationality: input.nationality.trim(),
    highestEducation: APPLICANT_STANDING_LABELS[standing],
    classification: 'Student',
    scholarshipType: '',
    learnerId: '',
    applicantStanding: standing,
    referenceCode,
    driveFolderId: null,
    secondarySchool: input.secondarySchool.trim(),
    secondarySchoolYearAttended: input.secondarySchoolYearAttended.trim(),
    basisOfAdmission: '',
    dateAdmitted: '',
    nstpSerialNo: '',
    graduatedAt: null,
    specialOrderNo: null,
    programId: program.id,
    // An online application is exactly a pending application — it lands in
    // the same queue as one the registrar typed in, and is approved the same
    // way, which is what assigns the curriculum.
    curriculumId: null,
    sectionId: null,
    yearLevel: 1,
    status: 'PENDING',
    isTransferee: standing !== 'SHS_GRADUATE',
    rejectionReason: null,
    approvedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  db.students.push(student);

  recordAnonymousAudit(
    'APPLICATION_SUBMITTED',
    'Student',
    student.id,
    `${firstName} ${lastName} (online applicant)`,
    `Applied online for ${program.code} as a ${APPLICANT_STANDING_LABELS[standing]}. Reference ${referenceCode}.`,
  );

  return {
    referenceCode,
    studentNumber,
    fullName: `${firstName} ${lastName}`,
    programName: program.name,
    standing,
    submittedAt: now,
  };
}

/** "Juan Dela Rosa" becomes "J*** D*** " — enough to recognise, not to harvest. */
function maskName(student: Student): string {
  const mask = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `${trimmed.charAt(0).toUpperCase()}${'*'.repeat(Math.max(2, trimmed.length - 1))}`;
  };
  return `${mask(student.firstName)} ${mask(student.lastName)}`.trim();
}

export function lookupApplication(referenceCode: string): ApplicationStatusView {
  const code = referenceCode.trim().toUpperCase();
  if (!code) throw badRequest('Enter your reference code.');

  const student = db.students.find((s) => s.referenceCode.toUpperCase() === code);
  if (!student) {
    throw notFound(
      'No application matches that reference code. Check it against the copy you were given.',
    );
  }

  const program = db.programs.find((p) => p.id === student.programId);

  return {
    referenceCode: student.referenceCode,
    maskedName: maskName(student),
    programName: program?.name ?? '—',
    status: student.status,
    statusLabel: STUDENT_STATUS_LABELS[student.status],
    submittedAt: student.createdAt,
    rejectionReason: student.rejectionReason,
  };
}
