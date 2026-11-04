import type { GuidanceSubmissionRow } from '@/types/views';
import { classNames } from '@/lib/format';
import { ratingLabel } from '@/lib/faculty-evaluation-form';
import { Badge, type BadgeTone } from '@/components/ui';

/** A slim bar of how much is done; the number beside it carries the meaning. */
export function ProgressBar({ value, total, className }: { value: number; total: number; className?: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${value} of ${total} submitted`}
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
