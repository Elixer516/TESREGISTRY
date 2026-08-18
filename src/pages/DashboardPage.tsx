import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api';
import type {
  AdminDashboard,
  DashboardPayload,
  RegistrarDashboard,
  StatCard,
  TrainerDashboard,
  TrainingDashboard,
} from '@/types/views';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  InfoNote,
  PageHeader,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';

export function DashboardPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });

  if (query.isLoading) return <LoadingState label="Building your dashboard…" rows={4} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;

  const data: DashboardPayload = query.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={user ? 'Signed in as ' + user.firstName + ' ' + user.lastName + '.' : ''}
      />
      {data.kind === 'REGISTRAR' ? <RegistrarView data={data} /> : null}
      {data.kind === 'TRAINING_OFFICER' ? <TrainingView data={data} /> : null}
      {data.kind === 'TRAINER' ? <TrainerView data={data} /> : null}
      {data.kind === 'IT_ADMIN' ? <AdminView data={data} /> : null}
    </>
  );
}

function StatGrid({ stats }: { stats: StatCard[] }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <StatTile key={stat.key} label={stat.label} value={stat.value} hint={stat.hint} />
      ))}
    </div>
  );
}

function RegistrarView({ data }: { data: RegistrarDashboard }) {
  return (
    <>
      <StatGrid stats={data.stats} />

      {!data.activeTerm ? (
        <div className="mb-5">
          <InfoNote tone="warning" title="No active term">
            Grade encoding stays closed until a term is activated under School Years and Terms.
          </InfoNote>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently enrolled"
            description="The last enrollments recorded, newest first."
            actions={
              <Link to="/enrollment">
                <Button size="sm" variant="secondary">
                  Enroll a student
                </Button>
              </Link>
            }
          />
          {data.recentlyEnrolled.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No enrollments yet"
                hint="Approve an application first, then enroll the student into the active term."
              />
            </div>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Program</Th>
                    <Th>Term</Th>
                    <Th className="text-right">Units</Th>
                    <Th>Enrolled</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentlyEnrolled.map((row) => (
                    <tr key={row.enrollmentId}>
                      <Td>
                        <span className="block font-medium text-ink-900">{row.studentName}</span>
                        <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                      </Td>
                      <Td>{row.programCode}</Td>
                      <Td>{row.termLabel}</Td>
                      <Td className="text-right tabular-nums">{row.units}</Td>
                      <Td className="text-xs text-ink-500">{relativeTime(row.enrolledAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Quick actions" />
            <div className="flex flex-col gap-2 p-4">
              <Link to="/students" className="w-full">
                <Button variant="primary" className="w-full">Review applications</Button>
              </Link>
              <Link to="/enrollment" className="w-full">
                <Button variant="secondary" className="w-full">Enroll a student</Button>
              </Link>
              <Link to="/grades" className="w-full">
                <Button variant="secondary" className="w-full">Encode grades</Button>
              </Link>
              <Link to="/documents" className="w-full">
                <Button variant="secondary" className="w-full">Process document requests</Button>
              </Link>
              <Link to="/instructions" className="w-full">
                <Button variant="ghost" className="w-full">Open the Instructions Center</Button>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Pending applications"
              description={data.activeTerm ? 'Active term: ' + data.activeTerm.label : undefined}
            />
            {data.pendingApplications.length === 0 ? (
              <p className="p-4 text-sm text-ink-500">Nothing waiting for approval.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.pendingApplications.map((student) => (
                  <li key={student.id} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-ink-900">{student.fullName}</p>
                    <p className="text-xs text-ink-500">
                      {student.studentNumber} · {student.programCode}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function TrainingView({ data }: { data: TrainingDashboard }) {
  return (
    <>
      <StatGrid stats={data.stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recently touched schedules"
            description="Draft rows are visible to the Training Department only."
            actions={
              <Link to="/schedules">
                <Button size="sm" variant="secondary">Open schedules</Button>
              </Link>
            }
          />
          {data.recentSchedules.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">No schedules have been created yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentSchedules.map((schedule) => (
                <li key={schedule.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {schedule.subjectCode} · {schedule.sectionCode}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {schedule.dayPattern} {schedule.timeRange} · {schedule.room}
                    </p>
                  </div>
                  <Badge tone={schedule.status === 'PUBLISHED' ? 'success' : 'warning'}>
                    {schedule.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Availability awaiting review"
            description="Marking a submission incorporated creates no schedule by itself."
            actions={
              <Link to="/availability">
                <Button size="sm" variant="secondary">Review</Button>
              </Link>
            }
          />
          {data.pendingAvailability.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">Nothing waiting for review.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.pendingAvailability.map((row) => (
                <li key={row.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-ink-900">{row.facultyName}</p>
                  <p className="text-xs text-ink-500">
                    {row.semesterLabel} · {row.dayPattern} {row.timeRange}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function TrainerView({ data }: { data: TrainerDashboard }) {
  return (
    <>
      <StatGrid stats={data.stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="My classes"
            description={data.activeTerm ? data.activeTerm.label : 'No active term'}
          />
          {data.myClasses.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">
              No published classes are assigned to you for the active term.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.myClasses.map((schedule) => (
                <li key={schedule.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-ink-900">
                    {schedule.subjectCode} — {schedule.subjectTitle}
                  </p>
                  <p className="text-xs text-ink-500">
                    {schedule.sectionCode} · {schedule.dayPattern} {schedule.timeRange} · {schedule.room}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Grades still to encode"
            actions={
              <Link to="/grades">
                <Button size="sm" variant="primary">Encode grades</Button>
              </Link>
            }
          />
          {data.pendingGrades.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">
              Every enrolled subject in your classes already has a grade.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.pendingGrades.map((row) => (
                <li
                  key={row.scheduleId}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-sm text-ink-900">
                    {row.subjectCode} · {row.sectionCode}
                  </span>
                  <Badge tone="warning">
                    {row.ungraded} of {row.total} pending
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function AdminView({ data }: { data: AdminDashboard }) {
  return (
    <>
      <StatGrid stats={data.stats} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Accounts pending approval"
            description="These accounts cannot sign in until they are reviewed."
            actions={
              <Link to="/users">
                <Button size="sm" variant="secondary">Manage users</Button>
              </Link>
            }
          />
          {data.pendingAccounts.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">No accounts are waiting for review.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.pendingAccounts.map((account) => (
                <li key={account.id} className="px-4 py-2.5">
                  <p className="text-sm font-medium text-ink-900">{account.fullName}</p>
                  <p className="text-xs text-ink-500">
                    {account.email} · {account.roleLabel}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            actions={
              <Link to="/audit">
                <Button size="sm" variant="secondary">Full audit log</Button>
              </Link>
            }
          />
          <ul className="divide-y divide-line">
            {data.recentActivity.map((entry) => (
              <li key={entry.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{entry.actionLabel}</Badge>
                  <span className="text-xs text-ink-400">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-ink-700">{entry.detail}</p>
                <p className="text-xs text-ink-500">{entry.userLabel}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
