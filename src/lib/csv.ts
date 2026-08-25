/**
 * In-browser CSV parsing for the student import.
 *
 * Handles quoted fields, embedded commas and both newline styles. Column names
 * are resolved through an alias table so a spreadsheet exported as
 * "Student No." lands in the same place as one exported as "student_number".
 */

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseCsv(text: string): ParsedCsv {
  const records = splitRecords(text.replace(/^﻿/, ''));
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i];
    if (cells.every((c) => c.trim() === '')) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitRecords(text: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      current.push(field);
      field = '';
    } else if (char === '\n') {
      current.push(field);
      records.push(current);
      current = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  current.push(field);
  if (current.length > 1 || current[0] !== '') records.push(current);
  return records;
}

/**
 * Accepted header spellings, per canonical field. The four `address*` fields
 * are joined into one address string by the import UI rather than by this
 * module, since the real TESDA trainee-profiling export splits an address
 * across Street/Barangay/Municipality/Province columns.
 */
export const STUDENT_COLUMN_ALIASES: Record<string, string[]> = {
  studentNumber: ['student number', 'student no', 'student no.', 'studentnumber', 'student_number', 'student id', 'id number', 'learner reference number', 'lrn'],
  firstName: ['first name', 'firstname', 'first_name', 'given name', 'givenname'],
  middleName: ['middle name', 'middlename', 'middle_name', 'middle initial'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name', 'family/last name'],
  extensionName: ['extension name', 'suffix', 'name extension', 'ext name'],
  email: ['email', 'email address', 'e-mail', 'emailaddress', 'e-mail address/ facebook account/ twitter/ instagram'],
  contactNumber: ['contact number', 'contact', 'mobile', 'mobile number', 'phone', 'phone number', 'contact_no', 'contact number (landline and/ or cellphone)'],
  addressStreet: ['street', 'street address', 'street no. and  street address', 'street no. and street address'],
  addressBarangay: ['barangay'],
  addressMunicipality: ['municipality/city', 'municipality', 'city'],
  addressProvince: ['province'],
  birthDate: ['date of birth', 'birth date', 'birthdate', 'date of birth (mm-dd-yyyy)', 'dob'],
  yearLevel: ['year level', 'year', 'yearlevel', 'year_level', 'grade level'],
  sex: ['sex', 'gender'],
  civilStatus: ['civil status'],
  nationality: ['nationality'],
  highestEducation: ['highest educational attainment', 'highest education', 'education attainment'],
  classification: ['classification of clients', 'classification'],
  scholarshipType: ['type of scholarships', 'type of scholarship', 'scholarship type', 'scholarship'],
};

/**
 * Student number is deliberately not required — the real TESDA trainee-
 * profiling export has no such column at all; the centre assigns numbers
 * internally, so a blank one is auto-generated on import instead.
 */
export const REQUIRED_IMPORT_FIELDS = ['firstName', 'lastName'] as const;

export interface HeaderMapping {
  /** canonical field → the actual header found in the file */
  resolved: Record<string, string>;
  missingRequired: string[];
  unmatchedHeaders: string[];
}

/**
 * Resolves a file's headers against a canonical-field → accepted-spellings
 * table. Generic across every CSV import in the app — students, faculty and
 * schedules, curricula — each import just brings its own alias table.
 */
export function mapHeaders(
  headers: string[],
  aliasTable: Record<string, string[]>,
  requiredFields: readonly string[],
): HeaderMapping {
  const resolved: Record<string, string> = {};
  const used = new Set<string>();

  for (const [field, aliases] of Object.entries(aliasTable)) {
    const match = headers.find((h) => aliases.includes(normalizeHeader(h)));
    if (match) {
      resolved[field] = match;
      used.add(match);
    }
  }

  const missingRequired = requiredFields.filter((f) => !resolved[f]);
  const unmatchedHeaders = headers.filter((h) => h && !used.has(h));

  return { resolved, missingRequired, unmatchedHeaders };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function readCell(
  row: Record<string, string>,
  mapping: HeaderMapping,
  field: string,
): string {
  const header = mapping.resolved[field];
  if (!header) return '';
  return row[header] ?? '';
}

export const SAMPLE_CSV_TEMPLATE = [
  'Student No.,First Name,Middle Name,Last Name,Email,Contact Number,Date of Birth,Sex,Year Level',
  '2026-01001,Juan,Perez,Dela Rosa,juan.delarosa@trainee.example.ph,0918-555-0101,08-15-2006,MALE,1',
  '2026-01002,Ana,Lopez,Bautista,ana.bautista@trainee.example.ph,0918-555-0102,03-22-2006,FEMALE,1',
].join('\n');

/**
 * Turns whatever date spelling the file used into ISO `yyyy-mm-dd`. Handles
 * `mm-dd-yyyy` / `mm/dd/yyyy` (the TESDA export's format) and passes an
 * already-ISO value straight through. Anything unrecognized is left as-is —
 * the caller decides whether a blank or malformed date is acceptable.
 */
export function parseFlexibleDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return trimmed;
}
