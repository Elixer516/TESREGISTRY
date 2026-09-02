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
 *   · the status lookup returns a deliberately thin view, because the
 *     reference code is sequential and therefore guessable, and must not
 *     expose an applicant's contact details;
 *   · every submission is written to the audit trail as anonymous.
 */

import type { ApplicantStanding, EnrollmentDocument, Student } from '@/types';
import { APPLICANT_STANDING_LABELS, STUDENT_STATUS_LABELS } from '@/types';
import type { ApplicationReceipt, ApplicationStatusView } from '@/types/views';
import { composeAddress, composeBirthPlace } from '@/lib/psgc';
import { requirementFor, standingFromAttainment } from '@/lib/enrollment-documents';
import { badRequest, notFound } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { recordAnonymousAudit } from './audit';
import { assertNotDuplicatePerson, nextAutoStudentNumber } from './students';

/** One file the applicant uploaded, already written to Drive by the relay. */
export interface ApplicationDocumentInput {
  documentType: 'ID_PICTURE' | 'BIRTH_CERTIFICATE';
  fileName: string;
  fileSize: number;
  mimeType: string;
  driveFileId: string;
  driveWebViewLink: string;
}

export interface ApplicationInput {
  /* Step 1 — Main Details */
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  sex: Student['sex'];
  birthDate: string;
  civilStatus: string;
  addressRegion: string;
  addressProvince: string;
  addressCityMunicipality: string;
  addressBarangay: string;
  addressDistrict: string;
  addressStreet: string;

  /* Step 2 — Additional Details */
  birthRegion: string;
  birthProvince: string;
  birthCityMunicipality: string;
  bloodType: string;
  /** Educational Attainment — also what the document checklist is derived from. */
  highestEducation: string;
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  employmentStatus: string;
  disability: string;
  disabilitySpecify: string;

  /* Step 3 — Contact Details */
  email: string;
  contactNumber: string;
  socialMedia: string;
  socialMediaAccount: string;
  emergencyContactLastName: string;
  emergencyContactFirstName: string;
  emergencyContactMiddleName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  emergencyContactAddress: string;

  /* Step 4 — Course Details */
  programId: string;

  /* Step 5 — Identification Details */
  driveFolderId: string;
  documents: ApplicationDocumentInput[];
}

/**
 * `RS-{year}{month}-{sequence}`, e.g. RS-202608-00001.
 *
 * Sequential rather than random, which makes a neighbouring code trivially
 * guessable — the status lookup below is thin precisely because of that.
 */
function generateReferenceCode(): string {
  const now = new Date();
  const prefix = `RS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-`;

  let seq = 1;
  for (const s of db.students) {
    if (s.referenceCode.startsWith(prefix)) {
      const n = Number(s.referenceCode.slice(prefix.length));
      if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
  }
  return `${prefix}${String(seq).padStart(5, '0')}`;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function submitApplication(input: ApplicationInput): ApplicationReceipt {
  /* --- Validate everything before anything is written. --- */

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (!firstName) throw badRequest('First name is required.');
  if (!lastName) throw badRequest('Last name is required.');
  if (!input.birthDate.trim()) throw badRequest('Birthdate is required.');
  if (!input.highestEducation.trim()) throw badRequest('Educational Attainment is required.');
  if (!input.programId) throw badRequest('Choose the course you are applying for.');

  const program = db.programs.find((p) => p.id === input.programId && p.isActive);
  if (!program) throw badRequest('That course is not open for applications.');

  const email = input.email.trim();
  if (!email) throw badRequest('Email is required.');
  if (!EMAIL_PATTERN.test(email)) throw badRequest(`"${email}" is not a valid email address.`);

  const contactNumber = input.contactNumber.trim();
  if (!contactNumber) throw badRequest('Phone Number is required.');

  if (!input.emergencyContactLastName.trim() || !input.emergencyContactFirstName.trim()) {
    throw badRequest("The emergency contact's last name and first name are both required.");
  }
  if (!input.emergencyContactNumber.trim()) {
    throw badRequest('An emergency contact phone number is required.');
  }

  const standing = standingFromAttainment(input.highestEducation);

  /* The two files are the point of the Identification step — a submission
     without them would leave a record nobody can act on. */
  const seen = new Set<string>();
  for (const doc of input.documents) {
    if (!doc.driveFileId.trim()) {
      throw badRequest('One of the uploads did not complete. Try that file again.');
    }
    if (requirementFor(doc.documentType, standing) === 'NOT_APPLICABLE') {
      throw badRequest(`${doc.documentType} does not apply to this application.`);
    }
    seen.add(doc.documentType);
  }
  if (!seen.has('ID_PICTURE')) throw badRequest('Upload your ID Picture before submitting.');
  if (!seen.has('BIRTH_CERTIFICATE')) {
    throw badRequest('Upload your Birth Certificate/NSO before submitting.');
  }
  if (!input.driveFolderId.trim()) {
    throw badRequest('Your documents were not filed. Try uploading them again.');
  }

  /* --- Commit. --- */

  const referenceCode = generateReferenceCode();
  // Somebody applying a second time — a double-tap on Submit, or a return
  // visit a week later because they were not sure the first one went through.
  // Refused here rather than left for the registrar to spot two identical
  // rows in Pending and work out which to keep.
  assertNotDuplicatePerson(
    {
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
      email: input.email,
    },
    undefined,
    // The applicant's door is the strict one: same name is enough. Nobody is
    // standing here to compare two records and judge, and a mistyped birth
    // date must not be what decides whether a duplicate gets in.
    { strictName: true },
  );

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
    address: composeAddress({
      street: input.addressStreet,
      barangay: input.addressBarangay,
      cityMunicipality: input.addressCityMunicipality,
      province: input.addressProvince,
      regionCode: input.addressRegion,
    }),
    addressRegion: input.addressRegion.trim(),
    addressProvince: input.addressProvince.trim(),
    addressCityMunicipality: input.addressCityMunicipality.trim(),
    addressBarangay: input.addressBarangay.trim(),
    addressDistrict: input.addressDistrict.trim(),
    addressStreet: input.addressStreet.trim(),
    birthDate: input.birthDate.trim(),
    birthPlace: composeBirthPlace({
      cityMunicipality: input.birthCityMunicipality,
      province: input.birthProvince,
      regionCode: input.birthRegion,
    }),
    birthRegion: input.birthRegion.trim(),
    birthProvince: input.birthProvince.trim(),
    birthCityMunicipality: input.birthCityMunicipality.trim(),
    sex: input.sex,
    civilStatus: input.civilStatus.trim(),
    nationality: 'Filipino',
    bloodType: input.bloodType.trim(),
    employmentStatus: input.employmentStatus.trim(),
    disability: input.disability.trim(),
    disabilitySpecify: input.disabilitySpecify.trim(),
    socialMedia: input.socialMedia.trim(),
    socialMediaAccount: input.socialMediaAccount.trim(),
    emergencyContactLastName: input.emergencyContactLastName.trim(),
    emergencyContactFirstName: input.emergencyContactFirstName.trim(),
    emergencyContactMiddleName: input.emergencyContactMiddleName.trim(),
    emergencyContactRelationship: input.emergencyContactRelationship.trim(),
    emergencyContactNumber: input.emergencyContactNumber.trim(),
    emergencyContactAddress: input.emergencyContactAddress.trim(),
    highestEducation: input.highestEducation.trim(),
    classification: 'Student',
    scholarshipType: '',
    learnerId: '',
    applicantStanding: standing,
    referenceCode,
    driveFolderId: input.driveFolderId.trim(),
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

  // The applicant filed these themselves, so there is no staff user to
  // attribute them to. '' is read as "Online applicant" when displayed.
  for (const doc of input.documents) {
    const record: EnrollmentDocument = {
      id: nextId('edoc'),
      studentId: student.id,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      driveFileId: doc.driveFileId,
      driveWebViewLink: doc.driveWebViewLink,
      version: 1,
      uploadedByUserId: '',
      uploadedAt: now,
    };
    db.enrollmentDocuments.push(record);
  }

  recordAnonymousAudit(
    'APPLICATION_SUBMITTED',
    'Student',
    student.id,
    `${firstName} ${lastName} (online applicant)`,
    `Applied online for ${program.code} as a ${APPLICANT_STANDING_LABELS[standing]}. ` +
      `Reference ${referenceCode}. ${input.documents.length} document(s) filed to Drive.`,
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

/** Re-exported so the standing map lives in one place. */
export type { ApplicantStanding };
