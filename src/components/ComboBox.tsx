import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput } from '@/components/ui';
import { classNames } from '@/lib/format';

export interface ComboOption {
  /** What the list shows, e.g. "Panacan · Davao City". */
  label: string;
  /** Handed back when the option is picked. */
  key: string;
}

/** How many matches the list draws at once; typing narrows the rest. */
const SHOWN = 80;

/**
 * A text box with our own suggestion list beneath it, drawn like the other
 * dropdowns: white, the chosen row in the brand blue. The browser's built-in
 * suggestion list (a datalist) cannot be styled and shows black in Chrome,
 * which is why this exists.
 *
 * Typing is never blocked: whatever is typed stays, and picking a suggestion
 * calls `onPick` instead.
 */
export function ComboBox({
  id,
  value,
  options,
  onType,
  onPick,
  disabled,
}: {
  id: string;
  value: string;
  options: readonly ComboOption[];
  onType: (next: string) => void;
  onPick: (option: ComboOption) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return options.slice(0, SHOWN);
    const starts = options.filter((o) => o.label.toLowerCase().startsWith(needle));
    const contains = options.filter(
      (o) => !o.label.toLowerCase().startsWith(needle) && o.label.toLowerCase().includes(needle),
    );
    return [...starts, ...contains].slice(0, SHOWN);
  }, [options, value]);

  useEffect(() => setActive(0), [value, options]);
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (option: ComboOption) => {
    onPick(option);
    setOpen(false);
  };
  const showList = open && matches.length > 0 && !disabled;

  return (
    <div className="relative">
      <TextInput
        id={id}
        value={value}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          onType(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && showList) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="pr-8"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500"
      >
        ▾
      </span>
      {showList ? (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-line-strong bg-surface py-1 text-sm shadow-lg"
        >
          {matches.map((option, i) => (
            <li
              key={option.key}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: it lands before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={classNames(
                'cursor-pointer px-3 py-1.5',
                // The same blue the browser gives a highlighted <select> option.
                i === active ? 'bg-[#1a6fd6] text-white' : 'text-ink-900',
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
