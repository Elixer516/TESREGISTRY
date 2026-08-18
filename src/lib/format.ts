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
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
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
