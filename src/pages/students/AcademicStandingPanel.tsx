import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StandingReview } from '@/server/services/academic-standing';
import { academicStandingApi, studentsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, CardHeader, InfoNote, Modal } from '@/components/ui';
import {
  DepartureFields,
  EMPTY_DEPARTURE,
  isDepartureComplete,
  type DepartureDraft,
} from './DepartureFields';

/**
 * Trainees with a subject at 79% or below, in the centre's two tiers: 75% and
 * below is grounds for dropping, 76–79% is flagged for review.
 *
 * The rule this panel exists to honour is who acts on it:
 * **the registrar decides, not the system.** So the panel states the case —
 * who, which subjects, what grades, which term — and offers a button. It
 * never acts on its own, and the server has no matching auto-drop to call.
 *
 * Collapsed by default once it is empty and open when it is not, because a
 * panel that is always expanded stops being read.
 */
export function AcademicStandingPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [dropping, setDropping] = useState<StandingReview | null>(null);
  // Pre-set to the ground this panel exists for. Still changeable — the
  // registrar may open the case and find the real reason was something else.
  const [departure, setDeparture] = useState<DepartureDraft>(EMPTY_DEPARTURE);

  const reviews = useQuery({
    queryKey: ['academic-standing'],
    queryFn: () => academicStandingApi.list(),
  });

  const drop = useMutation({
    mutationFn: () =>
      studentsApi.setStatus(dropping?.student.id ?? '', 'DROPPED', {
        reason: departure.reason as Exclude<DepartureDraft['reason'], ''>,
        note: departure.note,
      }),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['academic-standing'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        `${student.fullName} is now marked as dropped.`,
        'Reinstate them from the Students list if this was not intended.',
      );
      setDropping(null);
    },
    onError: (caught) => toast.error('Could not drop that trainee.', errorMessage(caught)),
  });

  const rows = reviews.data ?? [];
  const outstanding = rows.filter((row) => !row.alreadyDropped);

  // Nothing to review is the normal state and deserves no furniture.
  if (reviews.isLoading || rows.length === 0) return null;

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="Academic standing review"
          description={
            outstanding.length > 0
              ? `${outstanding.length} trainee(s) have a subject at 79% or below. 75% and below is grounds for dropping; 76–79% is for review. Nothing here happens automatically.`
              : 'Every flagged trainee has already been acted on.'
          }
          actions={
            <div className="flex items-center gap-2">
              {outstanding.length > 0 ? (
                <Badge tone="warning">{outstanding.length} to review</Badge>
              ) : (
                <Badge tone="success">All reviewed</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)}>
                {open ? 'Hide' : 'Show'}
              </Button>
            </div>
          }
        />

        {open ? (
          <div className="space-y-3 p-4 pt-0">
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDeparture({ reason: 'ACADEMIC_FAILURE', note: '' });
                        setDropping(row);
                      }}
                    >
                      Review and drop…
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
        ) : null}
      </Card>

      <Modal
        open={dropping !== null}
        onClose={() => setDropping(null)}
        title={dropping ? `Drop ${dropping.student.fullName}?` : 'Drop trainee?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDropping(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={drop.isPending}
              disabled={!isDepartureComplete(departure)}
              onClick={() => drop.mutate()}
            >
              Mark as dropped
            </Button>
          </>
        }
      >
        {dropping ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-700">
              {dropping.noCredit.length > 0 ? (
                <>
                  {dropping.student.fullName} has {dropping.noCredit.length} subject(s) at 75%
                  or below ({dropping.noCreditUnits} units):{' '}
                  {dropping.noCredit
                    .map((s) => `${s.subjectCode} ${s.percentage !== null ? `${s.percentage}%` : s.grade}`)
                    .join(', ')}
                  .
                </>
              ) : (
                <>
                  {dropping.student.fullName} has no subject at 75% or below — only{' '}
                  {dropping.forReview
                    .map((s) => `${s.subjectCode} ${s.percentage}%`)
                    .join(', ')}
                  , which is flagged for review rather than grounds for dropping. Be sure
                  there is another reason before continuing.
                </>
              )}
              Marking them dropped stops them being enrolled in further terms. The record and
              its grades are kept, and the status can be changed back from the Students list.
            </p>
            <DepartureFields
              value={departure}
              onChange={setDeparture}
              disabled={drop.isPending}
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
