import { useId, useLayoutEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react';
import { TextInput } from '@/components/ui';
import { classNames } from '@/lib/format';

const STORAGE_PREFIX = 'registream.autofill.';
const HISTORY_LIMIT = 40;
const LIST_LIMIT = 6;

function readHistory(key: string | undefined): string[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function remember(key: string | undefined, value: string) {
  const text = value.trim();
  if (!key || !text) return;
  try {
    const next = [text, ...readHistory(key).filter((v) => v !== text)].slice(0, HISTORY_LIMIT);
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(next));
  } catch {
    /* storage unavailable: suggestions from the records still work */
  }
}

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'>;

/**
 * A text box that completes what is being typed, the way Excel's AutoComplete
 * does in a column: start typing something entered before and the rest of
 * it appears, selected, so carrying on typing replaces it while Tab, Enter or
 * → keeps it. Backspace takes the suggestion away. A short list of every
 * match drops down too, for picking with the mouse or the arrow keys.
 *
 * Suggestions are whatever the caller passes (values already in the records,
 * such as SO numbers on file) plus what was typed in this field before on
 * this device, remembered under `historyKey`.
 */
export function AutoFillInput({
  value,
  onChange,
  suggestions = [],
  historyKey,
  onBlur,
  onKeyDown,
  className,
  ...rest
}: NativeProps & {
  value: string;
  onChange: (value: string) => void;
  suggestions?: Array<string | null | undefined>;
  historyKey?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [history, setHistory] = useState(() => readHistory(historyKey));
  // After a keystroke that completed the text, select the added part.
  const pendingSelection = useRef<[number, number] | null>(null);

  const pool = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of [...history, ...suggestions]) {
      const text = (v ?? '').trim();
      if (text && !seen.has(text.toLowerCase())) {
        seen.add(text.toLowerCase());
        out.push(text);
      }
    }
    return out;
  }, [history, suggestions]);

  // What was actually typed — the value minus any completion offered after it.
  const [typed, setTyped] = useState(value);
  const matches = useMemo(() => {
    const needle = typed.trim().toLowerCase();
    if (!needle) return [];
    return pool.filter((v) => v.toLowerCase().startsWith(needle) && v.toLowerCase() !== needle).slice(0, LIST_LIMIT);
  }, [pool, typed]);

  useLayoutEffect(() => {
    if (pendingSelection.current && input.current) {
      input.current.setSelectionRange(...pendingSelection.current);
      pendingSelection.current = null;
    }
  });

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    const native = event.nativeEvent as InputEvent;
    const deleting = typeof native.inputType === 'string' && native.inputType.startsWith('delete');
    setHighlight(-1);
    setTyped(next);
    const caretAtEnd = event.target.selectionStart === next.length;
    if (!deleting && caretAtEnd && next.trim()) {
      const match = pool.find((v) => v.toLowerCase().startsWith(next.toLowerCase()) && v.length > next.length);
      if (match) {
        // Keep the letters as typed; complete with the rest of the match.
        const completed = next + match.slice(next.length);
        pendingSelection.current = [next.length, completed.length];
        onChange(completed);
        return;
      }
    }
    onChange(next);
  };

  const accept = (text: string) => {
    onChange(text);
    setTyped(text);
    pendingSelection.current = [text.length, text.length];
    setHighlight(-1);
  };

  const hasCompletion = () => {
    const el = input.current;
    return !!el && el.selectionStart !== el.selectionEnd && el.selectionEnd === value.length;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      setHighlight((h) => (h + 1) % matches.length);
    } else if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      setHighlight((h) => (h <= 0 ? matches.length - 1 : h - 1));
    } else if (event.key === 'Enter' && highlight >= 0 && matches[highlight]) {
      event.preventDefault();
      accept(matches[highlight]);
    } else if ((event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'Enter') && hasCompletion()) {
      // Keep the suggested text; Enter still submits the form with it.
      if (event.key !== 'Enter') event.preventDefault();
      accept(value);
    } else if (event.key === 'Escape' && hasCompletion()) {
      event.preventDefault();
      const kept = value.slice(0, input.current?.selectionStart ?? value.length);
      onChange(kept);
      setTyped(kept);
    }
    onKeyDown?.(event);
  };

  const showList = focused && matches.length > 0;

  return (
    <div className="relative">
      <TextInput
        {...rest}
        ref={input}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          setFocused(true);
          setTyped(value);
        }}
        onBlur={(event) => {
          setFocused(false);
          remember(historyKey, value);
          setHistory(readHistory(historyKey));
          onBlur?.(event);
        }}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="both"
        aria-expanded={showList}
        aria-controls={listId}
        className={className}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
        >
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                // Before the input's blur, so the click lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  accept(m);
                }}
                className={classNames(
                  'block w-full truncate px-3 py-1.5 text-left text-sm',
                  i === highlight ? 'bg-brand text-white' : 'text-ink-900 hover:bg-surface-2',
                )}
              >
                <span className="font-semibold">{m.slice(0, typed.trim().length)}</span>
                {m.slice(typed.trim().length)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
