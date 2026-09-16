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
 * The adjectival wording is **KorPhil's own**, taken from the legend printed
 * on their Diploma Grade Evaluation, and it differs from the circular's
 * sample for four grades: the circular calls 2.25 and 2.50 "Satisfactory" and
 * 2.75 and 3.00 "Pass", where the centre prints "Good Work", "Satisfactory
 * Work", "Moderately Satisfactory Work" and "Passing". The circular offers a
 * sample; the centre's form is what its trainees are handed, so the centre's
 * wording wins. The percentage bands are identical in both.
 *
 * Note the deliberate gap between 3.00 and 4.00: the circular defines no
 * 3.25, 3.50 or 3.75. A grade either reaches the passing mark or it does
 * not, and the space in between is not a grade anyone may award.
 */
export interface GradePoint {
  /** The grade point as stored and printed — always two decimals. */
  value: string;
  /** Percentage band as the centre prints it, e.g. "87-89%". */
  percentage: string;
  /** Lowest percentage that earns this grade point. */
  minPercentage: number;
  /** Letter equivalent. Reference only. Blank where the circular gives none. */
  letter: string;
  /** The adjectival description the centre pairs with this grade point. */
  descriptor: string;
}

export const GRADE_POINTS: readonly GradePoint[] = [
  { value: '1.00', percentage: '99-100%', minPercentage: 99, letter: 'A+', descriptor: 'Excellent' },
  { value: '1.25', percentage: '96-98%', minPercentage: 96, letter: 'A', descriptor: 'Very Good' },
  { value: '1.50', percentage: '93-95%', minPercentage: 93, letter: 'A-', descriptor: 'Very Good' },
  { value: '1.75', percentage: '90-92%', minPercentage: 90, letter: 'B+', descriptor: 'Good' },
  { value: '2.00', percentage: '87-89%', minPercentage: 87, letter: 'B', descriptor: 'Good' },
  { value: '2.25', percentage: '84-86%', minPercentage: 84, letter: 'B-', descriptor: 'Good Work' },
  { value: '2.50', percentage: '81-83%', minPercentage: 81, letter: 'C+', descriptor: 'Satisfactory Work' },
  { value: '2.75', percentage: '78-80%', minPercentage: 78, letter: 'C', descriptor: 'Moderately Satisfactory Work' },
  { value: '3.00', percentage: '75-77%', minPercentage: 75, letter: 'C-', descriptor: 'Passing' },
  { value: '4.00', percentage: '74% and below', minPercentage: 60, letter: '', descriptor: 'Conditional' },
  { value: '5.00', percentage: 'below 60%', minPercentage: 0, letter: 'F', descriptor: 'Failed' },
];

/**
 * The percentage band a grade point stands for, as KorPhil's own Diploma
 * Grade Evaluation prints it beside the grade.
 *
 * Reference only, and deliberately never stored: a percentage is derived from
 * the grade, never the other way round. V9 removed the transmutation step so
 * that what a trainer typed is what the transcript shows, and nothing here
 * reopens that door.
 */
export interface PercentageParseResult {
  ok: boolean;
  /** The percentage as a whole number, or null when blank. */
  value: number | null;
  /** The grade point it transmutes to. Null when the percentage is blank. */
  grade: string | null;
  message: string;
}

/**
 * The percentage a trainer enters, and the grade point it becomes.
 *
 * KorPhil's trainers compute a percentage; the grade point on the transcript
 * is its transmutation, and the bands come from TESDA Circular 021 s. 2023 by
 * way of the centre's own Diploma Grade Evaluation legend.
 *
 * The direction matters. The percentage is what is entered and stored, and
 * the grade is derived from it every time it is needed — never the reverse,
 * and never both stored as independent values that could drift apart. That
 * was the failure V9 was reacting to when it removed percentages altogether:
 * a figure transmuted twice, or edited on one side only, stops agreeing with
 * itself. One direction, one source.
 *
 * The two lowest bands need care. The circular gives 4.00 as "74% and below"
 * and 5.00 as "below 60%", which overlap as printed. Read together the only
 * consistent meaning is 60-74 Conditional, under 60 Failed.
 */
export function gradeForPercentage(percentage: number): string {
  for (const point of GRADE_POINTS) {
    if (percentage >= point.minPercentage) return point.value;
  }
  return LOWEST_GRADE.toFixed(2);
}

/** Validate and transmute a percentage as typed on a grading sheet. */
export function parsePercentage(input: string | null | undefined): PercentageParseResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: true, value: null, grade: null, message: '' };

  if (!/^\d{1,3}(\.\d+)?$/.test(raw)) {
    return {
      ok: false,
      value: null,
      grade: null,
      message: `"${raw}" is not a percentage. Enter a number from 0 to 100.`,
    };
  }

  const numeric = Math.round(Number(raw));
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return {
      ok: false,
      value: null,
      grade: null,
      message: `${raw} is outside 0 to 100.`,
    };
  }

  return { ok: true, value: numeric, grade: gradeForPercentage(numeric), message: '' };
}

export function percentageFor(grade: string | null): string {
  if (grade === null || grade === INC) return '';
  return GRADE_POINTS.find((g) => g.value === grade)?.percentage ?? '';
}

/** Every grade point a trainer may award, in the circular's order. */
export const ALLOWED_GRADES: readonly string[] = GRADE_POINTS.map((g) => g.value);

/**
 * 4.00 — "Conditional" in the circular. Not a pass, but not a failure
 * either: the requirement stands unmet pending whatever removal the centre
 * allows. The circular defines the grade, not the removal process, so this
 * system records it and leaves the process to the registrar.
 */
export const CONDITIONAL_GRADE = '4.00';

/** Marker values a grade cell may carry instead of a number. */
export const DROPPED = 'DRP';
export const CREDITED = 'CRD';

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

/**
 * The Remarks column on the centre's Diploma Grade Evaluation.
 *
 * It carries the **outcome** — Passed, Failed, Incomplete, Credited — not the
 * adjectival description of the grade. The two were conflated here for a
 * while: "Good Work" was printed where the centre's own form says "PASSED".
 * The descriptions belong to the grading legend at the foot of the form,
 * where they explain what a grade point means; the Remarks column answers a
 * different question, which is what happened to the subject.
 */
export function gradeRemarks(
  finalGrade: string | null,
  completionGrade: string | null,
): string {
  if (finalGrade === null) return '';
  if (finalGrade === CREDITED) return 'Credited';
  if (finalGrade === DROPPED) return 'Dropped';
  if (finalGrade === INC) {
    return completionGrade ? `Completed (${completionGrade})` : 'Incomplete';
  }
  if (finalGrade === CONDITIONAL_GRADE) return 'Conditional';
  return isPassing(finalGrade) ? 'Passed' : 'Failed';
}
