import type { ScheduleConflictDetail } from '@/types';
import { DAY_SHORT_LABELS } from '@/types';
import { Badge, Button, InfoNote, Modal } from './ui';

const RULE_TONE: Record<ScheduleConflictDetail['rule'], 'danger' | 'warning' | 'info'> = {
  SECTION: 'danger',
  TRAINER: 'warning',
  ROOM: 'info',
};

const RULE_NAME: Record<ScheduleConflictDetail['rule'], string> = {
  SECTION: 'Section clash',
  TRAINER: 'Trainer clash',
  ROOM: 'Room clash',
};

/**
 * Shown when a schedule save is refused.
 *
 * There is deliberately no "save anyway": a section cannot be in two rooms at
 * once, so an override would only record something that cannot happen.
 */
export function ScheduleConflictModal({
  open,
  conflicts,
  message,
  onClose,
}: {
  open: boolean;
  conflicts: ScheduleConflictDetail[];
  message: string;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule conflict — not saved"
      description="Nothing was written. Adjust the day, time, room, section or trainer and try again."
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Back to the form
        </Button>
      }
    >
      <div className="space-y-4">
        <InfoNote tone="danger" title="Why this was refused">
          {message}
        </InfoNote>

        <ul className="space-y-3">
          {conflicts.map((conflict, index) => (
            <li
              key={`${conflict.scheduleId}-${conflict.rule}-${index}`}
              className="rounded-lg border border-line bg-surface-2 p-3.5"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={RULE_TONE[conflict.rule]}>{RULE_NAME[conflict.rule]}</Badge>
                <span className="text-sm font-semibold text-ink-900">
                  {conflict.subjectCode} — {conflict.subjectTitle}
                </span>
              </div>
              <p className="mb-2 text-sm text-ink-700">{conflict.ruleLabel}.</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-ink-400">Section</dt>
                  <dd className="text-ink-900">{conflict.sectionCode}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-ink-400">Days</dt>
                  <dd className="text-ink-900">
                    {conflict.days.map((d) => DAY_SHORT_LABELS[d]).join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-ink-400">Time</dt>
                  <dd className="text-ink-900">{conflict.timeRange}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-ink-400">Room</dt>
                  <dd className="text-ink-900">{conflict.room || 'TBA'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="font-semibold uppercase tracking-wide text-ink-400">Trainer</dt>
                  <dd className="text-ink-900">{conflict.trainerName}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        <p className="text-xs text-ink-500">
          Time ranges are half-open: a class ending at 11:00 and another starting at 11:00 do
          not conflict.
        </p>
      </div>
    </Modal>
  );
}
