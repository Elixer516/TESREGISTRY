/**
 * One class's faculty evaluation results — the combined ratings per area,
 * the overall, and the comments. Never who said what. Used by the trainer
 * (their own classes) and the Registrar (every class).
 */

import type { FacultyEvaluationResultView } from '@/types/views';
import { MIN_RESPONSES_FOR_TRAINER } from '@/lib/faculty-evaluation-form';

export function EvaluationResultCard({
  result,
  showTrainer,
}: {
  result: FacultyEvaluationResultView;
  showTrainer?: boolean;
}) {
  return (
    <article className="break-inside-avoid rounded-xl border border-line bg-surface p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showTrainer ? <p className="text-xs font-semibold uppercase tracking-wide text-brand-text">{result.trainerName}</p> : null}
          <p className="font-semibold text-ink-900">
            {result.subjectCode} — {result.subjectTitle}
          </p>
          <p className="text-xs text-ink-500">
            {result.sectionCode} · {result.academicYearLabel} {result.termLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-ink-900">
            {result.overall !== null ? result.overall.toFixed(2) : '—'}
          </p>
          <p className="text-xs text-ink-500">
            {result.overallLabel ?? 'No rating yet'} · {result.respondents} of {result.eligible} answered
          </p>
        </div>
      </header>

      {result.withheld ? (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-500">
          Fewer than {MIN_RESPONSES_FOR_TRAINER} trainees have answered, so results are held back to keep
          them anonymous.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">
            {result.areas.map((area) => (
              <li key={area.id} className="grid grid-cols-[1fr_8rem_2.5rem] items-center gap-3 text-sm">
                <span className="text-ink-700">
                  {area.id}. {area.title}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${((area.average ?? 0) / 5) * 100}%` }}
                  />
                </span>
                <span className="text-right tabular-nums font-semibold text-ink-900">
                  {area.average !== null ? area.average.toFixed(2) : '—'}
                </span>
              </li>
            ))}
          </ul>
          {result.comments.length > 0 ? (
            <div className="mt-4 space-y-3 border-t border-line pt-3">
              {result.comments.map((group) => (
                <div key={group.questionId}>
                  <p className="text-xs font-semibold text-ink-500">{group.question}</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-ink-700">
                    {group.answers.map((answer, index) => (
                      <li key={index}>{answer}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
