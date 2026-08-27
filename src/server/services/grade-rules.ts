/**
 * Grading rules. Pure functions — no store access, so the seed and the
 * services can both rely on them without a circular import.
 *
 * Scale: 1.00 (highest) … 5.00 (lowest). 3.00 is the passing cutoff.
 * `INC` is a valid grade meaning the requirements were not completed.
 */

import type { GradeStatus } from '@/types';

export const PASSING_CUTOFF = 3.0;
export const HIGHEST_GRADE = 1.0;
export const LOWEST_GRADE = 5.0;
export const INC = 'INC';

/* ---------------------------------------------------------------- */
/* Percentage ↔ 1.00–5.00                                            */
/* ---------------------------------------------------------------- */

/**
 * The transmutation table.
 *
 * Trainers grade in percentages — that is what the centre's own grading sheet
 * instructs — while transcripts and the GSA are expressed on the 1.00–5.00
 * scale. Both are kept: the percentage is what the trainer actually entered,
 * and the equivalent below is computed once, when a grading sheet is
 * approved, and then frozen.
 *
 * Freezing is the point. Re-deriving on every read would mean that editing
 * this table silently rewrote grades already issued on a transcript.
 *
 * One table, one place. If the centre's own bands differ, this is the only
 * thing that changes.
 */
export const TRANSMUTATION_TABLE: ReadonlyArray<{ min: number; max: number; grade: string }> = [
  { min: 98, max: 100, grade: '1.00' },
  { min: 95, max: 97, grade: '1.25' },
  { min: 92, max: 94, grade: '1.50' },
  { min: 89, max: 91, grade: '1.75' },
  { min: 86, max: 88, grade: '2.00' },
  { min: 83, max: 85, grade: '2.25' },
  { min: 80, max: 82, grade: '2.50' },
  { min: 77, max: 79, grade: '2.75' },
  { min: 75, max: 76, grade: '3.00' },
];

/** Anything below the lowest band fails outright. */
export const FAILING_GRADE = '5.00';

/** The percentage at or above which a trainee passes. */
export const PASSING_PERCENTAGE = 75;

export interface PercentageParseResult {
  ok: boolean;
  value: number | null;
  message: string;
}

/**
 * Validate a percentage as the trainer typed it.
 *
 * Whole numbers and one decimal place are both accepted, since a computed
 * class average rarely lands on an integer. Out-of-range values are refused
 * rather than clamped — 105 is a typo, not a perfect score.
 */
export function parsePercentage(input: string | null | undefined): PercentageParseResult {
  const raw = (input ?? '').trim().replace(/%$/, '');
  if (!raw) return { ok: true, value: null, message: '' };

  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) {
    return {
      ok: false,
      value: null,
      message: `"${input}" is not a percentage. Enter a number from 0 to 100.`,
    };
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return { ok: false, value: null, message: `${raw} is outside the 0–100 range.` };
  }
  return { ok: true, value: numeric, message: '' };
}

/** The 1.00–5.00 equivalent of a percentage, by the table above. */
export function transmute(percentage: number): string {
  const band = TRANSMUTATION_TABLE.find(
    (b) => percentage >= b.min && percentage <= b.max,
  );
  if (band) return band.grade;
  // Above the top band can only mean a rounded 100+; treat it as highest.
  if (percentage > 100) return '1.00';
  return FAILING_GRADE;
}

export function isPassingPercentage(percentage: number): boolean {
  return percentage >= PASSING_PERCENTAGE;
}

export interface GradeParseResult {
  ok: boolean;
  /** Normalised value: two decimals, or the literal 'INC'. */
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
      message: `"${raw}" is not a valid grade. Enter a number from 1.00 to 5.00, or INC.`,
    };
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return { ok: false, value: null, message: `"${raw}" is not a valid grade.` };
  }

  if (numeric < HIGHEST_GRADE || numeric > LOWEST_GRADE) {
    return {
      ok: false,
      value: null,
      message: `Grade ${raw} is outside the 1.00–5.00 scale.`,
    };
  }

  return { ok: true, value: numeric.toFixed(2), message: '' };
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
  return isPassing(finalGrade) ? 'PASSED' : 'FAILED';
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
    return completionGrade ? `INC completed (${completionGrade})` : 'Incomplete';
  }
  return isPassing(finalGrade) ? 'Passed' : 'Failed';
}
