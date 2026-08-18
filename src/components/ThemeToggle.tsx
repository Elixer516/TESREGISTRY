import { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { classNames } from '@/lib/format';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: string; title: string }> = [
  { value: 'light', label: 'Light', icon: '☀', title: 'Always use the light palette' },
  { value: 'dark', label: 'Dark', icon: '☾', title: 'Always use the dark palette' },
  { value: 'system', label: 'System', icon: '◐', title: 'Follow the operating system setting' },
];

/**
 * Theme control, minimized to a single icon button. It opens a small popover
 * with the three choices instead of showing all of them at once in the header.
 */
export function ThemeToggle({ compact: _compact = false }: { compact?: boolean }) {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = OPTIONS.find((o) => o.value === preference) ?? OPTIONS[2];

  return (
    <div className="no-print relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Colour theme: ${current.label}. Click to change.`}
        title={`Theme: ${current.label} (currently ${resolved})`}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 hover:bg-surface-2"
      >
        <span aria-hidden>{resolved === 'dark' ? '☾' : '☀'}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Colour theme"
          className="animate-in absolute right-0 z-40 mt-2 w-44 rounded-xl border border-line bg-surface p-1 shadow-xl"
        >
          {OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                title={option.title}
                onClick={() => {
                  setPreference(option.value);
                  setOpen(false);
                }}
                className={classNames(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors',
                  selected ? 'bg-brand-soft text-brand-text font-medium' : 'text-ink-700 hover:bg-surface-2',
                )}
              >
                <span aria-hidden>{option.icon}</span>
                {option.label}
                {selected ? (
                  <span aria-hidden className="ml-auto text-xs">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
