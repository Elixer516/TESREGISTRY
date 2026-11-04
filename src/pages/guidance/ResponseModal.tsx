/**
 * One trainee's answers to one subject's Faculty Evaluation, as the Guidance
 * Office reads them: each statement with the point the trainee chose on the
 * five-point scale, the self-evaluation, the two numbers and the comments.
 */

import { useQuery } from '@tanstack/react-query';
import { guidanceApi } from '@/api';
import { classNames, formatDateTime } from '@/lib/format';
import { RATING_SCALE } from '@/lib/faculty-evaluation-form';
import { DescriptionItem, Modal } from '@/components/ui';
import { QueryState } from '@/components/states';
import { RatingPill } from './guidance-parts';

/** Low to high, the way the scale reads left to right. */
const SCALE = [...RATING_SCALE].sort((a, b) => a.value - b.value);

function Scale({ value }: { value: number | null }) {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-hidden>
      {SCALE.map((point) => (
        <span
          key={point.value}
          title={point.label}
          className={classNames(
            'flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums',
            point.value === value
              ? value >= 4
                ? 'bg-brand text-white'
                : value === 3
                  ? 'bg-warning text-white'
                  : 'bg-danger text-white'
              : 'bg-surface-2 text-ink-400',
          )}
        >
          {point.value}
        </span>
      ))}
    </div>
  );
}

export function ResponseModal({
  enrollmentSubjectId,
  onClose,
}: {
  enrollmentSubjectId: string | null;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ['guidance-response', enrollmentSubjectId],
    queryFn: () => guidanceApi.response(enrollmentSubjectId!),
    enabled: Boolean(enrollmentSubjectId),
    // Each opening is an audited read; don't refetch it behind the reader's back.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const data = query.data;
  const row = data?.row;

  return (
    <Modal
      open={Boolean(enrollmentSubjectId)}
      onClose={onClose}
      size="xl"
      title={row ? `${row.studentName} · ${row.subjectCode}` : 'Evaluation response'}
      description={
        row ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden>🔒</span> Confidential. Visible to the Guidance Office only.
          </span>
        ) : undefined
      }
    >
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} loadingLabel="Opening response…">
        {data && row ? (
          <div className="space-y-5">
            <div className="grid gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-[1fr_auto]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                <DescriptionItem label="Trainee">
                  {row.studentName}
                  <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                </DescriptionItem>
                <DescriptionItem label="Subject">
                  {row.subjectCode}
                  <span className="block text-xs text-ink-500">{row.subjectTitle}</span>
                </DescriptionItem>
                <DescriptionItem label="Trainer">{row.trainerName}</DescriptionItem>
                <DescriptionItem label="Section">{row.sectionCode}</DescriptionItem>
                <DescriptionItem label="Term">
                  {row.termLabel}
                  <span className="block text-xs text-ink-500">{row.academicYearLabel}</span>
                </DescriptionItem>
                <DescriptionItem label="Submitted">{formatDateTime(row.submittedAt)}</DescriptionItem>
              </dl>
              <div className="flex flex-col items-start justify-center gap-1 border-line sm:items-end sm:border-l sm:pl-5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">Overall</span>
                <span className="text-3xl font-semibold tabular-nums text-ink-900">
                  {row.overall === null ? '—' : row.overall.toFixed(2)}
                </span>
                <span className="text-xs text-ink-500">{data.overallLabel ?? 'No ratings'}</span>
              </div>
            </div>

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <span className="font-semibold text-ink-700">Scale</span>
              {SCALE.map((p) => (
                <span key={p.value}>
                  <span className="font-semibold tabular-nums text-ink-700">{p.value}</span> {p.label}
                </span>
              ))}
            </p>

            {data.areas.map((area) => (
              <section key={area.id}>
                <header className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">
                    {area.id}. {area.title}
                  </h3>
                  {!area.aboutTrainer ? (
                    <span className="text-xs text-ink-500">About the trainee; not part of the trainer’s overall</span>
                  ) : null}
                  {area.average !== null ? (
                    <span className="ml-auto">
                      <RatingPill value={area.average} />
                    </span>
                  ) : null}
                </header>
                <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {area.items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <span className="w-7 shrink-0 text-xs font-semibold text-ink-500">{item.id}</span>
                      <span className="min-w-[12rem] flex-1 text-sm text-ink-700">{item.text}</span>
                      <span className="sr-only">
                        {item.rating ?? 'No answer'}: {item.label}
                      </span>
                      <Scale value={item.rating} />
                      <span className="hidden w-28 text-right text-xs text-ink-500 sm:inline">{item.label}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Practice and attendance</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {data.numbers.map((n) => (
                  <div key={n.id} className="rounded-lg border border-line p-3">
                    <dt className="text-xs text-ink-500">{n.text}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{n.value ?? '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-900">Comments</h3>
              <div className="space-y-3">
                {data.comments.map((c) => (
                  <figure key={c.id} className="rounded-lg border border-line p-3">
                    <figcaption className="text-xs font-semibold text-ink-500">{c.text}</figcaption>
                    {c.answer ? (
                      <blockquote className="mt-1.5 border-l-2 border-brand pl-3 text-sm text-ink-900">{c.answer}</blockquote>
                    ) : (
                      <p className="mt-1.5 text-sm italic text-ink-400">No answer</p>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
