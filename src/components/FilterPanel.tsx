import { useState } from 'react';
import { classNames } from '@/lib/format';

export interface FilterChip {
  value: string;
  label: string;
  /** Longer wording shown on hover. */
  title?: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  chips: FilterChip[];
}

/** Chosen chip values, by group key. A missing or empty group filters nothing. */
export type FilterSelection = Record<string, string[]>;

/**
 * True when a row passes every group that has a choice in it: any chip
 * within a group, every group across them.
 */
export function matchesSelection(
  selection: FilterSelection,
  valuesOf: (groupKey: string) => string | string[] | null | undefined,
): boolean {
  return Object.entries(selection).every(([key, chosen]) => {
    if (!chosen.length) return true;
    const own = valuesOf(key);
    const list = Array.isArray(own) ? own : own == null ? [] : [own];
    return list.some((value) => chosen.includes(value));
  });
}

/**
 * A compact panel of chip groups, one row per group with its label on the
 * left. A tap applies at once — the lists it filters are small enough that
 * an Apply step would only be one more click.
 */
export function FilterPanel({
  groups,
  value,
  onChange,
}: {
  groups: FilterGroup[];
  value: FilterSelection;
  onChange: (next: FilterSelection) => void;
}) {
  const [open, setOpen] = useState(true);
  const visibleGroups = groups.filter((group) => group.chips.length > 0);
  const shownKeys = new Set(visibleGroups.map((g) => g.key));
  const count = Object.entries(value)
    .filter(([key]) => shownKeys.has(key))
    .reduce((n, [, values]) => n + values.length, 0);

  const toggle = (groupKey: string, chip: string) => {
    const chosen = value[groupKey] ?? [];
    onChange({
      ...value,
      [groupKey]: chosen.includes(chip) ? chosen.filter((v) => v !== chip) : [...chosen, chip],
    });
  };

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-900"
        >
          Filters
          {count > 0 ? (
            <span className="rounded-full bg-brand px-1.5 py-px text-[10px] font-bold text-white">{count}</span>
          ) : null}
          <span aria-hidden className={classNames('text-ink-500 transition-transform', open ? 'rotate-180' : '')}>
            ▾
          </span>
        </button>
        {count > 0 ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className="ml-auto inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900"
          >
            <TrashIcon />
            Clear all
          </button>
        ) : null}
      </div>

      {open ? (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-line pt-2.5 sm:grid-cols-[7.5rem_1fr]">
          {visibleGroups.map((group) => (
            <div key={group.key} className="contents">
              <dt className="pt-1 text-xs font-semibold text-ink-500">By {group.label}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {group.chips.map((chip) => {
                  const on = (value[group.key] ?? []).includes(chip.value);
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      title={chip.title}
                      aria-pressed={on}
                      onClick={() => toggle(group.key, chip.value)}
                      className={classNames(
                        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors',
                        on
                          ? 'border-brand bg-brand font-medium text-white'
                          : 'border-line-strong bg-surface text-ink-900 hover:border-brand hover:text-brand-text',
                      )}
                    >
                      {on ? <span aria-hidden>✓</span> : null}
                      {chip.label}
                    </button>
                  );
                })}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
    </svg>
  );
}
