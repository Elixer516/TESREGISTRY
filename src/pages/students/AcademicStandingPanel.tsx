import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { academicStandingApi } from '@/api';
import { Badge, Button, InfoNote } from '@/components/ui';

/**
 * Trainees with a subject at 79% or below, in the centre's two tiers: 75% and
 * below is grounds for dropping, 76–79% is flagged for review.
 *
 * The rule this panel exists to honour is who acts on it:
 * **the registrar decides, not the system.** So the panel states the case —
 * who, which subjects, what grades, which term — and offers a button. It
 * never acts on its own, and the server has no matching auto-drop to call.
 *
 * It lives in a drawer on the right edge rather than at the top of the
 * Students page, where it pushed the Pending / Approved / Rejected table below
 * the fold. A tab with a count stays in view; the list opens on demand.
 */
export function AcademicStandingPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const reviews = useQuery({
    queryKey: ['academic-standing'],
    queryFn: () => academicStandingApi.list(),
  });

  const rows = reviews.data ?? [];
  const outstanding = rows.filter((row) => !row.alreadyDropped);

  // Escape closes the drawer, as it does every other overlay here.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Nothing to review is the normal state and deserves no furniture.
  if (reviews.isLoading || rows.length === 0) return null;

  return (
    <>
      {/* The tab on the right edge. Always within reach, never in the way of
          the student table — the reason it left the top of the page. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Academic standing review: ${outstanding.length} to review`}
        className="no-print fixed right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-line bg-surface px-2 py-3 shadow-lg transition-colors hover:bg-surface-2 [writing-mode:vertical-rl]"
      >
        <span className="rotate-180 text-xs font-semibold tracking-wide text-ink-700">
          Academic standing
        </span>
        {outstanding.length > 0 ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-danger text-[11px] font-bold text-white [writing-mode:horizontal-tb]">
            {outstanding.length}
          </span>
        ) : (
          <span className="text-success-ink [writing-mode:horizontal-tb]" aria-hidden>
            ✓
          </span>
        )}
      </button>

      {open ? (
        <div className="no-print fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Academic standing review">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="animate-in absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-line bg-surface shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-ink-900">Academic standing review</h2>
                <p className="mt-0.5 text-xs text-ink-500">
                  {outstanding.length > 0
                    ? `${outstanding.length} trainee(s) have a subject at 79% or below. 75% and below is grounds for dropping; 76–79% is for review. Nothing here happens automatically.`
                    : 'Every flagged trainee has already been acted on.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 p-4">
            {rows.map((row) => (
              <div
                key={row.student.id}
                className="rounded-lg border border-line p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-medium text-ink-900">
                      {row.student.lastFirstName}
                    </span>
                    <span className="ml-2 text-xs text-ink-500">
                      {row.student.studentNumber} · {row.student.programCode} · Year{' '}
                      {row.student.yearLevel}
                    </span>
                    <span className="ml-2">
                      {row.recommendation === 'DROP' ? (
                        <Badge tone="danger">Recommended for drop</Badge>
                      ) : (
                        <Badge tone="warning">For review</Badge>
                      )}
                    </span>
                  </div>
                  {row.alreadyDropped ? (
                    <Badge tone="neutral">Already dropped</Badge>
                  ) : (
                    // The decision, the reason and the proof belong to a drop
                    // case, so this opens (or finds) the trainee's case.
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/drops', { state: { studentId: row.student.id } })}
                    >
                      Open drop case
                    </Button>
                  )}
                </div>

                <ul className="mt-2 space-y-1 text-xs">
                  {[
                    ...row.noCredit.map((subject) => ({ subject, tier: 'drop' as const })),
                    ...row.forReview.map((subject) => ({ subject, tier: 'review' as const })),
                  ].map(({ subject, tier }) => (
                    <li key={subject.enrollmentSubjectId} className="text-ink-700">
                      <span
                        className={
                          'font-semibold tabular-nums ' +
                          (tier === 'drop' ? 'text-danger-ink' : 'text-warning-ink')
                        }
                      >
                        {subject.percentage !== null ? `${subject.percentage}% · ` : ''}
                        {subject.grade}
                      </span>{' '}
                      <span className="text-ink-500">({subject.descriptor})</span>{' '}
                      <strong>{subject.subjectCode}</strong> {subject.subjectTitle} ·{' '}
                      {subject.units} units · {subject.termLabel},{' '}
                      {subject.academicYearLabel}
                    </li>
                  ))}
                </ul>

                {row.unresolvedInc.length > 0 ? (
                  <p className="mt-2 text-xs text-ink-500">
                    Also carrying {row.unresolvedInc.length} unresolved INC (
                    {row.unresolvedInc.map((s) => s.subjectCode).join(', ')}) — unfinished
                    work rather than failed work, and not grounds for dropping on its own.
                  </p>
                ) : null}
              </div>
            ))}

            <InfoNote tone="info" title="Why nothing is dropped automatically">
              A grade is most likely to be wrong in the moments after it is entered — a
              mis-keyed figure, a sheet approved in haste, an INC that resolves next week.
              Reversing an automatic drop means reinstating the trainee and explaining an
              audit entry that says the system did it. Reviewing first costs one click.
            </InfoNote>
          </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
