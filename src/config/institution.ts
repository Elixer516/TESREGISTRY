/**
 * Institution + support contact configuration.
 *
 * ⚠ PLACEHOLDERS — every contact detail below is invented for this prototype.
 * Replace each value with the real centre details before any real deployment.
 * This is the single source of truth; nothing else in the app hardcodes them.
 */

export const INSTITUTION = {
  agency: 'Technical Education and Skills Development Authority',
  agencyShort: 'TESDA',
  centre: 'Regional Training Center — KorPhil Davao',
  centreShort: 'RTC KorPhil Davao',
  systemName: 'RegiStream',
  systemTagline: 'Student Records & Registrar System',
  address: 'Barangay Bago Gallera, Talomo District, Davao City, Philippines',
  copyrightHolder: 'TESDA Regional Training Center KorPhil Davao',
  copyrightStartYear: 2024,
} as const;

/** ⚠ PLACEHOLDER SIGNATORIES — not real people. Replace before deployment. */
export const SIGNATORIES = {
  registrarName: 'Maria D. Santos, LPT',
  registrarTitle: 'Registrar II',
  centerAdminName: 'Constantino B. Panes, Jr., Ed.D.',
  centerAdminTitle: 'Center Administrator',
} as const;

/** ⚠ PLACEHOLDER CONTACTS — not real. Replace before deployment. */
export const IT_SUPPORT = {
  isPlaceholder: true,
  email: 'itsupport@rtc-korphil.example.ph',
  hotline: '(082) 000-0000',
  contactNumber: '+63 900 000 0000',
  officeHours: 'Mon–Fri, 8:00 AM – 5:00 PM',
} as const;

export const CONFIDENTIALITY_NOTICE =
  'All records displayed in this system are confidential and protected under the Data Privacy Act of 2012 (RA 10173). Unauthorized access, disclosure, or reproduction is prohibited.';

export function copyrightLine(): string {
  const now = new Date().getFullYear();
  const start = INSTITUTION.copyrightStartYear;
  const span = now > start ? `${start}–${now}` : `${start}`;
  return `© ${span} ${INSTITUTION.copyrightHolder}. All rights reserved.`;
}
