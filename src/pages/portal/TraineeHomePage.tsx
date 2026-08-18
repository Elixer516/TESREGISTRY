import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import { Button, Card, CardHeader, InfoNote, PageHeader, StatTile } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { StudentStatusBadge } from '@/components/StatusBadge';

export function TraineeHomePage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });

  if (query.isLoading) return <LoadingState label="Loading your portal…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data || query.data.kind !== 'TRAINEE') return null;

  const data = query.data;

  return (
    <>
      <PageHeader
        title={'Welcome, ' + data.student.firstName}
        description={data.student.studentNumber + ' · ' + data.programName}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Enrolled units"
          value={data.enrolledUnits}
          hint={data.activeTerm ? data.activeTerm.label : 'No active term'}
        />
        <StatTile label="Subjects" value={data.subjectCount} hint="This term" />
        <StatTile
          label="Unread notifications"
          value={data.unreadNotifications}
          hint="Messages addressed to you"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="My enrolment" />
          <dl className="grid grid-cols-2 gap-4 p-4 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Program</dt>
              <dd className="font-medium text-ink-900">{data.programName}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Section</dt>
              <dd className="font-medium text-ink-900">{data.sectionCode ?? 'Not assigned'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Year level</dt>
              <dd className="font-medium text-ink-900">{data.student.yearLevel}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Standing</dt>
              <dd>
                <StudentStatusBadge status={data.student.status} />
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Next class"
            description="The earliest class in your published weekly schedule."
            actions={
              <Link to="/portal/schedule">
                <Button size="sm" variant="secondary">
                  Full schedule
                </Button>
              </Link>
            }
          />
          {data.nextClass ? (
            <div className="p-4">
              <p className="text-sm font-semibold text-ink-900">
                {data.nextClass.subjectCode} — {data.nextClass.subjectTitle}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {data.nextClass.dayLabel} · {data.nextClass.timeRange}
              </p>
              <p className="text-sm text-ink-500">
                {data.nextClass.room} · {data.nextClass.trainerName}
              </p>
            </div>
          ) : (
            <div className="p-4">
              <InfoNote tone="info" title="No published classes yet">
                Once the Training Department publishes your section's schedule, it will appear
                here and under My Schedule.
              </InfoNote>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
