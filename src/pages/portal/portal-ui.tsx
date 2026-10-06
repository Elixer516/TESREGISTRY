/**
 * The trainee portal's own building blocks — a calmer, roomier look than the
 * staff screens, which are built for working through many records at once.
 */

import type { ReactNode } from 'react';

/** A tab's heading: title on the left, its controls on the right. */
export function PortalHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A labelled bar: "28 of 159 units". */
export function ProgressBar({
  label,
  value,
  total,
  tone = 'brand',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'brand' | 'success' | 'warning';
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const fill = { brand: 'bg-brand', success: 'bg-success', warning: 'bg-warning' }[tone];
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-700">{label}</span>
        <span className="tabular-nums text-ink-500">
          <strong className="text-lg text-ink-900">{value}</strong> / {total}
        </span>
      </div>
      <div
        className="h-2.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className={`h-full rounded-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const PILL_TONES = {
  success: 'bg-success-soft text-success-ink ring-success/30',
  danger: 'bg-danger-soft text-danger-ink ring-danger/30',
  warning: 'bg-warning-soft text-warning-ink ring-warning/30',
  info: 'bg-info-soft text-info-ink ring-info/30',
  neutral: 'bg-surface-2 text-ink-700 ring-line',
} as const;

export function Pill({
  tone,
  children,
}: {
  tone: keyof typeof PILL_TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** A soft card for the portal — rounder and airier than the staff Card. */
export function PortalCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>{children}</div>
  );
}
