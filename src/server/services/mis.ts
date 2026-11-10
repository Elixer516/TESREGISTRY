/**
 * The MIS report: every trainee's personal details from registration, in
 * TESDA's trainee profile format (see `@/lib/mis`), one sheet per diploma.
 *
 * It covers the trainees enrolled in the chosen school year, semester and
 * diploma — or, when dates are given, everyone who enrolled between them.
 * A trainee appears once per diploma, dated by their first enrolment in scope.
 */

import type { ReportFilters, MisReport, MisSheet } from '@/types/views';
import { SEMESTER_PERIOD_LABELS } from '@/types';
import { MIS_COLUMNS, MIS_PROVIDER, misDate } from '@/lib/mis';
import { scholarshipSpec } from '@/lib/scholarships';
import { badRequest, notFound } from '@/lib/api-error';
import { db } from '../repositories/db';
import { requireRole } from '../auth';
import { batchOfStudent } from '../repositories/lookups';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whole years between a birthdate and a day, both YYYY-MM-DD. */
function ageOn(birth: string, day: string): string {
  if (!DAY.test(birth.slice(0, 10))) return '';
  const [by, bm, bd] = birth.slice(0, 10).split('-').map(Number);
  const [y, m, d] = day.split('-').map(Number);
  const age = y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
  return age >= 0 ? String(age) : '';
}

const upper = (value: string | null | undefined) => (value ?? '').trim().toUpperCase();

/** "District II (Talomo)" → "DISTRICT II". */
const districtLabel = (value: string) => upper(value.replace(/\s*\(.*\)\s*$/, ''));

export function getMisReport(filters: ReportFilters = {}): MisReport {
  requireRole('REGISTRAR');

  const from = DAY.test(filters.enrolledFrom ?? '') ? filters.enrolledFrom! : '';
  const to = DAY.test(filters.enrolledTo ?? '') ? filters.enrolledTo! : '';
  if (from && to && from > to) throw badRequest('The "from" date comes after the "to" date.');
  const ranged = Boolean(from || to);

  const year = ranged
    ? undefined
    : db.academicYears.find((y) => y.id === filters.academicYearId) ??
      db.academicYears.find((y) => y.isActive) ??
      [...db.academicYears].sort((a, b) => b.label.localeCompare(a.label))[0];
  if (!ranged && !year) throw notFound('That school year could not be found.');
  const program = filters.programId ? db.programs.find((p) => p.id === filters.programId) : undefined;
  if (filters.programId && !program) throw notFound('That diploma could not be found.');

  const semesters = new Map(
    db.semesters
      .filter(
        (s) =>
          (!year || s.academicYearId === year.id) &&
          (!filters.semesterPeriod || s.semesterPeriod === filters.semesterPeriod) &&
          (!program || s.programId === program.id),
      )
      .map((s) => [s.id, s]),
  );

  // The first enrolment in scope for each trainee in each diploma.
  const first = new Map<string, { enrollmentId: string; programId: string; enrolledAt: string }>();
  for (const e of db.enrollments) {
    const semester = semesters.get(e.semesterId);
    if (!semester || e.status === 'DROPPED') continue;
    const day = e.enrolledAt.slice(0, 10);
    if ((from && day < from) || (to && day > to)) continue;
    const key = `${semester.programId}|${e.studentId}`;
    const seen = first.get(key);
    if (!seen || e.enrolledAt < seen.enrolledAt) {
      first.set(key, { enrollmentId: e.id, programId: semester.programId, enrolledAt: e.enrolledAt });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const sheets = new Map<string, MisSheet>();
  for (const [key, hit] of first) {
    const student = db.students.find((s) => s.id === key.split('|')[1]);
    const prog = db.programs.find((p) => p.id === hit.programId);
    const enrollment = db.enrollments.find((e) => e.id === hit.enrollmentId);
    if (!student || !prog || !enrollment) continue;

    const code = enrollment.scholarship ?? 'REGULAR';
    // "Others" keeps the name the Registrar gave it.
    const scholarship =
      code === 'OTHER' ? student.scholarshipType || 'Other' : code === 'REGULAR' ? '' : scholarshipSpec(code).label;
    const emergency = [
      student.emergencyContactFirstName,
      student.emergencyContactMiddleName,
      student.emergencyContactLastName,
    ]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' ');

    const row: string[] = [
      MIS_PROVIDER.region,
      MIS_PROVIDER.province,
      MIS_PROVIDER.district,
      MIS_PROVIDER.municipality,
      MIS_PROVIDER.name,
      MIS_PROVIDER.address,
      MIS_PROVIDER.type,
      MIS_PROVIDER.classification,
      '',
      '',
      prog.name,
      '',
      '',
      MIS_PROVIDER.deliveryMode,
      upper(student.lastName),
      upper(student.firstName),
      upper(student.middleName),
      upper(student.extensionName),
      student.contactNumber,
      student.email || student.socialMediaAccount,
      upper(student.addressStreet),
      upper(student.addressBarangay),
      upper(student.addressCityMunicipality),
      districtLabel(student.addressDistrict),
      upper(student.addressProvince),
      student.sex === 'MALE' ? 'Male' : 'Female',
      misDate(student.birthDate),
      ageOn(student.birthDate, today),
      student.civilStatus,
      student.highestEducation,
      upper(student.nationality),
      student.classification,
      code === 'REGULAR' ? 'Non-Scholar' : 'Scholar',
      scholarship,
      upper(emergency),
      student.emergencyContactNumber,
      misDate(hit.enrolledAt),
      student.otherScholarship ?? '',
      batchOfStudent(student),
    ];
    if (row.length !== MIS_COLUMNS.length) throw new Error('MIS row does not match its columns.');

    let sheet = sheets.get(prog.id);
    if (!sheet) {
      sheet = { programId: prog.id, programCode: prog.code, programName: prog.name, rows: [] };
      sheets.set(prog.id, sheet);
    }
    sheet.rows.push(row);
  }

  const last = MIS_COLUMNS.indexOf('Family/Last Name');
  const firstName = MIS_COLUMNS.indexOf('First Name');
  const ordered = [...sheets.values()].sort((a, b) => a.programCode.localeCompare(b.programCode));
  for (const sheet of ordered) {
    sheet.rows.sort((a, b) => a[last].localeCompare(b[last]) || a[firstName].localeCompare(b[firstName]));
  }

  return {
    schoolYearLabel: year?.label ?? 'All school years',
    dateRangeLabel: ranged ? `Enrolled ${from ? misDate(from) : 'any time'} to ${to ? misDate(to) : 'today'}` : '',
    periodLabel: filters.semesterPeriod ? SEMESTER_PERIOD_LABELS[filters.semesterPeriod] : 'All semesters',
    programLabel: program ? program.name : 'All diplomas',
    columns: [...MIS_COLUMNS],
    sheets: ordered,
    generatedAt: new Date().toISOString(),
  };
}
