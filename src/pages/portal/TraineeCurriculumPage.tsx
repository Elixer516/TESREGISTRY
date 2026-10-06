import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CurriculumSubjectStatus } from '@/types/views';
import { mineApi } from '@/api';
import { Select } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { Pill, PortalCard, PortalHeading, ProgressBar } from './portal-ui';

const STATUS: Record<CurriculumSubjectStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' }> = {
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  INC: { label: 'INC', tone: 'warning' },
  ENROLLED: { label: 'Enrolled', tone: 'info' },
  LOCKED: { label: 'Evaluate to view', tone: 'warning' },
  NOT_TAKEN: { label: 'Not yet taken', tone: 'neutral' },
};

type Filter = 'ALL' | 'DONE' | 'REMAINING';

/**
 * My Curriculum — every subject the trainee's diploma requires, year by year,
 * and where they stand on each. The trainee's own way of answering "what is
 * left before I finish?" without asking the Registrar.
 */
export function TraineeCurriculumPage() {
  const query = useQuery({ queryKey: ['my-curriculum'], queryFn: () => mineApi.curriculum(), retry: false });
  const [filter, setFilter] = useState<Filter>('ALL');

  if (query.isLoading) return <LoadingState label="Loading your curriculum…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return null;

  const show = (status: CurriculumSubjectStatus) =>
    filter === 'ALL' || (filter === 'DONE' ? status === 'PASSED' : status !== 'PASSED');

  return (
    <>
      <PortalHeading
        title="My Curriculum"
        description={`${data.curriculumName} · Batch ${data.batchYear}`}
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Show">
            <option value="ALL">Show all subjects</option>
            <option value="DONE">Passed only</option>
            <option value="REMAINING">Still to pass</option>
          </Select>
        }
      />

      <PortalCard className="mb-5 grid gap-4 sm:grid-cols-2">
        <ProgressBar label="Units earned" value={data.unitsEarned} total={data.unitsTotal} tone="success" />
        <ProgressBar label="Subjects passed" value={data.subjectsPassed} total={data.subjectsTotal} />
      </PortalCard>

      <div className="space-y-5">
        {data.terms.map((term) => {
          const subjects = term.subjects.filter((s) => show(s.status));
          if (subjects.length === 0) return null;
          return (
            <PortalCard key={term.key} className="p-0 sm:p-0">
              <div className="flex items-baseline justify-between border-b border-line px-5 py-3">
                <p className="font-semibold text-ink-900">{term.label}</p>
                <p className="text-xs text-ink-500">{term.units.toFixed(1)} units</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <tbody>
                    {subjects.map((s) => (
                      <tr key={s.subjectId} className="border-t border-line first:border-t-0">
                        <td className="w-28 whitespace-nowrap px-5 py-2.5 font-semibold text-ink-900">{s.subjectCode}</td>
                        <td className="px-3 py-2.5">
                          <span className="block text-ink-900">{s.subjectTitle}</span>
                          {s.prerequisite ? (
                            <span className="block text-xs text-ink-500">Pre-requisite: {s.prerequisite}</span>
                          ) : null}
                        </td>
                        <td className="w-14 px-3 py-2.5 text-right tabular-nums text-ink-700">{s.units}</td>
                        <td className="w-20 px-3 py-2.5 text-right tabular-nums font-semibold text-ink-900">
                          {s.grade ?? ''}
                        </td>
                        <td className="w-40 px-5 py-2.5 text-right">
                          {s.status === 'LOCKED' ? (
                            <Link to="/portal/evaluations">
                              <Pill tone="warning">🔒 Evaluate to view</Pill>
                            </Link>
                          ) : (
                            <Pill tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Pill>
                          )}
                          {s.takenIn && s.status !== 'NOT_TAKEN' ? (
                            <span className="mt-0.5 block text-[10px] text-ink-500">{s.takenIn}</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PortalCard>
          );
        })}
      </div>
    </>
  );
}
