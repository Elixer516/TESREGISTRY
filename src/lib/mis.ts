/**
 * The MIS report's fixed format: TESDA's trainee profile sheet, column for
 * column as the centre's own workbook (DIPLOMA 2026 MIS) has it. The order
 * and wording are the format — change neither without the Registrar's copy.
 *
 * "Industry Sector of Qualification", "TVET Program Registration Status",
 * "CoPR Number" and "Training Calendar Code" are left blank on purpose, as
 * the centre leaves them.
 */

export const MIS_COLUMNS = [
  'Provider Region',
  'Provider Province',
  'Provider District',
  'Provider Municipality/City',
  'Name of Provider',
  'Complete Address of Provider/Training Venue (For Mobile Training)',
  'Type of Provider',
  'Classification of Provider',
  'Industry Sector of Qualification',
  'TVET Program Registration Status',
  'Qualification/Program Title',
  'CoPR Number (for WTR/NTR)',
  'Training Calendar Code (for TTIs only)',
  'Delivery Mode',
  'Family/Last Name',
  'First Name',
  'Middle Name',
  'Extension Name',
  'Contact Number (landline and/ or cellphone)',
  'E-mail Address/ Facebook Account/ Twitter/ Instagram',
  'Street No. and Street address',
  'Barangay',
  'Municipality/City',
  'District',
  'Province',
  'Sex',
  'Date of Birth (mm-dd-yyyy)',
  'Age',
  'Civil Status',
  'Highest Educational Attainment',
  'Nationality',
  'Classification of Clients',
  'Training Status',
  'Type of Scholarships',
  'Emergency Person',
  'Emergency Contact',
  'Enrollment Date',
  'Other Scholarship Availed',
  'Batch',
] as const;

/** Columns that hold a date (written as mm-dd-yyyy, and as real dates in Excel). */
export const MIS_DATE_COLUMNS: ReadonlySet<number> = new Set([
  MIS_COLUMNS.indexOf('Date of Birth (mm-dd-yyyy)'),
  MIS_COLUMNS.indexOf('Enrollment Date'),
]);

/** The provider's own details, the same on every row — as the centre's workbook has them. */
export const MIS_PROVIDER = {
  region: 'REGION XI',
  province: 'DAVAO CITY',
  district: 'DISTRICT II',
  municipality: 'DAVAO CITY',
  name: 'Regional Training Center - Davao / Korea Philippines Vocational Training Center',
  address: 'Buhisan, Tibungco, Davao City',
  type: 'Public',
  classification: 'TTI (RTC)',
  deliveryMode: 'Institution-Based (IBT)',
} as const;

/** "2008-06-09" → "06-09-2008". Blank stays blank. */
export function misDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[2]}-${m[3]}-${m[1]}` : '';
}
