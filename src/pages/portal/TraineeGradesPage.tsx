import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Select } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { ReportHeader } from '../reports/report-parts';
import { Pill, PortalCard, PortalHeading } from './portal-ui';

/**
 * Report of Grades — one term at a time.
 *
 * A grade the Registrar has approved stays locked here until the trainee
 * evaluates that subject's trainer; the row says so and links straight to
 * the form. Once every grade of a term is visible, the term's units and GWA
 * appear and the trainee confirms they have seen them.
 */
export function TraineeGradesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.evaluation() });
  const groups = useMemo(() => [...(query.data?.groups ?? [])].reverse(), [query.data]);
  const [termId, setTermId] = useState('');

  // The latest term with any grade or lock, else the latest term at all.
  useEffect(() => {
    if (termId || groups.length === 0) return;
    const withGrades = groups.find((g) => g.rows.some((r) => r.grade !== null || r.lockedForEvaluation));
    setTermId((withGrades ?? groups[0]).semesterId);
  }, [groups, termId]);

  const confirm = useMutation({
    mutationFn: (enrollmentId: string) => mineApi.confirmGradesViewed(enrollmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-record'] });
      toast.success('Thank you — the Registrar can now see you have viewed these grades.');
    },
    onError: (caught) => toast.error('Could not confirm.', errorMessage(caught)),
  });

  if (query.isLoading) return <LoadingState label="Loading your grades…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const group = groups.find((g) => g.semesterId === termId) ?? groups[0];

  if (!group) {
    return (
      <>
        <PortalHeading title="Report of Grades" />
        <PortalCard>
          <p className="text-sm text-ink-500">
            Your grades will appear here once you are enrolled and your trainers have posted them.
          </p>
        </PortalCard>
      </>
    );
  }

  const locked = group.rows.filter((r) => r.lockedForEvaluation);
  const posted = group.rows.filter((r) => r.grade !== null || r.lockedForEvaluation);
  const hasCompletion = group.rows.some((r) => r.completionGrade);
  const allVisible = locked.length === 0;

  return (
    <>
      <PortalHeading
        title="Report of Grades"
        description="Grades approved by the Registrar. Evaluate each subject's trainer to see its grade."
        actions={
          <>
            <Select
              value={group.semesterId}
              onChange={(event) => setTermId(event.target.value)}
              aria-label="Term"
              className="min-w-[16rem]"
            >
              {groups.map((g) => (
                <option key={g.semesterId} value={g.semesterId}>
                  {g.academicYearLabel} · {g.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => window.print()} disabled={!allVisible}>
              Download PDF
            </Button>
          </>
        }
      />

      {/* Where the trainee stands on this term, before the table. */}
      {locked.length > 0 ? (
        <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3">
          <span aria-hidden className="text-xl">🔒</span>
          <div className="min-w-0 flex-1 text-sm text-warning-ink">
            <p className="font-semibold">
              {locked.length} grade{locked.length === 1 ? ' is' : 's are'} waiting for your faculty evaluation
            </p>
            <p className="text-xs">
              {posted.length - locked.length} of {posted.length} posted grades unlocked. Each evaluation takes
              about five minutes, and your answers are anonymous to the trainer.
            </p>
          </div>
          <Link to="/portal/evaluations">
            <Button size="sm" variant="primary">
              Go to Evaluations
            </Button>
          </Link>
        </div>
      ) : null}

      {group.gradesViewPending ? (
        <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-info/40 bg-info-soft px-4 py-3">
          <div className="min-w-0 flex-1 text-sm text-info-ink">
            <p className="font-semibold">Every grade for this term is in.</p>
            <p className="text-xs">
              Confirm you have viewed them — the Registrar cannot enroll you in your next term until you do.
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            loading={confirm.isPending}
            onClick={() => confirm.mutate(group.enrollmentId)}
          >
            I have viewed these grades
          </Button>
        </div>
      ) : group.gradesViewedAt ? (
        <p className="no-print mb-3 text-xs text-success-ink">
          ✓ You confirmed viewing these grades on {formatDateTime(group.gradesViewedAt)}.
        </p>
      ) : null}

      <PortalCard className="print-sheet report-sheet p-0 sm:p-0">
        <div className="hidden p-4 print:block">
          <ReportHeader
            title="Report of Grades"
            subtitle={`${query.data?.student.lastFirstName ?? ''} · ${query.data?.student.studentNumber ?? ''} · ${group.academicYearLabel} ${group.label}`}
            generatedAt={new Date().toISOString()}
          />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-3">
          <p className="font-semibold text-ink-900">
            {group.label} <span className="font-normal text-ink-500">· {group.academicYearLabel}</span>
          </p>
          <p className="text-xs text-ink-500">{group.coverage}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-5 py-3 font-semibold">Code</th>
                <th className="px-3 py-3 font-semibold">Subject</th>
                <th className="px-3 py-3 text-right font-semibold">Units</th>
                <th className="px-3 py-3 text-right font-semibold">Percentage</th>
                <th className="px-3 py-3 text-right font-semibold">Final</th>
                {hasCompletion ? <th className="px-3 py-3 text-right font-semibold">Completion</th> : null}
                <th className="px-5 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.enrollmentSubjectId} className="border-t border-line">
                  <td className="whitespace-nowrap px-5 py-3 font-semibold text-ink-900">{row.courseCode}</td>
                  <td className="px-3 py-3">
                    <span className="block text-ink-900">{row.courseTitle}</span>
                    {row.trainerName ? (
                      <span className="block text-xs text-ink-500">{row.trainerName}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-700">{row.units.toFixed(1)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink-700">
                    {row.lockedForEvaluation ? '•••' : row.percentage || '—'}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.lockedForEvaluation ? (
                      <span className="text-ink-400">•••</span>
                    ) : row.grade ? (
                      <strong className={row.isPassed === false ? 'text-danger-ink' : 'text-ink-900'}>
                        {row.grade}
                        {row.excludedFromGwa ? '*' : ''}
                      </strong>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  {hasCompletion ? (
                    <td className="px-3 py-3 text-right tabular-nums text-ink-700">
                      {row.completionGrade
                        ? `${row.completionGrade}${row.completionPercentage !== null ? ` (${row.completionPercentage}%)` : ''}`
                        : ''}
                    </td>
                  ) : null}
                  <td className="px-5 py-3">
                    {row.lockedForEvaluation ? (
                      <Link
                        to={`/portal/evaluations/${row.enrollmentSubjectId}`}
                        className="no-print inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
                      >
                        🔒 Evaluate to view
                      </Link>
                    ) : row.grade === null ? (
                      <Pill tone="info">Enrolled</Pill>
                    ) : row.remarks.toUpperCase().startsWith('PASS') || row.remarks.toUpperCase().startsWith('COMPLETED') || row.remarks.toUpperCase() === 'CREDITED' ? (
                      <Pill tone="success">{row.remarks}</Pill>
                    ) : row.remarks.toUpperCase().startsWith('INC') ? (
                      <Pill tone="warning">{row.remarks}</Pill>
                    ) : (
                      <Pill tone="danger">{row.remarks || '—'}</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/60 px-5 py-3 text-sm">
          <span className="text-ink-700">
            Total units {group.inProgress ? 'enrolled' : 'earned'}:{' '}
            <strong className="tabular-nums text-ink-900">
              {(group.inProgress ? group.totalUnits : group.unitsEarned).toFixed(1)}
            </strong>
          </span>
          <span className="text-ink-700">
            General weighted average:{' '}
            <strong className="tabular-nums text-ink-900">
              {group.inProgress ? 'after the term' : allVisible ? group.gwa : 'after your evaluations'}
            </strong>
          </span>
        </div>
        {group.rows.some((r) => r.excludedFromGwa) ? (
          <p className="px-5 pb-3 text-[11px] text-ink-500">
            * NSTP and PE count toward your units but not toward your weighted average.
          </p>
        ) : null}
      </PortalCard>
    </>
  );
}
