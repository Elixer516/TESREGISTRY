/**
 * The three non-success states every screen ships. Success is the screen
 * itself; confirmation lives in ConfirmDialog.
 */

import type { ReactNode } from 'react';
import { Button, Card } from './ui';
import { errorMessage, isApiError } from '@/lib/api-error';
import { classNames } from '@/lib/format';

export function LoadingState({
  label = 'Loading…',
  rows = 3,
  className,
}: {
  label?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <Card className={classNames('p-5', className)}>
      <div className="flex items-center gap-2.5 text-sm text-ink-500">
        <span
          aria-hidden
          className="spin h-4 w-4 rounded-full border-2 border-line border-t-brand"
        />
        <span>{label}</span>
      </div>
      <div className="mt-4 space-y-2" aria-hidden>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-8 animate-pulse rounded-md bg-surface-2"
            style={{ animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </Card>
  );
}

export function EmptyState({
  title,
  hint,
  action,
  icon = '◍',
  className,
}: {
  title: string;
  /** Always say what the reader should do next — never just "no data". */
  hint: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      <span
        aria-hidden
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-lg text-ink-400"
      >
        {icon}
      </span>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-500">{hint}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const details = isApiError(error) ? error.details : undefined;
  return (
    <div
      className={classNames(
        'rounded-xl border border-danger/40 bg-danger-soft px-5 py-5 text-danger-ink',
        className,
      )}
      role="alert"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm">{errorMessage(error)}</p>
      {details && details.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Convenience wrapper: loading → error → empty → content, in that order. */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  onRetry,
  loadingLabel,
  emptyTitle,
  emptyHint,
  emptyAction,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
  emptyAction?: ReactNode;
  children: ReactNode;
}) {
  if (isLoading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) {
    return (
      <EmptyState
        title={emptyTitle ?? 'Nothing here yet'}
        hint={emptyHint ?? 'Records will appear once they are created.'}
        action={emptyAction}
      />
    );
  }
  return <>{children}</>;
}
