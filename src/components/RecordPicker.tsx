/**
 * The searchable record picker.
 *
 * Any selector over a dataset that grows — students, faculty, subjects,
 * sections, classes — uses this instead of a `<select>`. A native select over
 * two thousand trainees is unusable; this is searchable, keyboard-driven and
 * shows why each row matched.
 *
 * Keyboard: ↑/↓ move the highlight, Enter selects, Escape closes, Tab is
 * trapped by the Modal, and `aria-activedescendant` follows the highlight so
 * screen readers announce it without moving real focus off the search box.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, TextInput } from './ui';
import { EmptyState, ErrorState, LoadingState } from './states';
import { classNames, highlightParts } from '@/lib/format';

export interface RecordPickerProps<T> {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  items: T[];
  isLoading?: boolean;
  error?: unknown;
  selectedId?: string | null;
  getId: (item: T) => string;
  getPrimary: (item: T) => string;
  getSecondary?: (item: T) => string;
  getTrailing?: (item: T) => ReactNode;
  /** Everything the search box should match against. */
  getSearchText: (item: T) => string;
  isDisabled?: (item: T) => string | null;
  onSelect: (item: T) => void;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyHint?: string;
}

export function RecordPicker<T>({
  open,
  onClose,
  title,
  description,
  items,
  isLoading = false,
  error,
  selectedId,
  getId,
  getPrimary,
  getSecondary,
  getTrailing,
  getSearchText,
  isDisabled,
  onSelect,
  searchPlaceholder = 'Search…',
  emptyTitle = 'No matches',
  emptyHint = 'Try a shorter search term, or clear the box to see everything.',
}: RecordPickerProps<T>) {
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => getSearchText(item).toLowerCase().includes(needle));
  }, [items, query, getSearchText]);

  useEffect(() => {
    setHighlightIndex((current) => (current >= filtered.length ? 0 : current));
  }, [filtered.length]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const option = list.querySelector<HTMLElement>(`[data-index="${highlightIndex}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, filtered.length]);

  const choose = (item: T) => {
    if (isDisabled?.(item)) return;
    onSelect(item);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((current) => (filtered.length === 0 ? 0 : (current + 1) % filtered.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((current) =>
        filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length,
      );
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightIndex(Math.max(0, filtered.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = filtered[highlightIndex];
      if (item) choose(item);
    }
  };

  const activeId = filtered[highlightIndex]
    ? `${listboxId}-option-${getId(filtered[highlightIndex])}`
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      initialFocusRef={inputRef}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-900 hover:bg-surface-2"
        >
          Cancel
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextInput
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={searchPlaceholder}
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
        />

        <p className="text-xs text-ink-500">
          {filtered.length} of {items.length} shown · ↑ ↓ to move, Enter to select, Esc to close
        </p>

        {isLoading ? (
          <LoadingState label="Loading records…" rows={4} />
        ) : error ? (
          <ErrorState error={error} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={items.length === 0 ? 'Nothing to choose from' : emptyTitle}
            hint={
              items.length === 0
                ? 'There are no records of this kind yet. Create one first, then come back.'
                : emptyHint
            }
          />
        ) : (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={title}
            className="max-h-[45vh] overflow-y-auto rounded-lg border border-line"
          >
            {filtered.map((item, index) => {
              const id = getId(item);
              const disabledReason = isDisabled?.(item) ?? null;
              const isSelected = selectedId === id;
              const isHighlighted = index === highlightIndex;
              const secondary = getSecondary?.(item);

              return (
                <li
                  key={id}
                  id={`${listboxId}-option-${id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={Boolean(disabledReason)}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => choose(item)}
                  className={classNames(
                    'flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0',
                    isHighlighted ? 'bg-surface-2' : 'bg-surface',
                    disabledReason && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <span
                    aria-hidden
                    className={classNames(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      isSelected
                        ? 'bg-brand text-white'
                        : 'border border-line text-transparent',
                    )}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {highlightParts(getPrimary(item), query).map((part, partIndex) =>
                        part.match ? (
                          <mark key={partIndex} className="match-highlight">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={partIndex}>{part.text}</span>
                        ),
                      )}
                    </span>
                    {secondary ? (
                      <span className="mt-0.5 block truncate text-xs text-ink-500">
                        {highlightParts(secondary, query).map((part, partIndex) =>
                          part.match ? (
                            <mark key={partIndex} className="match-highlight">
                              {part.text}
                            </mark>
                          ) : (
                            <span key={partIndex}>{part.text}</span>
                          ),
                        )}
                      </span>
                    ) : null}
                    {disabledReason ? (
                      <span className="mt-0.5 block text-xs font-medium text-danger-ink">
                        {disabledReason}
                      </span>
                    ) : null}
                  </span>
                  {getTrailing ? (
                    <span className="shrink-0 text-xs text-ink-500">{getTrailing(item)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** The button that opens a picker and shows the current choice. */
export function PickerButton({
  label,
  value,
  placeholder = 'Select…',
  onClick,
  onClear,
  disabled,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onClick: () => void;
  onClear?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={classNames(
            'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
            disabled && 'cursor-not-allowed opacity-60 hover:bg-surface',
          )}
        >
          <span className={classNames('truncate', value ? 'text-ink-900' : 'text-ink-400')}>
            {value ?? placeholder}
          </span>
          <span aria-hidden className="shrink-0 text-xs text-ink-400">
            Search ⌕
          </span>
        </button>
        {value && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-line px-2.5 text-sm text-ink-500 hover:bg-surface-2 hover:text-ink-900"
            aria-label={`Clear ${label}`}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  );
}
