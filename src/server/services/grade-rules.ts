/**
 * Grading rules. Pure functions — no store access, so the seed and the
 * services can both rely on them without a circular import.
 *
 * Scale: 1.00 (highest) … 5.00 (lowest). 3.00 is the passing cutoff, and is
 * the 75% equivalent. `INC` is a valid grade meaning the requirements were
 * not completed.
 *
 * V9 removed the percentage layer entirely. Trainers enter 1.00, 2.25, INC —
 * the scale the transcript is expressed in — rather than a percentage that
 * had to be transmuted on the way in. One representation, so nothing can be
 * transmuted twice or drift from what was actually typed.
 */

import type { GradeStatus } from '@/types';

/**
 * The official scale, from TESDA Circular No. 021 s. 2023, Annex 2, Table 1
 * ("Sample Grading Equivalence"), which governs PQF Level 5 (Diploma)
 * programs from AY 2023-2024.
 *
 * The grade point column is the one this system stores and prints. The
 * percentage and letter columns are carried here for reference only — the
 * circular presents them as variations an institution *may* adopt "apart
 * from the grade point system", not as values to be recorded alongside it.
 * Keeping them as data rather than as a second stored field is what stops a
 * grade being transmuted twice.
 *
 * Note the deliberate gap between 3.00 and 4.00: the circular defines no
 * 3.25, 3.50 or 3.75. A grade either reaches the passing mark or it does
 * not, and the space in between is not a grade anyone may award.
 */
export interface GradePoint {
  /** The grade point as stored and printed — always two decimals. */
  value: string;
  /** Percentage equivalent. Reference only; never entered, never computed. */
  percentage: string;
  /** Letter equivalent. Reference only. Blank where the circular gives none. */
  letter: string;
  /** The adjectival description the circular pairs with this grade point. */
  descriptor: string;
}

export const GRADE_POINTS: readonly GradePoint[] = [
  { value: '1.00', percentage: '99 – 100%', letter: 'A+', descriptor: 'Excellent' },
  { value: '1.25', percentage: '96 – 98%', letter: 'A', descriptor: 'Very Good' },
  { value: '1.50', percentage: '93 – 95%', letter: 'A-', descriptor: 'Very Good' },
  { value: '1.75', percentage: '90 – 92%', letter: 'B+', descriptor: 'Good' },
  { value: '2.00', percentage: '87 – 89%', letter: 'B', descriptor: 'Good' },
  { value: '2.25', percentage: '84 – 86%', letter: 'B-', descriptor: 'Satisfactory' },
  { value: '2.50', percentage: '81 – 83%', letter: 'C+', descriptor: 'Satisfactory' },
  { value: '2.75', percentage: '78 – 80%', letter: 'C', descriptor: 'Pass' },
  { value: '3.00', percentage: '75 – 77%', letter: 'C-', descriptor: 'Pass' },
  { value: '4.00', percentage: '74% and below', letter: '', descriptor: 'Conditional' },
  { value: '5.00', percentage: 'Below 60%', letter: 'F', descriptor: 'Fail' },
];

/** Every grade point a trainer may award, in the circular's order. */
export const ALLOWED_GRADES: readonly string[] = GRADE_POINTS.map((g) => g.value);

/**
 * 4.00 — "Conditional" in the circular. Not a pass, but not a failure
 * either: the requirement stands unmet pending whatever removal the centre
 * allows. The circular defines the grade, not the removal process, so this
 * system records it and leaves the process to the registrar.
 */
export const CONDITIONAL_GRADE = '4.00';

export const PASSING_CUTOFF = 3.0;
export const HIGHEST_GRADE = 1.0;
export const LOWEST_GRADE = 5.0;
export const INC = 'INC';

export interface GradeParseResult {
  ok: boolean;
  /** The normalised grade — "1.75", "INC" — or null when blank. */
  value: string | null;
  message: string;
}

/**
 * Validate and normalise a grade entry.
 * Accepts `INC` (any case) or a number between 1.00 and 5.00 inclusive.
 * Everything else is rejected — `9.99` does not become `5.00`.
 */
export function parseGrade(input: string | null | undefined): GradeParseResult {
  const raw = (input ?? '').trim();

  if (!raw) {
    return { ok: true, value: null, message: '' };
  }

  if (raw.toUpperCase() === INC) {
    return { ok: true, value: INC, message: '' };
  }

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return {
      ok: false,
      value: null,
      message: `"${raw}" is not a valid grade. Enter one of ${ALLOWED_GRADES.join(', ')}, or INC.`,
    };
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return { ok: false, value: null, message: `"${raw}" is not a valid grade.` };
  }

  // Membership, not a range. `3.50` sits inside 1.00–5.00 and is still not a
  // grade the circular lets anyone award.
  const normalised = numeric.toFixed(2);
  if (!ALLOWED_GRADES.includes(normalised)) {
    return {
      ok: false,
      value: null,
      message: `Grade ${raw} is not on the TESDA scale. Enter one of ${ALLOWED_GRADES.join(', ')}, or INC.`,
    };
  }

  return { ok: true, value: normalised, message: '' };
}

export function isNumericGrade(grade: string | null): boolean {
  return grade !== null && grade !== INC && /^\d+(\.\d+)?$/.test(grade);
}

export function isPassing(grade: string | null): boolean {
  if (!isNumericGrade(grade)) return false;
  return Number(grade) <= PASSING_CUTOFF;
}

/** Derive the grade status from the stored grade pair. Never stored by hand. */
export function deriveGradeStatus(
  finalGrade: string | null,
  completionGrade: string | null,
): GradeStatus {
  if (finalGrade === null) return 'ENROLLED_NOT_GRADED';
  if (finalGrade === INC) {
    return completionGrade ? 'INC_RESOLVED' : 'INC_PENDING';
  }
  // 4.00 is not 5.00. The circular gives it its own adjectival description,
  // so reporting it as a failure would misstate the trainee's standing.
  if (finalGrade === CONDITIONAL_GRADE) return 'CONDITIONAL';
  return isPassing(finalGrade) ? 'PASSED' : 'FAILED';
}

/**
 * The adjectival description the circular pairs with a grade point, for the
 * places a transcript reads better in words than in numbers.
 */
export function gradeDescriptor(grade: string | null): string {
  if (grade === null) return '';
  if (grade === INC) return 'Incomplete';
  return GRADE_POINTS.find((g) => g.value === grade)?.descriptor ?? '';
}

/**
 * The grade that counts towards the average: a completed INC contributes its
 * completion grade, everything else contributes its final grade.
 */
export function effectiveGrade(
  finalGrade: string | null,
  completionGrade: string | null,
): string | null {
  if (finalGrade === INC) return completionGrade;
  return finalGrade;
}

export interface GwaInput {
  units: number;
  finalGrade: string | null;
  completionGrade: string | null;
}

export interface GwaResult {
  /** Three-decimal string. `0.000` when an unresolved INC is present. */
  gwa: string;
  totalUnits: number;
  hasUnresolvedInc: boolean;
  countedUnits: number;
}

/**
 * Unit-weighted general weighted average.
 *
 * An unresolved INC forces the result to `0.000`. That is a deliberate signal
 * that the average cannot be trusted yet — not a computation bug.
 */
export function computeGwa(rows: GwaInput[]): GwaResult {
  const totalUnits = rows.reduce((sum, r) => sum + r.units, 0);
  const hasUnresolvedInc = rows.some(
    (r) => r.finalGrade === INC && !r.completionGrade,
  );

  if (hasUnresolvedInc) {
    return { gwa: '0.000', totalUnits, hasUnresolvedInc: true, countedUnits: 0 };
  }

  let weighted = 0;
  let counted = 0;
  for (const row of rows) {
    const grade = effectiveGrade(row.finalGrade, row.completionGrade);
    if (!isNumericGrade(grade)) continue;
    weighted += Number(grade) * row.units;
    counted += row.units;
  }

  if (counted === 0) {
    return { gwa: '0.000', totalUnits, hasUnresolvedInc: false, countedUnits: 0 };
  }

  return {
    gwa: (weighted / counted).toFixed(3),
    totalUnits,
    hasUnresolvedInc: false,
    countedUnits: counted,
  };
}

export function gradeRemarks(
  finalGrade: string | null,
  completionGrade: string | null,
): string {
  if (finalGrade === null) return 'Not yet graded';
  if (finalGrade === INC) {
    return completionGrade
      ? `INC completed (${completionGrade} — ${gradeDescriptor(completionGrade)})`
      : 'Incomplete';
  }
  return gradeDescriptor(finalGrade) || (isPassing(finalGrade) ? 'Passed' : 'Failed');
}
