/**
 * Pure primitives for day patterns and clock times.
 *
 * Shared by the simulated backend (which enforces the conflict rules) and the
 * UI (which renders them). No rules live here — only parsing and formatting.
 */

import type { DayCode } from '@/types';
import { ALL_DAYS, DAY_SHORT_LABELS } from '@/types';

/**
 * Parse a compact day pattern into canonical day codes.
 *
 * Two-letter codes are matched FIRST so `TTh` reads as Tuesday + Thursday and
 * never as T + T + h. Accepts separators (`MWF`, `M/W/F`, `M W F`, `M,W,F`).
 * Unknown characters are ignored rather than throwing — the caller checks that
 * the result is non-empty.
 */
export function parseDayPattern(pattern: string): DayCode[] {
  const source = pattern.replace(/[^A-Za-z]/g, '');
  const out: DayCode[] = [];
  let i = 0;
  while (i < source.length) {
    const two = source.slice(i, i + 2);
    const twoNorm = two.charAt(0).toUpperCase() + two.charAt(1)?.toLowerCase();
    if (twoNorm === 'Th' || twoNorm === 'Su') {
      pushUnique(out, twoNorm as DayCode);
      i += 2;
      continue;
    }
    const one = source.charAt(i).toUpperCase();
    if (one === 'M' || one === 'T' || one === 'W' || one === 'F' || one === 'S') {
      pushUnique(out, one as DayCode);
    }
    i += 1;
  }
  return sortDays(out);
}

function pushUnique(list: DayCode[], day: DayCode): void {
  if (!list.includes(day)) list.push(day);
}

export function sortDays(days: DayCode[]): DayCode[] {
  return [...days].sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
}

/** Render canonical day codes back into a compact pattern, e.g. ['T','Th'] → 'TTh'. */
export function formatDayPattern(days: DayCode[]): string {
  return sortDays(days).join('');
}

export function formatDayList(days: DayCode[]): string {
  return sortDays(days)
    .map((d) => DAY_SHORT_LABELS[d])
    .join(', ');
}

/**
 * Normalise a clock time to `HH:MM` (24-hour). Accepts `9:00`, `09:00`,
 * `9:00 AM`, `1:30pm`, `0900`. Returns null when it cannot be read.
 */
export function normalizeTime(input: string): string | null {
  const raw = input.trim().toUpperCase();
  if (!raw) return null;

  const meridiem = raw.endsWith('AM') ? 'AM' : raw.endsWith('PM') ? 'PM' : null;
  const digits = raw.replace(/[APM\s.]/g, '');

  let hours: number;
  let minutes: number;

  if (digits.includes(':')) {
    const [h, m] = digits.split(':');
    hours = Number(h);
    minutes = Number(m);
  } else if (digits.length === 4) {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  } else if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else {
    return null;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** Half-open overlap: 09:00–11:00 and 11:00–13:00 do NOT overlap. */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const a1 = timeToMinutes(aStart);
  const a2 = timeToMinutes(aEnd);
  const b1 = timeToMinutes(bStart);
  const b2 = timeToMinutes(bEnd);
  return a1 < b2 && b1 < a2;
}

export function formatTime12h(hhmm: string): string {
  const [hStr, m] = hhmm.split(':');
  const h = Number(hStr);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${m} ${meridiem}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime12h(start)} – ${formatTime12h(end)}`;
}

const NON_ROOM_TOKENS = ['tba', 'tbd', 'n/a', 'na', 'none', '-', '--'];

/**
 * A room is an *exclusive resource* only when it names a real place.
 * `TBA`, `TBD` and blanks are placeholders, so they never collide.
 */
export function isRealRoom(room: string): boolean {
  const value = room.trim().toLowerCase();
  if (!value) return false;
  return !NON_ROOM_TOKENS.includes(value);
}

export function sameRoom(a: string, b: string): boolean {
  if (!isRealRoom(a) || !isRealRoom(b)) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function daysIntersect(a: DayCode[], b: DayCode[]): DayCode[] {
  return a.filter((d) => b.includes(d));
}
