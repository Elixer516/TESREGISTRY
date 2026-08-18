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

/** Accepted header spellings, per canonical field. */
export const STUDENT_COLUMN_ALIASES: Record<string, string[]> = {
  studentNumber: ['student number', 'student no', 'student no.', 'studentnumber', 'student_number', 'student id', 'id number', 'learner reference number', 'lrn'],
  firstName: ['first name', 'firstname', 'first_name', 'given name', 'givenname'],
  middleName: ['middle name', 'middlename', 'middle_name', 'middle initial'],
  lastName: ['last name', 'lastname', 'last_name', 'surname', 'family name'],
  email: ['email', 'email address', 'e-mail', 'emailaddress'],
  contactNumber: ['contact number', 'contact', 'mobile', 'mobile number', 'phone', 'phone number', 'contact_no'],
  programCode: ['program', 'program code', 'course', 'course code', 'qualification', 'programcode'],
  yearLevel: ['year level', 'year', 'yearlevel', 'year_level', 'grade level'],
  sex: ['sex', 'gender'],
};

export const REQUIRED_IMPORT_FIELDS = [
  'studentNumber',
  'firstName',
  'lastName',
  'programCode',
] as const;

export interface HeaderMapping {
  /** canonical field → the actual header found in the file */
  resolved: Record<string, string>;
  missingRequired: string[];
  unmatchedHeaders: string[];
}

export function mapHeaders(headers: string[]): HeaderMapping {
  const resolved: Record<string, string> = {};
  const used = new Set<string>();

  for (const [field, aliases] of Object.entries(STUDENT_COLUMN_ALIASES)) {
    const match = headers.find((h) => aliases.includes(normalizeHeader(h)));
    if (match) {
      resolved[field] = match;
      used.add(match);
    }
  }

  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((f) => !resolved[f]);
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
  'Student No.,First Name,Middle Name,Last Name,Email,Contact Number,Program,Year Level,Sex',
  '2026-01001,Juan,Perez,Dela Rosa,juan.delarosa@trainee.example.ph,0918-555-0101,BSCS,1,MALE',
  '2026-01002,Ana,Lopez,Bautista,ana.bautista@trainee.example.ph,0918-555-0102,CSS,1,FEMALE',
].join('\n');
