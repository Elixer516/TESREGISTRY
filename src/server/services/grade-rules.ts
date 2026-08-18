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
