import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TraineeDashboard } from '@/types/views';
import { dashboardApi, mineApi } from '@/api';
import { ErrorState, LoadingState } from '@/components/states';
import { Pill, PortalCard, PortalHeading, ProgressBar } from './portal-ui';

/**
 * Home — what the trainee should do next, how far along they are, and what
 * they are enrolled in. The to-do list comes first because it is the one
 * thing on this page that changes what they do today.
 */
export function TraineeHomePage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const record = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.evaluation() });
  const tasks = useQuery({ queryKey: ['my-evaluations'], queryFn: () => mineApi.evaluationTasks() });
  const curriculum = useQuery({ queryKey: ['my-curriculum'], queryFn: () => mineApi.curriculum(), retry: false });

  if (dashboard.isLoading) return <LoadingState label="Loading your portal…" />;
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  const payload = dashboard.data;
  const data: TraineeDashboard | null = payload && payload.kind === 'TRAINEE' ? payload : null;
  if (!data) return null;

  const pendingEvaluations = (tasks.data ?? []).filter((t) => t.status === 'PENDING').length;
  const toConfirm = (record.data?.groups ?? []).filter((g) => g.gradesViewPending);
  const progress = curriculum.data;
  const terms = [...(record.data?.groups ?? [])].reverse();

  const todo = [
    pendingEvaluations > 0
      ? {
          key: 'eval',
          tone: 'warning' as const,
          title: `Evaluate your trainer in ${pendingEvaluations} subject${pendingEvaluations === 1 ? '' : 's'}`,
          detail: 'Each evaluation unlocks that subject’s grade.',
          to: '/portal/evaluations',
          action: 'Evaluate',
        }
      : null,
    ...toConfirm.map((g) => ({
      key: g.enrollmentId,
      tone: 'info' as const,
      title: `Confirm your ${g.label} grades`,
      detail: 'Needed before you can be enrolled in your next term.',
      to: '/portal/grades',
      action: 'View grades',
    })),
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <PortalHeading title={`Welcome, ${data.student.firstName}!`} description="Here is where you stand." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <PortalCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">To do</h3>
          {todo.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success-ink">
              <span aria-hidden className="text-lg">✓</span> You are all caught up.
            </p>
          ) : (
            <ul className="space-y-2">
              {todo.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5"
                >
                  <span
                    aria-hidden
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === 'warning' ? 'bg-warning' : 'bg-info'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                    <p className="text-xs text-ink-500">{item.detail}</p>
                  </div>
                  <Link
                    to={item.to}
                    className="whitespace-nowrap rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-hover"
                  >
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Next class</h3>
          {data.nextClass ? (
            <>
              <p className="text-base font-semibold text-ink-900">
                {data.nextClass.subjectCode} — {data.nextClass.subjectTitle}
              </p>
              <p className="mt-1 text-sm text-ink-700">
                {data.nextClass.dayLabel} · {data.nextClass.timeRange}
              </p>
              <p className="text-sm text-ink-500">
                {data.nextClass.room} · {data.nextClass.trainerName}
              </p>
              <Link to="/portal/schedule" className="mt-3 inline-block text-sm font-medium text-brand-text hover:underline">
                Full schedule →
              </Link>
            </>
          ) : (
            <p className="text-sm text-ink-500">
              No published classes yet. Your schedule appears once you are enrolled and the Registrar
              publishes your section&rsquo;s classes.
            </p>
          )}
        </PortalCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PortalCard>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">Overall progress</h3>
          {progress ? (
            <div className="space-y-4">
              <ProgressBar label="Units earned" value={progress.unitsEarned} total={progress.unitsTotal} tone="success" />
              <ProgressBar label="Subjects passed" value={progress.subjectsPassed} total={progress.subjectsTotal} />
              <p className="text-xs text-ink-500">
                {progress.curriculumName} · Batch {progress.batchYear}.{' '}
                <Link to="/portal/curriculum" className="font-medium text-brand-text hover:underline">
                  See every subject →
                </Link>
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-500">Your curriculum has not been assigned yet.</p>
          )}
        </PortalCard>

        <PortalCard>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">This term</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs text-ink-500">Units enrolled</p>
              <p className="text-2xl font-bold tabular-nums text-ink-900">{data.enrolledUnits}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs text-ink-500">Subjects</p>
              <p className="text-2xl font-bold tabular-nums text-ink-900">{data.subjectCount}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-500">
            {data.activeTerm ? `${data.activeTerm.academicYearLabel} · ${data.activeTerm.termLabel}` : 'No open term.'}
          </p>
        </PortalCard>
      </div>

      {terms.length > 0 ? (
        <section className="mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">My enrollments</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {terms.map((g) => (
              <PortalCard key={g.enrollmentId} className="p-4">
                <p className="text-xs text-ink-500">{g.academicYearLabel}</p>
                <p className="font-semibold text-ink-900">{g.label}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {g.rows.length} subjects · {g.totalUnits.toFixed(1)} units
                </p>
                <div className="mt-3">
                  {g.inProgress ? <Pill tone="info">Officially enrolled</Pill> : <Pill tone="success">Completed</Pill>}
                </div>
              </PortalCard>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
