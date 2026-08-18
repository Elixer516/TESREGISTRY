/**
 * Student records: applications, approval, rejection, edits and bulk import.
 *
 * Approval is the gate that assigns a curriculum — a student without one
 * cannot be enrolled, so the curriculum is required, not optional.
 */

import type { CsvRowError, Student, StudentStatus } from '@/types';
import { SETTABLE_STATUSES } from '@/types';
import type {
  StudentImportResult,
  StudentImportRow,
  StudentSearchFilters,
  StudentView,
} from '@/types/views';
import { badRequest, duplicate, validationFailed } from '@/lib/api-error';
import { db, nextId, nowIso } from '../repositories/db';
import { getCurriculum, getStudent, toStudentView } from '../repositories/lookups';
import { requireRole } from '../auth';
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
  requireRole('REGISTRAR', 'TRAINING_OFFICER', 'TRAINER', 'IT_ADMIN');

  let rows = [...db.students];

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
  requireRole('REGISTRAR', 'TRAINING_OFFICER', 'TRAINER', 'IT_ADMIN');
  return toStudentView(getStudent(id));
}

export interface StudentInput {
  studentNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  address: string;
  birthDate: string;
  sex: Student['sex'];
  programId: string;
  yearLevel: number;
  isTransferee: boolean;
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

  const student: Student = {
    id: nextId('stu'),
    studentNumber,
    firstName: input.firstName.trim(),
    middleName: input.middleName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    contactNumber: input.contactNumber.trim(),
    address: input.address.trim(),
    birthDate: input.birthDate,
    sex: input.sex,
    programId: input.programId,
    curriculumId: null,
    sectionId: null,
    yearLevel: Math.max(1, Math.round(input.yearLevel)),
    status: 'PENDING',
    isTransferee: input.isTransferee,
    rejectionReason: null,
    approvedAt: null,
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
 * Bulk import. Every row is validated first; a single bad row aborts the whole
 * batch, so a half-imported file can never reach the database.
 */
export function importStudents(rows: StudentImportRow[]): StudentImportResult {
  const actor = requireRole('REGISTRAR');

  if (rows.length === 0) {
    throw badRequest('The file contained no data rows.');
  }

  const errors: CsvRowError[] = [];
  const seenNumbers = new Set<string>();

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

    const programCode = row.programCode?.trim().toUpperCase() ?? '';
    if (!programCode) {
      errors.push({ row: rowNumber, field: 'programCode', message: 'Program code is required.' });
    } else if (!db.programs.some((p) => p.code.toUpperCase() === programCode)) {
      errors.push({
        row: rowNumber,
        field: 'programCode',
        message: `Unknown program code "${programCode}".`,
      });
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

  const created: Student[] = rows.map((row) => {
    const program = db.programs.find(
      (p) => p.code.toUpperCase() === row.programCode.trim().toUpperCase(),
    );
    const student: Student = {
      id: nextId('stu'),
      studentNumber: row.studentNumber.trim(),
      firstName: row.firstName.trim(),
      middleName: row.middleName?.trim() ?? '',
      lastName: row.lastName.trim(),
      email: row.email?.trim() ?? '',
      contactNumber: row.contactNumber?.trim() ?? '',
      address: '',
      birthDate: '',
      sex: row.sex === 'FEMALE' ? 'FEMALE' : 'MALE',
      programId: program?.id ?? '',
      curriculumId: null,
      sectionId: null,
      yearLevel: Number(row.yearLevel) > 0 ? Math.round(Number(row.yearLevel)) : 1,
      status: 'PENDING',
      isTransferee: false,
      rejectionReason: null,
      approvedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    return student;
  });

  db.students.push(...created);

  recordAudit({
    action: 'STUDENT_IMPORTED',
    recordType: 'Student',
    recordId: created.map((s) => s.id).join(','),
    actor,
    detail: `${created.length} student application${created.length === 1 ? '' : 's'} imported from CSV.`,
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
  email?: string;
  contactNumber?: string;
  address?: string;
  birthDate?: string;
  sex?: Student['sex'];
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
  if (input.email !== undefined) student.email = input.email.trim();
  if (input.contactNumber !== undefined) student.contactNumber = input.contactNumber.trim();
  if (input.address !== undefined) student.address = input.address.trim();
  if (input.birthDate !== undefined) student.birthDate = input.birthDate;
  if (input.sex !== undefined) student.sex = input.sex;
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
