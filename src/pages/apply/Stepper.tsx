/**
 * The numbered-circle step indicator at the top of the enrollment wizard.
 *
 * A step is "done" once the wizard has moved past it — that state is derived
 * from `currentIndex`, there is no separate completion flag, so it can never
 * drift out of sync with which fields are actually showing.
 */

import { classNames } from '@/lib/format';

export interface StepDef {
  id: string;
  label: string;
}

export function Stepper({
  steps,
  currentIndex,
}: {
  steps: StepDef[];
  currentIndex: number;
}) {
  return (
    <ol className="flex items-start" aria-label="Application progress">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.id}
            className={classNames('flex items-start', isLast ? 'shrink-0' : 'flex-1')}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-24">
              <span
                className={classNames(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isCompleted || isCurrent
                    ? 'bg-brand text-white'
                    : 'border border-line bg-surface text-ink-400',
                )}
              >
                {isCompleted ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7.3 7.3a1 1 0 01-1.4 0L4.3 10.3a1 1 0 111.4-1.4l3 3 6.6-6.6a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={classNames(
                  'text-center text-[11px] leading-tight',
                  isCurrent
                    ? 'font-semibold text-brand-text'
                    : isCompleted
                      ? 'font-medium text-ink-900'
                      : 'text-ink-400',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <div
                className={classNames('mt-4 h-0.5 flex-1', index < currentIndex ? 'bg-brand' : 'bg-line')}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
