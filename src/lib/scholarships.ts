/**
 * Scholarships, and what each one decides about a term's grades.
 *
 * Recorded per enrolment rather than once per trainee, because funding can
 * change between terms — a trainee may start as a regular slot and be taken
 * on by TWSP the next semester.
 *
 * Every scholarship grades on the same scale: the trainer enters a
 * percentage and it becomes a 1.00–5.00 grade. What differs is how the
 * result is worded. Qualification-based programmes (TWSP, STEP) report in
 * TESDA's competency terms — COMPETENT or NOT YET COMPETENT — beside the
 * grade, because that is what their funder reads. The rest report PASSED or
 * FAILED as the diploma always has.
 *
 * To change how a scholarship is graded, change its row here; the Grade
 * Evaluation Form, the grading sheets and the trainee portal all read it.
 */

import type { ScholarshipCode } from '@/types';

export type RemarksStyle = 'PASSED_FAILED' | 'COMPETENCY';

export interface ScholarshipSpec {
  code: ScholarshipCode;
  /** Short name, as the forms print it. */
  label: string;
  name: string;
  remarksStyle: RemarksStyle;
  /** One line on the grading structure, shown where the scholarship is chosen. */
  grading: string;
}

export const SCHOLARSHIPS: readonly ScholarshipSpec[] = [
  {
    code: 'REGULAR',
    label: 'Regular',
    name: 'Regular (no scholarship)',
    remarksStyle: 'PASSED_FAILED',
    grading: 'Percentage → 1.00–5.00, remarks PASSED / FAILED.',
  },
  {
    code: 'TWSP',
    label: 'TWSP',
    name: 'Training for Work Scholarship Program',
    remarksStyle: 'COMPETENCY',
    grading: 'Percentage → 1.00–5.00, remarks COMPETENT / NOT YET COMPETENT.',
  },
  {
    code: 'STEP',
    label: 'STEP',
    name: 'Special Training for Employment Program',
    remarksStyle: 'COMPETENCY',
    grading: 'Percentage → 1.00–5.00, remarks COMPETENT / NOT YET COMPETENT.',
  },
  {
    code: 'BPMSP',
    label: 'BPMSP',
    name: 'BPMSP scholarship',
    remarksStyle: 'PASSED_FAILED',
    grading: 'Percentage → 1.00–5.00, remarks PASSED / FAILED.',
  },
  {
    code: 'PESFA',
    label: 'PESFA',
    name: 'Private Education Student Financial Assistance',
    remarksStyle: 'PASSED_FAILED',
    grading: 'Percentage → 1.00–5.00, remarks PASSED / FAILED.',
  },
  {
    code: 'UAQTEA',
    label: 'UAQTEA',
    name: 'Universal Access to Quality Tertiary Education Act (free tuition)',
    remarksStyle: 'PASSED_FAILED',
    grading: 'Percentage → 1.00–5.00, remarks PASSED / FAILED.',
  },
  {
    code: 'OTHER',
    label: 'Other',
    name: 'Other scholarship or sponsor',
    remarksStyle: 'PASSED_FAILED',
    grading: 'Percentage → 1.00–5.00, remarks PASSED / FAILED.',
  },
];

export const ALL_SCHOLARSHIP_CODES = SCHOLARSHIPS.map((s) => s.code);

export function scholarshipSpec(code: ScholarshipCode | null | undefined): ScholarshipSpec {
  return SCHOLARSHIPS.find((s) => s.code === code) ?? SCHOLARSHIPS[0];
}

/**
 * Reads what an applicant or an older record typed into the free-text
 * scholarship field, so enrolment can start from it.
 */
export function scholarshipFromText(text: string): ScholarshipCode {
  const upper = text.trim().toUpperCase();
  if (!upper) return 'REGULAR';
  for (const spec of SCHOLARSHIPS) {
    if (spec.code !== 'REGULAR' && spec.code !== 'OTHER' && upper.includes(spec.code)) return spec.code;
  }
  if (/NONE|N\/A|REGULAR|SELF/.test(upper)) return 'REGULAR';
  return 'OTHER';
}

/**
 * The remark a grade carries under a scholarship's grading structure.
 * `passedRemark` is what the diploma's own rules already said.
 */
export function scholarshipRemark(code: ScholarshipCode, passedRemark: string): string {
  if (scholarshipSpec(code).remarksStyle !== 'COMPETENCY') return passedRemark;
  const upper = passedRemark.toUpperCase();
  if (upper.startsWith('PASS')) return 'Competent';
  if (upper.startsWith('FAIL')) return 'Not Yet Competent';
  return passedRemark;
}
