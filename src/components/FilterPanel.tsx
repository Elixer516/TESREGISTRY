import { useEffect, useState } from 'react';
import { classNames } from '@/lib/format';
import { Button } from '@/components/ui';

export interface FilterChip {
  value: string;
  label: string;
  /** Longer wording shown on hover, e.g. a diploma's full name. */
  title?: string;
}

export interface FilterGroup {
  key: string;
  label: string;
  chips: FilterChip[];
}

/** Chosen chip values, by group key. A missing or empty group filters nothing. */
export type FilterSelection = Record<string, string[]>;

export function countSelected(selection: FilterSelection): number {
  return Object.values(selection).reduce((n, values) => n + values.length, 0);
}

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
 * A collapsible panel of chip groups.
 *
 * Choices are staged while the panel is open and take effect on "Apply
 * filters", so a long list does not jump about under the Registrar with every
 * tap. "Clear all" empties the choices and applies at once.
 */
export function FilterPanel({
  groups,
  applied,
  onApply,
  defaultOpen = false,
}: {
  groups: FilterGroup[];
  applied: FilterSelection;
  onApply: (next: FilterSelection) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState<FilterSelection>(applied);

  // Reopening shows what is actually applied, not an abandoned draft.
  useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const appliedCount = countSelected(applied);
  const draftCount = countSelected(draft);
  const pending = JSON.stringify(normalise(draft)) !== JSON.stringify(normalise(applied));
  const visibleGroups = groups.filter((group) => group.chips.length > 0);

  const toggle = (groupKey: string, value: string) =>
    setDraft((current) => {
      const chosen = current[groupKey] ?? [];
      return {
        ...current,
        [groupKey]: chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value],
      };
    });

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <span className="text-sm font-bold uppercase tracking-wide text-ink-900">Filters</span>
        {appliedCount > 0 ? (
          <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
            {appliedCount}
          </span>
        ) : null}
        <span
          aria-hidden
          className={classNames('ml-auto text-ink-500 transition-transform', open ? 'rotate-180' : '')}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="border-t border-line px-5 pb-5 pt-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setDraft({});
                onApply({});
              }}
              disabled={draftCount === 0 && appliedCount === 0}
              className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 disabled:opacity-40"
            >
              <TrashIcon />
              Clear all
            </button>
          </div>

          <div className="space-y-5">
            {visibleGroups.map((group) => (
              <fieldset key={group.key}>
                <legend className="mb-2.5 text-[15px] font-semibold text-ink-900">
                  By {group.label}:
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {group.chips.map((chip) => {
                    const on = (draft[group.key] ?? []).includes(chip.value);
                    return (
                      <button
                        key={chip.value}
                        type="button"
                        title={chip.title}
                        aria-pressed={on}
                        onClick={() => toggle(group.key, chip.value)}
                        className={classNames(
                          'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition-colors',
                          on
                            ? 'border-brand bg-brand font-medium text-white shadow-sm'
                            : 'border-line-strong bg-surface text-ink-900 hover:border-brand hover:text-brand-text',
                        )}
                      >
                        {on ? <span aria-hidden>✓</span> : null}
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                onApply(normalise(draft));
                setOpen(false);
              }}
              disabled={!pending}
            >
              Apply filters
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Drops empty groups so "nothing chosen" compares equal however it was reached. */
function normalise(selection: FilterSelection): FilterSelection {
  return Object.fromEntries(
    Object.entries(selection)
      .filter(([, values]) => values.length > 0)
      .map(([key, values]) => [key, [...values].sort()]),
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
    </svg>
  );
}
