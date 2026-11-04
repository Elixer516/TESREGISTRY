import type { ReactNode } from 'react';
import type { GuidanceSubmissionRow } from '@/types/views';
import { classNames } from '@/lib/format';
import { ratingLabel } from '@/lib/faculty-evaluation-form';
import { Badge, Button, Card, Tabs, type BadgeTone } from '@/components/ui';
import { EmptyState } from '@/components/states';

export type Scope = 'CURRENT' | 'PAST' | 'ALL';

/** Current term / Past terms / All, counted from the rows given. */
export function ScopeTabs({
  value,
  onChange,
  rows,
}: {
  value: Scope;
  onChange: (next: Scope) => void;
  rows: Array<{ semesterIsActive: boolean }>;
}) {
  return (
    <Tabs<Scope>
      ariaLabel="Term"
      value={value}
      onChange={onChange}
      options={[
        { value: 'CURRENT', label: 'Current term', count: rows.filter((r) => r.semesterIsActive).length },
        { value: 'PAST', label: 'Past terms', count: rows.filter((r) => !r.semesterIsActive).length },
        { value: 'ALL', label: 'All', count: rows.length },
      ]}
    />
  );
}

export function inScope<T extends { semesterIsActive: boolean }>(rows: T[], scope: Scope): T[] {
  return rows.filter((r) => (scope === 'CURRENT' ? r.semesterIsActive : scope === 'PAST' ? !r.semesterIsActive : true));
}

/** The diplomas on one row of their own, spread across it evenly, as on Grading Sheets. */
export function DiplomaTabs({
  value,
  onChange,
  codes,
  counted,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Every diploma with data, whatever the term. */
  codes: string[];
  /** The rows in view, for the counts. */
  counted: Array<{ programCode: string }>;
}) {
  const options = [
    { value: 'ALL', label: 'All', count: counted.length },
    ...[...new Set(codes)].sort().map((code) => ({
      value: code,
      label: code,
      count: counted.filter((r) => r.programCode === code).length,
    })),
  ];
  return (
    <div role="tablist" aria-label="Diploma" className="mb-3 flex gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2 p-1">
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
              'flex flex-1 items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-1 py-1.5 text-xs font-semibold transition-colors',
              selected ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {option.label}
            <span
              className={classNames(
                'rounded-full px-1 py-0.5 text-[10px] leading-none',
                selected ? 'bg-brand-soft text-brand-text' : 'bg-surface-3 text-ink-500',
              )}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Tile({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'success' | 'warning';
  children?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={classNames(
          'mt-1.5 text-2xl font-semibold tabular-nums',
          tone === 'success' ? 'text-success-ink' : tone === 'warning' ? 'text-warning-ink' : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  );
}

export function NothingHere({ narrowed, onClear, what }: { narrowed: boolean; onClear: () => void; what: string }) {
  return (
    <EmptyState
      title="Nothing to see here"
      hint={
        narrowed
          ? `No ${what} match this search or filter. Try another, or clear them.`
          : `No ${what} in this term and diploma. Try Past terms or All.`
      }
      action={
        narrowed ? (
          <Button size="sm" variant="secondary" onClick={onClear}>
            Clear search and filters
          </Button>
        ) : undefined
      }
    />
  );
}

/** A slim bar of how much is done; the number beside it carries the meaning. */
export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${value} of ${total}`}
      className={classNames('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}
    >
      <div
        className={classNames(
          'h-full rounded-full transition-[width] duration-500',
          percent === 100 ? 'bg-success' : percent >= 50 ? 'bg-brand' : 'bg-warning',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

const STATUS: Record<GuidanceSubmissionRow['status'], { label: string; tone: BadgeTone }> = {
  SUBMITTED: { label: 'Submitted', tone: 'success' },
  PENDING: { label: 'Pending', tone: 'warning' },
  NOT_OPEN: { label: 'Not open yet', tone: 'neutral' },
};

export function StatusBadge({ status }: { status: GuidanceSubmissionRow['status'] }) {
  return <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>;
}

export function statusLabel(status: GuidanceSubmissionRow['status']): string {
  return STATUS[status].label;
}

/** Tone for a 1–5 average: below "Agree" stands out. */
export function ratingTone(value: number): BadgeTone {
  if (value >= 4.5) return 'success';
  if (value >= 3.5) return 'info';
  if (value >= 2.5) return 'warning';
  return 'danger';
}

export function RatingPill({ value }: { value: number }) {
  return (
    <Badge tone={ratingTone(value)} className="tabular-nums">
      {value.toFixed(2)} · {ratingLabel(value)}
    </Badge>
  );
}
