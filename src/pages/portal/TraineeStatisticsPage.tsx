import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { TraineeDashboard } from '@/types/views';
import { STUDENT_STATUS_LABELS } from '@/types';
import { dashboardApi, mineApi } from '@/api';
import { ErrorState, LoadingState } from '@/components/states';
import { Pill, PortalCard, PortalHeading } from './portal-ui';

/** "1st · 2nd Sem" — short enough for the label column of the chart. */
function shortTerm(label: string): string {
  const [year, sem] = label.split(', ');
  const y = { 'First Year': '1st', 'Second Year': '2nd', 'Third Year': '3rd', 'Fourth Year': '4th' }[year] ?? year;
  const s = sem === 'Summer' ? 'Summer' : sem?.replace(' Semester', ' Sem');
  return `${y} · ${s}`;
}

/**
 * Statistics — the trainee's record in numbers.
 *
 * Built only from what the trainee can already see: a grade still locked
 * behind its faculty evaluation is left out of every figure here, so this
 * page is no way round the lock. NSTP and PE count toward units but, as on
 * the Grade Evaluation, not toward the GWA or the highest and lowest grade.
 */
export function TraineeStatisticsPage() {
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const record = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.evaluation() });
  const curriculum = useQuery({ queryKey: ['my-curriculum'], queryFn: () => mineApi.curriculum(), retry: false });

  if (dashboard.isLoading || record.isLoading) return <LoadingState label="Working out your statistics…" />;
  if (record.error) return <ErrorState error={record.error} onRetry={() => record.refetch()} />;
  const payload = dashboard.data;
  const data: TraineeDashboard | null = payload && payload.kind === 'TRAINEE' ? payload : null;
  if (!data || !record.data) return null;

  const groups = record.data.groups;
  const visible = groups.flatMap((g) =>
    g.rows
      .filter((r) => !r.lockedForEvaluation && !r.excludedFromGwa)
      .map((r) => ({ ...r, term: g.label, value: Number(r.completionGrade ?? r.grade) }))
      .filter((r) => Number.isFinite(r.value) && r.value >= 1 && r.value <= 5),
  );
  const highest = visible.reduce<(typeof visible)[number] | null>((best, r) => (!best || r.value < best.value ? r : best), null);
  const lowest = visible.reduce<(typeof visible)[number] | null>((worst, r) => (!worst || r.value > worst.value ? r : worst), null);
  const locked = groups.reduce((n, g) => n + g.rows.filter((r) => r.lockedForEvaluation).length, 0);

  const progress = curriculum.data;
  const completion = progress && progress.unitsTotal > 0 ? Math.round((progress.unitsEarned / progress.unitsTotal) * 100) : 0;

  // A term with a GWA the trainee can see: finished, and nothing locked.
  const termGwas = groups
    .filter((g) => !g.inProgress && g.gwa !== '—' && Number(g.gwa) >= 1)
    .map((g) => ({ key: g.enrollmentId, label: shortTerm(g.label), year: g.academicYearLabel, gwa: Number(g.gwa) }));

  const enrolledNow = data.subjectCount > 0;
  const statusLabel = enrolledNow ? 'Enrolled' : STUDENT_STATUS_LABELS[data.student.status];
  const statusTone =
    data.student.status === 'DROPPED' ? 'danger' : data.student.status === 'GRADUATED' ? 'info' : enrolledNow ? 'success' : 'neutral';

  return (
    <>
      <PortalHeading title="Statistics" description="Your record in numbers — from the grades you can see." />

      {/* The KPI bar: where the trainee stands, right now, in one line. */}
      <PortalCard className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500">Enrollment status</p>
          <div className="mt-1">
            <Pill tone={statusTone}>{statusLabel}</Pill>
          </div>
        </div>
        <Kpi label="Term" value={data.activeTerm ? `${data.activeTerm.academicYearLabel}, ${data.activeTerm.termLabel}` : 'No open term'} />
        <Kpi label="Year level" value={`Year ${data.student.yearLevel}`} />
        <Kpi label="Section" value={data.sectionCode ?? 'Not assigned'} />
        <Kpi label="Units this term" value={String(data.enrolledUnits)} />
      </PortalCard>

      {/* The four headline figures, seated together. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Program completion" value={progress ? `${completion}%` : '—'}>
          {progress ? (
            <>
              <p>
                {progress.unitsEarned} of {progress.unitsTotal} units earned
              </p>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand" style={{ width: `${completion}%` }} />
              </div>
            </>
          ) : (
            <p>No curriculum assigned yet.</p>
          )}
        </StatCard>
        <StatCard
          label="Overall GWA"
          value={record.data.overallGwa !== '—' && Number(record.data.overallGwa) >= 1 ? Number(record.data.overallGwa).toFixed(2) : '—'}
        >
          <p>
            {record.data.overallGwa === '—'
              ? 'Shown once your evaluations are done.'
              : `Across ${visible.length} completed subject${visible.length === 1 ? '' : 's'}`}
          </p>
        </StatCard>
        <StatCard label="Highest grade" value={highest ? highest.value.toFixed(2) : '—'}>
          <p>{highest ? `${highest.courseTitle} (${highest.term})` : 'No grades yet.'}</p>
        </StatCard>
        <StatCard label="Lowest grade" value={lowest ? lowest.value.toFixed(2) : '—'}>
          <p>{lowest ? `${lowest.courseTitle} (${lowest.term})` : 'No grades yet.'}</p>
        </StatCard>
      </div>

      {locked > 0 ? (
        <p className="mt-3 text-xs text-warning-ink">
          🔒 {locked} grade{locked === 1 ? ' is' : 's are'} not counted yet —{' '}
          <Link to="/portal/evaluations" className="font-semibold underline">
            evaluate your trainers
          </Link>{' '}
          to include {locked === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      <PortalCard className="mt-4">
        <h3 className="text-lg font-semibold text-ink-900">General weighted average per semester</h3>
        {termGwas.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">Appears once a semester is finished and all its grades are visible.</p>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {termGwas.map((t) => (
                <li key={t.key} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3rem]">
                  <span className="text-ink-700" title={t.year}>
                    {t.label}
                  </span>
                  <span className="h-3 overflow-hidden rounded-full bg-surface-3">
                    {/* 1.00 fills the bar, 5.00 empties it. */}
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(4, ((5 - t.gwa) / 4) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right font-bold tabular-nums text-ink-900">{t.gwa.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-500">A longer bar means a better (lower) average.</p>
          </>
        )}
      </PortalCard>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-1 font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function StatCard({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <PortalCard>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-ink-900">{value}</p>
      <div className="mt-1 text-sm text-ink-500">{children}</div>
    </PortalCard>
  );
}
