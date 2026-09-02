/**
 * Student records: applications, approval, rejection, edits and bulk import.
 *
 * Approval is the gate that assigns a curriculum — a student without one
 * cannot be enrolled, so the curriculum is required, not optional.
 */

import type { ApplicantStanding, CsvRowError, Student, StudentStatus } from '@/types';
import { SETTABLE_STATUSES } from '@/types';
import type {
  StudentImportResult,
  StudentImportRow,
  StudentSearchFilters,
  StudentView,
} from '@/types/views';
import { badRequest, duplicate, validationFailed } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { BLANK_PROFILE } from '../data/blank-profile';
import { getCurriculum, getProgram, getSection, getStudent, toStudentView } from '../repositories/lookups';
import { requireRole, verifyOwnPassword } from '../auth';
import { composeAddress, composeBirthPlace } from '@/lib/psgc';
import { recordAudit } from './audit';

function matchesQuery(student: Student, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    student.studentNumber,
    student.firstName,
    student.middleName,
    student.lastName,
    `${student.firstName} ${student.lastName}`,
    `${student.lastName}, ${student.firstName}`,
    student.email,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}

export function listStudents(filters: StudentSearchFilters = {}): StudentView[] {
  requireRole('REGISTRAR');

  let rows = [...db.students];

  rows = filters.includeArchived ? rows.filter((s) => s.archivedAt) : rows.filter((s) => !s.archivedAt);

  if (filters.statuses && filters.statuses.length > 0) {
    const allowed = new Set(filters.statuses);
    rows = rows.filter((s) => allowed.has(s.status));
  } else if (filters.status && filters.status !== 'ALL') {
    rows = rows.filter((s) => s.status === filters.status);
  }

  if (filters.programId) rows = rows.filter((s) => s.programId === filters.programId);
  if (filters.sectionId) rows = rows.filter((s) => s.sectionId === filters.sectionId);
  if (filters.query) rows = rows.filter((s) => matchesQuery(s, filters.query ?? ''));

  return rows
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
    .map(toStudentView);
}

export function getStudentById(id: string): StudentView {
  requireRole('REGISTRAR');
  return toStudentView(getStudent(id));
}

export interface StudentInput {
  studentNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName?: string;
  email: string;
  contactNumber: string;
  address: string;
  birthDate: string;
  sex: Student['sex'];
  civilStatus?: string;
  nationality?: string;
  highestEducation?: string;
  classification?: string;
  scholarshipType?: string;
  /** Optional here — a walk-in record can be encoded before it is known. */
  applicantStanding?: ApplicantStanding | null;
  programId: string;
  yearLevel: number;
  isTransferee: boolean;
}

/**
 * Fold a name for comparison — accents stripped, case and punctuation
 * dropped, so "Dela Cruz", "dela cruz" and "Delacruz" collapse together.
 */
function foldName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Refuse a second record for somebody already on file.
 *
 * Two people genuinely can share a name, so a name alone is not enough to
 * call it — but a name AND a birth date together is, and so is an email
 * address. Either match is treated as the same human coming round twice.
 *
 * Rejected and archived records deliberately do NOT block. An application
 * that was turned down may be made again, and that is a normal thing for an
 * applicant to do; refusing them because of the refusal would be perverse.
 *
 * The message names the existing student number, because the useful next
 * action is to go and look at that record rather than to try again.
 */
export function assertNotDuplicatePerson(
  candidate: { firstName: string; lastName: string; birthDate: string; email: string },
  ignoreId?: string,
): void {
  const firstName = foldName(candidate.firstName);
  const lastName = foldName(candidate.lastName);
  const birthDate = candidate.birthDate.trim();
  const email = candidate.email.trim().toLowerCase();

  for (const existing of db.students) {
    if (existing.id === ignoreId) continue;
    if (existing.status === 'REJECTED' || existing.archivedAt) continue;

    if (email && existing.email.trim().toLowerCase() === email) {
      throw duplicate(
        `${existing.firstName} ${existing.lastName} (${existing.studentNumber}) already uses the email ${existing.email}. Open that record instead of creating a second one.`,
      );
    }

    const sameName =
      foldName(existing.firstName) === firstName && foldName(existing.lastName) === lastName;
    if (sameName && birthDate && existing.birthDate.trim() === birthDate) {
      throw duplicate(
        `${existing.firstName} ${existing.lastName} is already on file as ${existing.studentNumber}, with the same name and date of birth. Open that record instead of creating a second one.`,
      );
    }
  }
}

function assertUniqueStudentNumber(studentNumber: string, ignoreId?: string): void {
  const exists = db.students.some(
    (s) =>
      s.id !== ignoreId &&
      s.studentNumber.trim().toLowerCase() === studentNumber.trim().toLowerCase(),
  );
  if (exists) {
    throw duplicate(
      `Student number ${studentNumber} is already on file. Student numbers must be unique.`,
    );
  }
}

export function createStudent(input: StudentInput): StudentView {
  const actor = requireRole('REGISTRAR');

  const studentNumber = input.studentNumber.trim();
  if (!studentNumber) throw badRequest('Student number is required.');
  if (!input.firstName.trim()) throw badRequest('First name is required.');
  if (!input.lastName.trim()) throw badRequest('Last name is required.');
  if (!input.programId) throw badRequest('Select a program.');
  assertUniqueStudentNumber(studentNumber);
  assertNotDuplicatePerson({
    firstName: input.firstName,
    lastName: input.lastName,
    birthDate: input.birthDate ?? '',
    email: input.email ?? '',
  });

  const student: Student = {
    ...BLANK_PROFILE,
    id: nextId('stu'),
    studentNumber,
    firstName: input.firstName.trim(),
    middleName: input.middleName.trim(),
    lastName: input.lastName.trim(),
    extensionName: input.extensionName?.trim() ?? '',
    email: input.email.trim(),
    contactNumber: input.contactNumber.trim(),
    address: input.address.trim(),
    birthDate: input.birthDate,
    birthPlace: '',
    sex: input.sex,
    civilStatus: input.civilStatus?.trim() ?? '',
    nationality: input.nationality?.trim() ?? '',
    highestEducation: input.highestEducation?.trim() ?? '',
    classification: input.classification?.trim() ?? '',
    scholarshipType: input.scholarshipType?.trim() ?? '',
    learnerId: '',
    applicantStanding: input.applicantStanding ?? null,
    referenceCode: '',
    driveFolderId: null,
    secondarySchool: '',
    secondarySchoolYearAttended: '',
    basisOfAdmission: '',
    dateAdmitted: '',
    nstpSerialNo: '',
    graduatedAt: null,
    specialOrderNo: null,
    programId: input.programId,
    curriculumId: null,
    sectionId: null,
    yearLevel: Math.max(1, Math.round(input.yearLevel)),
    status: 'PENDING',
    isTransferee: input.isTransferee,
    rejectionReason: null,
    approvedAt: null,
    archivedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  db.students.push(student);

  recordAudit({
    action: 'STUDENT_CREATED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Application recorded for ${student.firstName} ${student.lastName} (${student.studentNumber}).`,
    after: { ...student },
  });
  return toStudentView(student);
}

/**
 * The real TESDA trainee-profiling export has no student-number column at
 * all — the centre assigns those internally. A blank row gets the next
 * `{year}-{sequence}` number, checked against both what's already on file
 * and what this same batch has already handed out.
 */
export function nextAutoStudentNumber(excluded: Set<string>): string {
  const prefix = `${new Date().getFullYear()}-`;
  let seq = 1;
  for (const s of db.students) {
    if (s.studentNumber.startsWith(prefix)) {
      const n = Number(s.studentNumber.slice(prefix.length));
      if (Number.isFinite(n) && n >= seq) seq = n + 1;
    }
  }
  let candidate = `${prefix}${String(seq).padStart(5, '0')}`;
  while (
    excluded.has(candidate.toLowerCase()) ||
    db.students.some((s) => s.studentNumber.toLowerCase() === candidate.toLowerCase())
  ) {
    seq += 1;
    candidate = `${prefix}${String(seq).padStart(5, '0')}`;
  }
  return candidate;
}

/**
 * Bulk import. Every row is validated first; a single bad row aborts the whole
 * batch, so a half-imported file can never reach the database.
 *
 * One file is one batch — the Program (and optionally Section) is chosen once
 * for the whole upload rather than read per row, because the real trainee-
 * profiling export's "Qualification/Program Title" column is a batch label
 * (e.g. "DABET 2025 A 1-2"), not a code that matches the catalog.
 */
export function importStudents(
  inputRows: StudentImportRow[],
  programId: string,
  sectionId: string | null,
): StudentImportResult {
  const actor = requireRole('REGISTRAR');

  if (inputRows.length === 0) {
    throw badRequest('The file contained no data rows.');
  }
  if (!programId) {
    throw badRequest('Choose the program this batch belongs to.');
  }
  const program = getProgram(programId);
  if (sectionId) getSection(sectionId);

  const assignedNumbers = new Set<string>();
  const rows = inputRows.map((row) => {
    const trimmed = row.studentNumber?.trim() ?? '';
    if (trimmed) {
      assignedNumbers.add(trimmed.toLowerCase());
      return row;
    }
    const auto = nextAutoStudentNumber(assignedNumbers);
    assignedNumbers.add(auto.toLowerCase());
    return { ...row, studentNumber: auto };
  });

  const errors: CsvRowError[] = [];
  const seenNumbers = new Set<string>();
  const seenPeople = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    const studentNumber = row.studentNumber?.trim() ?? '';
    if (!studentNumber) {
      errors.push({ row: rowNumber, field: 'studentNumber', message: 'Student number is required.' });
    } else if (seenNumbers.has(studentNumber.toLowerCase())) {
      errors.push({
        row: rowNumber,
        field: 'studentNumber',
        message: `Duplicate student number ${studentNumber} within this file.`,
      });
    } else if (
      db.students.some((s) => s.studentNumber.toLowerCase() === studentNumber.toLowerCase())
    ) {
      errors.push({
        row: rowNumber,
        field: 'studentNumber',
        message: `Student number ${studentNumber} already exists in the system.`,
      });
    } else {
      seenNumbers.add(studentNumber.toLowerCase());
    }

    if (!row.firstName?.trim()) {
      errors.push({ row: rowNumber, field: 'firstName', message: 'First name is required.' });
    }
    if (!row.lastName?.trim()) {
      errors.push({ row: rowNumber, field: 'lastName', message: 'Last name is required.' });
    }

    // The same person twice — inside this file, or already on record. Checked
    // as a row error rather than a thrown failure so the registrar gets every
    // bad row in one pass instead of fixing them one import at a time.
    if (row.firstName?.trim() && row.lastName?.trim()) {
      const key = `${foldName(row.lastName)}|${foldName(row.firstName)}|${row.birthDate?.trim() ?? ''}`;
      if (row.birthDate?.trim() && seenPeople.has(key)) {
        errors.push({
          row: rowNumber,
          field: 'lastName',
          message: `${row.firstName.trim()} ${row.lastName.trim()} appears more than once in this file.`,
        });
      } else {
        if (row.birthDate?.trim()) seenPeople.add(key);
        try {
          assertNotDuplicatePerson({
            firstName: row.firstName,
            lastName: row.lastName,
            birthDate: row.birthDate?.trim() ?? '',
            email: row.email?.trim() ?? '',
          });
        } catch (caught) {
          errors.push({
            row: rowNumber,
            field: 'lastName',
            message: caught instanceof Error ? caught.message : 'This person is already on file.',
          });
        }
      }
    }

    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      errors.push({ row: rowNumber, field: 'email', message: `"${row.email}" is not a valid email address.` });
    }

    const yearLevel = Number(row.yearLevel);
    if (row.yearLevel !== undefined && row.yearLevel !== null && String(row.yearLevel).trim() !== '') {
      if (!Number.isFinite(yearLevel) || yearLevel < 1 || yearLevel > 6) {
        errors.push({ row: rowNumber, field: 'yearLevel', message: 'Year level must be a number from 1 to 6.' });
      }
    }

    if (row.sex && row.sex !== 'MALE' && row.sex !== 'FEMALE') {
      errors.push({ row: rowNumber, field: 'sex', message: 'Sex must be MALE or FEMALE.' });
    }
  });

  if (errors.length > 0) {
    throw validationFailed(
      `${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was imported — fix the file and try again.`,
      { rowErrors: errors },
    );
  }

  const created: Student[] = rows.map((row) => ({
    ...BLANK_PROFILE,
    id: nextId('stu'),
    studentNumber: row.studentNumber.trim(),
    firstName: row.firstName.trim(),
    middleName: row.middleName?.trim() ?? '',
    lastName: row.lastName.trim(),
    extensionName: row.extensionName?.trim() ?? '',
    email: row.email?.trim() ?? '',
    contactNumber: row.contactNumber?.trim() ?? '',
    address: row.address?.trim() ?? '',
    birthDate: row.birthDate?.trim() ?? '',
    birthPlace: '',
    sex: row.sex === 'FEMALE' ? 'FEMALE' : 'MALE',
    civilStatus: row.civilStatus?.trim() ?? '',
    nationality: row.nationality?.trim() ?? '',
    highestEducation: row.highestEducation?.trim() ?? '',
    classification: row.classification?.trim() ?? '',
    scholarshipType: row.scholarshipType?.trim() ?? '',
    learnerId: '',
    // The TESDA profiling export carries no standing column, so an imported
    // record has none until a registrar sets it. Until then its admission
    // checklist cannot be resolved.
    applicantStanding: null,
    referenceCode: '',
    driveFolderId: null,
    secondarySchool: '',
    secondarySchoolYearAttended: '',
    basisOfAdmission: '',
    dateAdmitted: '',
    nstpSerialNo: '',
    graduatedAt: null,
    specialOrderNo: null,
    programId: program.id,
    curriculumId: null,
    sectionId,
    yearLevel: Number(row.yearLevel) > 0 ? Math.round(Number(row.yearLevel)) : 1,
    status: 'PENDING',
    isTransferee: false,
    rejectionReason: null,
    approvedAt: null,
    archivedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));

  db.students.push(...created);

  recordAudit({
    action: 'STUDENT_IMPORTED',
    recordType: 'Student',
    recordId: created.map((s) => s.id).join(','),
    actor,
    detail: `${created.length} student application${created.length === 1 ? '' : 's'} imported from CSV for ${program.code}.`,
    after: { count: created.length },
  });

  return { imported: created.length, students: created.map(toStudentView) };
}

/** Approval requires a curriculum — nothing downstream works without one. */
export function approveStudent(
  studentId: string,
  curriculumId: string,
  sectionId: string | null,
): StudentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);

  if (student.status !== 'PENDING') {
    throw badRequest(
      `Only pending applications can be approved. This record is already ${student.status}.`,
    );
  }
  if (!curriculumId) {
    throw badRequest('Select a curriculum. A student cannot be enrolled without one.');
  }

  const curriculum = getCurriculum(curriculumId);
  if (curriculum.programId !== student.programId) {
    throw badRequest(
      `${curriculum.code} belongs to a different program than this applicant’s.`,
    );
  }

  const before = { ...student };
  student.status = 'APPROVED';
  student.curriculumId = curriculumId;
  student.sectionId = sectionId;
  student.rejectionReason = null;
  student.approvedAt = nowIso();
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_APPROVED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Application approved. Curriculum ${curriculum.code} assigned.`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}

/**
 * Bulk approval. One curriculum (and optional section) is applied to every
 * selected student — reasonable since a selection is normally one imported
 * batch, which already shares a program. Validated up front, all-or-nothing.
 */
export function approveStudents(
  studentIds: string[],
  curriculumId: string,
  sectionId: string | null,
): StudentView[] {
  const actor = requireRole('REGISTRAR');

  if (studentIds.length === 0) {
    throw badRequest('Select at least one application to approve.');
  }
  if (!curriculumId) {
    throw badRequest('Select a curriculum. A student cannot be enrolled without one.');
  }
  const curriculum = getCurriculum(curriculumId);

  const students = studentIds.map((id) => getStudent(id));
  for (const student of students) {
    if (student.status !== 'PENDING') {
      throw badRequest(
        `${student.firstName} ${student.lastName} is already ${student.status} — only pending applications can be approved.`,
      );
    }
    if (curriculum.programId !== student.programId) {
      throw badRequest(
        `${curriculum.code} belongs to a different program than ${student.firstName} ${student.lastName}’s.`,
      );
    }
  }

  for (const student of students) {
    const before = { ...student };
    student.status = 'APPROVED';
    student.curriculumId = curriculumId;
    student.sectionId = sectionId;
    student.rejectionReason = null;
    student.approvedAt = nowIso();
    student.updatedAt = nowIso();

    recordAudit({
      action: 'STUDENT_APPROVED',
      recordType: 'Student',
      recordId: student.id,
      actor,
      detail: `Application approved in a batch of ${students.length}. Curriculum ${curriculum.code} assigned.`,
      before,
      after: { ...student },
    });
  }

  return students.map(toStudentView);
}

export function rejectStudent(studentId: string, reason: string): StudentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);

  if (student.status !== 'PENDING') {
    throw badRequest(
      `Only pending applications can be rejected. This record is already ${student.status}.`,
    );
  }
  if (!reason.trim()) {
    throw badRequest('Give a reason for the rejection — the applicant is entitled to one.');
  }

  const before = { ...student };
  student.status = 'REJECTED';
  student.rejectionReason = reason.trim();
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_REJECTED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Application rejected: ${reason.trim()}`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}

export interface StudentUpdateInput {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  extensionName?: string;
  email?: string;
  contactNumber?: string;
  address?: string;
  birthDate?: string;
  birthPlace?: string;
  sex?: Student['sex'];
  civilStatus?: string;
  nationality?: string;
  highestEducation?: string;
  classification?: string;
  scholarshipType?: string;
  learnerId?: string;
  applicantStanding?: ApplicantStanding | null;
  programId?: string;
  addressRegion?: string;
  addressProvince?: string;
  addressCityMunicipality?: string;
  addressBarangay?: string;
  addressDistrict?: string;
  addressStreet?: string;
  birthRegion?: string;
  birthProvince?: string;
  birthCityMunicipality?: string;
  bloodType?: string;
  employmentStatus?: string;
  disability?: string;
  disabilitySpecify?: string;
  socialMedia?: string;
  socialMediaAccount?: string;
  emergencyContactLastName?: string;
  emergencyContactFirstName?: string;
  emergencyContactMiddleName?: string;
  emergencyContactRelationship?: string;
  emergencyContactNumber?: string;
  emergencyContactAddress?: string;
  secondarySchool?: string;
  secondarySchoolYearAttended?: string;
  basisOfAdmission?: string;
  dateAdmitted?: string;
  nstpSerialNo?: string;
  specialOrderNo?: string | null;
  studentNumber?: string;
  yearLevel?: number;
  sectionId?: string | null;
  curriculumId?: string | null;
  isTransferee?: boolean;
}

export function updateStudent(studentId: string, input: StudentUpdateInput): StudentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const before = { ...student };

  if (input.studentNumber !== undefined) {
    const value = input.studentNumber.trim();
    if (!value) throw badRequest('Student number is required.');
    assertUniqueStudentNumber(value, student.id);
    student.studentNumber = value;
  }
  if (input.firstName !== undefined) student.firstName = input.firstName.trim();
  if (input.middleName !== undefined) student.middleName = input.middleName.trim();
  if (input.lastName !== undefined) student.lastName = input.lastName.trim();
  if (input.extensionName !== undefined) student.extensionName = input.extensionName.trim();
  if (input.email !== undefined) student.email = input.email.trim();
  if (input.contactNumber !== undefined) student.contactNumber = input.contactNumber.trim();
  if (input.address !== undefined) student.address = input.address.trim();
  if (input.birthDate !== undefined) student.birthDate = input.birthDate;
  if (input.birthPlace !== undefined) student.birthPlace = input.birthPlace.trim();
  if (input.sex !== undefined) student.sex = input.sex;
  if (input.civilStatus !== undefined) student.civilStatus = input.civilStatus.trim();
  if (input.nationality !== undefined) student.nationality = input.nationality.trim();
  if (input.highestEducation !== undefined) student.highestEducation = input.highestEducation.trim();
  if (input.classification !== undefined) student.classification = input.classification.trim();
  if (input.scholarshipType !== undefined) student.scholarshipType = input.scholarshipType.trim();
  if (input.learnerId !== undefined) student.learnerId = input.learnerId.trim();
  if (input.applicantStanding !== undefined) student.applicantStanding = input.applicantStanding;
  // The Diploma may still be corrected while an application is pending; after
  // approval it carries a curriculum and a section, which changing it would
  // silently invalidate.
  if (input.programId !== undefined && input.programId !== student.programId) {
    if (student.status !== 'PENDING') {
      throw badRequest(
        'The Diploma can only be changed while the application is still pending — approval is what assigns the curriculum and section.',
      );
    }
    getProgram(input.programId);
    student.programId = input.programId;
  }
  if (input.addressRegion !== undefined) student.addressRegion = input.addressRegion.trim();
  if (input.addressProvince !== undefined) student.addressProvince = input.addressProvince.trim();
  if (input.addressCityMunicipality !== undefined) {
    student.addressCityMunicipality = input.addressCityMunicipality.trim();
  }
  if (input.addressBarangay !== undefined) student.addressBarangay = input.addressBarangay.trim();
  if (input.addressDistrict !== undefined) student.addressDistrict = input.addressDistrict.trim();
  if (input.addressStreet !== undefined) student.addressStreet = input.addressStreet.trim();
  if (input.birthRegion !== undefined) student.birthRegion = input.birthRegion.trim();
  if (input.birthProvince !== undefined) student.birthProvince = input.birthProvince.trim();
  if (input.birthCityMunicipality !== undefined) {
    student.birthCityMunicipality = input.birthCityMunicipality.trim();
  }
  // The one-line address is what documents print, so it is recomposed
  // whenever any of its parts move rather than left to drift.
  const addressPartsTouched =
    input.addressRegion !== undefined ||
    input.addressProvince !== undefined ||
    input.addressCityMunicipality !== undefined ||
    input.addressBarangay !== undefined ||
    input.addressStreet !== undefined;
  if (addressPartsTouched) {
    student.address = composeAddress({
      street: student.addressStreet,
      barangay: student.addressBarangay,
      cityMunicipality: student.addressCityMunicipality,
      province: student.addressProvince,
      regionCode: student.addressRegion,
    });
  }
  const birthPartsTouched =
    input.birthRegion !== undefined ||
    input.birthProvince !== undefined ||
    input.birthCityMunicipality !== undefined;
  if (birthPartsTouched) {
    student.birthPlace = composeBirthPlace({
      cityMunicipality: student.birthCityMunicipality,
      province: student.birthProvince,
      regionCode: student.birthRegion,
    });
  }
  if (input.bloodType !== undefined) student.bloodType = input.bloodType.trim();
  if (input.employmentStatus !== undefined) {
    student.employmentStatus = input.employmentStatus.trim();
  }
  if (input.disability !== undefined) student.disability = input.disability.trim();
  if (input.disabilitySpecify !== undefined) {
    student.disabilitySpecify = input.disabilitySpecify.trim();
  }
  if (input.socialMedia !== undefined) student.socialMedia = input.socialMedia.trim();
  if (input.socialMediaAccount !== undefined) {
    student.socialMediaAccount = input.socialMediaAccount.trim();
  }
  if (input.emergencyContactLastName !== undefined) {
    student.emergencyContactLastName = input.emergencyContactLastName.trim();
  }
  if (input.emergencyContactFirstName !== undefined) {
    student.emergencyContactFirstName = input.emergencyContactFirstName.trim();
  }
  if (input.emergencyContactMiddleName !== undefined) {
    student.emergencyContactMiddleName = input.emergencyContactMiddleName.trim();
  }
  if (input.emergencyContactRelationship !== undefined) {
    student.emergencyContactRelationship = input.emergencyContactRelationship.trim();
  }
  if (input.emergencyContactNumber !== undefined) {
    student.emergencyContactNumber = input.emergencyContactNumber.trim();
  }
  if (input.emergencyContactAddress !== undefined) {
    student.emergencyContactAddress = input.emergencyContactAddress.trim();
  }
  if (input.secondarySchool !== undefined) student.secondarySchool = input.secondarySchool.trim();
  if (input.secondarySchoolYearAttended !== undefined) {
    student.secondarySchoolYearAttended = input.secondarySchoolYearAttended.trim();
  }
  if (input.basisOfAdmission !== undefined) student.basisOfAdmission = input.basisOfAdmission.trim();
  if (input.dateAdmitted !== undefined) student.dateAdmitted = input.dateAdmitted;
  if (input.nstpSerialNo !== undefined) student.nstpSerialNo = input.nstpSerialNo.trim();
  if (input.specialOrderNo !== undefined) {
    student.specialOrderNo = input.specialOrderNo?.trim() || null;
  }
  if (input.yearLevel !== undefined) student.yearLevel = Math.max(1, Math.round(input.yearLevel));
  if (input.sectionId !== undefined) student.sectionId = input.sectionId;
  if (input.isTransferee !== undefined) student.isTransferee = input.isTransferee;
  if (input.curriculumId !== undefined && input.curriculumId) {
    const curriculum = getCurriculum(input.curriculumId);
    if (curriculum.programId !== student.programId) {
      throw badRequest(`${curriculum.code} belongs to a different program.`);
    }
    student.curriculumId = input.curriculumId;
  }
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_UPDATED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Details updated for ${student.firstName} ${student.lastName}.`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}

/**
 * Direct status change. PENDING and REJECTED are deliberately not settable
 * here — they belong to the approve/reject actions, which carry side effects
 * this path would skip.
 */
export function setStudentStatus(studentId: string, status: StudentStatus): StudentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);

  if (!SETTABLE_STATUSES.includes(status)) {
    throw badRequest(
      `${status} cannot be set directly. Use the Approve or Reject action instead.`,
    );
  }
  if (student.status === 'PENDING' || student.status === 'REJECTED') {
    throw badRequest(
      'This application has not been approved yet. Approve it first, then change its standing.',
    );
  }

  const before = { ...student };
  student.status = status;
  if (status === 'GRADUATED' && !student.graduatedAt) {
    student.graduatedAt = nowIso();
  } else if (status !== 'GRADUATED') {
    student.graduatedAt = null;
    student.specialOrderNo = null;
  }
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_STATUS_CHANGED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Status changed from ${before.status} to ${status}.`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}

/* ---------------------------------------------------------------- */
/* Archive (soft delete)                                             */
/* ---------------------------------------------------------------- */

/**
 * Password-confirmed soft delete. The record and every history it points at
 * (enrollments, grades, generated documents) is kept — archiving only hides
 * it from the default lists, since real academic history is never erased.
 */
export function archiveStudent(studentId: string, password: string): StudentView {
  const actor = requireRole('REGISTRAR');
  verifyOwnPassword(password);
  const student = getStudent(studentId);

  if (student.archivedAt) {
    throw badRequest('This student is already archived.');
  }

  const before = { ...student };
  student.archivedAt = nowIso();
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_ARCHIVED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${student.firstName} ${student.lastName} (${student.studentNumber}) archived.`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}

export function restoreStudent(studentId: string): StudentView {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);

  if (!student.archivedAt) {
    throw badRequest('This student is not archived.');
  }

  const before = { ...student };
  student.archivedAt = null;
  student.updatedAt = nowIso();

  recordAudit({
    action: 'STUDENT_RESTORED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${student.firstName} ${student.lastName} (${student.studentNumber}) restored from the archive.`,
    before,
    after: { ...student },
  });
  return toStudentView(student);
}
