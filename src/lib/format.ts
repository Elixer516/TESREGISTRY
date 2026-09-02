/** Small display helpers with no domain rules attached. */

export function fullName(parts: {
  firstName: string;
  middleName?: string;
  lastName: string;
}): string {
  const middle = parts.middleName?.trim();
  const initial = middle ? ` ${middle.charAt(0).toUpperCase()}.` : '';
  return `${parts.firstName}${initial} ${parts.lastName}`.trim();
}

export function lastFirst(parts: { firstName: string; lastName: string }): string {
  return `${parts.lastName}, ${parts.firstName}`;
}

/**
 * The emergency contact as one readable line, from its three stored parts.
 *
 * Display only — the parts stay separate on the record. Any of them may be
 * blank on an older row, so each is skipped rather than leaving stray commas
 * or double spaces behind.
 */
export function emergencyContactFullName(parts: {
  emergencyContactLastName: string;
  emergencyContactFirstName: string;
  emergencyContactMiddleName: string;
}): string {
  const given = [parts.emergencyContactFirstName, parts.emergencyContactMiddleName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ');
  const last = parts.emergencyContactLastName.trim();
  if (!last) return given;
  return given ? `${last}, ${given}` : last;
}

export function initials(parts: { firstName: string; lastName: string }): string {
  return `${parts.firstName.charAt(0)}${parts.lastName.charAt(0)}`.toUpperCase();
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  // Spelled out rather than abbreviated. These labels are read aloud during
  // demonstrations and by people who do not live in this system all day;
  // "5 mins ago" needs no decoding the way "5m ago" briefly does.
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${pluralize(minutes, 'min')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${pluralize(hours, 'hour')} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${pluralize(days, 'day')} ago`;
  return formatDate(iso);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

/** Split `text` around every case-insensitive occurrence of `query`. */
export function highlightParts(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const needle = query.trim();
  if (!needle) return [{ text, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let index = 0;
  for (;;) {
    const found = lowerText.indexOf(lowerNeedle, index);
    if (found === -1) break;
    if (found > index) parts.push({ text: text.slice(index, found), match: false });
    parts.push({ text: text.slice(found, found + needle.length), match: true });
    index = found + needle.length;
  }
  if (index < text.length) parts.push({ text: text.slice(index), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
