/**
 * Primitive UI pieces. Every colour here comes from a semantic token, so dark
 * mode never needs a second pass over these components.
 */

import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { classNames } from '@/lib/format';

/* ---------------------------------------------------------------- */
/* Button                                                            */
/* ---------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Solid fills carry white text and are identical in both themes.
  primary: 'bg-brand text-white hover:bg-brand-hover border border-transparent',
  danger: 'bg-danger text-white hover:bg-danger-hover border border-transparent',
  secondary: 'bg-surface text-ink-900 border border-line hover:bg-surface-2',
  subtle: 'bg-surface-2 text-ink-700 border border-transparent hover:bg-surface-3',
  ghost: 'bg-transparent text-brand-text border border-transparent hover:bg-surface-2',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden
          className="spin h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Surfaces                                                          */
/* ---------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={classNames(
        'rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,27,45,0.04)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb ? <div className="mb-1 text-xs text-ink-500">{breadcrumb}</div> : null}
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ---------------------------------------------------------------- */
/* Badge                                                             */
/* ---------------------------------------------------------------- */

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-700 border-line',
  brand: 'bg-brand-soft text-brand-text border-transparent',
  success: 'bg-success-soft text-success-ink border-transparent',
  warning: 'bg-warning-soft text-warning-ink border-transparent',
  danger: 'bg-danger-soft text-danger-ink border-transparent',
  info: 'bg-info-soft text-info-ink border-transparent',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Form controls                                                     */
/* ---------------------------------------------------------------- */

const CONTROL_CLASS =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-400';

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={classNames('flex flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-700">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-ink">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** React 19 passes `ref` as an ordinary prop, so it is declared explicitly. */
export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>;
};

export function TextInput(props: TextInputProps) {
  const { className, ...rest } = props;
  return <input {...rest} className={classNames(CONTROL_CLASS, className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={classNames(CONTROL_CLASS, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={classNames(CONTROL_CLASS, 'min-h-20', className)} />;
}

export function Checkbox({
  label,
  description,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label
      htmlFor={rest.id ?? id}
      className={classNames(
        'flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface p-2.5 transition-colors hover:bg-surface-2',
        rest.disabled && 'cursor-not-allowed opacity-60 hover:bg-surface',
        className,
      )}
    >
      <input
        type="checkbox"
        {...rest}
        id={rest.id ?? id}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-ink-500">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

/* ---------------------------------------------------------------- */
/* Table                                                             */
/* ---------------------------------------------------------------- */

/** Wide tables scroll inside this container — the page body never does. */
export function TableWrap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('scroll-x w-full', className)}>{children}</div>;
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <table className={classNames('w-full min-w-[36rem] border-collapse text-sm', className)}>
      {children}
    </table>
  );
}

export function Th({
  children,
  className,
  scope = 'col',
}: {
  children: ReactNode;
  className?: string;
  scope?: 'col' | 'row';
}) {
  return (
    <th
      scope={scope}
      className={classNames(
        'border-b border-line bg-surface-2 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-500',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={classNames('border-b border-line px-3 py-2 align-middle text-ink-700', className)}
    >
      {children}
    </td>
  );
}

/* ---------------------------------------------------------------- */
/* Tabs                                                              */
/* ---------------------------------------------------------------- */

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<TabOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface-2 p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={classNames(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              selected
                ? 'bg-surface text-ink-900 shadow-sm'
                : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={classNames(
                  'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]',
                  selected ? 'bg-brand-soft text-brand-text' : 'bg-surface-3 text-ink-500',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Modal                                                             */
/* ---------------------------------------------------------------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Escape closes, Tab is trapped inside the panel.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const focusFirst = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
      focusable?.[0]?.focus();
    };
    const timer = window.setTimeout(focusFirst, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  const widths: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/45 p-0 sm:items-center sm:p-4">
      <div
        aria-hidden
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={classNames(
          'animate-in relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-xl border border-line bg-surface shadow-2xl sm:rounded-xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-ink-900">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md px-2 py-1 text-lg leading-none text-ink-500 hover:bg-surface-2 hover:text-ink-900"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Misc                                                              */
/* ---------------------------------------------------------------- */

export function InfoNote({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: 'border-accent/40 bg-info-soft text-info-ink',
    warning: 'border-warning/40 bg-warning-soft text-warning-ink',
    danger: 'border-danger/40 bg-danger-soft text-danger-ink',
    success: 'border-success/40 bg-success-soft text-success-ink',
  };
  return (
    <div className={classNames('rounded-lg border px-3.5 py-3 text-sm', tones[tone])}>
      {title ? <p className="mb-1 font-semibold">{title}</p> : null}
      <div className="text-[13px] leading-relaxed">{children}</div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  );
}

export function DescriptionItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
    </div>
  );
}
