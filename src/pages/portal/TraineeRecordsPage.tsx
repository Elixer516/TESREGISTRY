import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import {
  Badge,
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
import { GradeStatusBadge } from '@/components/StatusBadge';

export function TraineeRecordsPage() {
  const query = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.record() });

  if (query.isLoading) return <LoadingState label="Loading your grades…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;

  const record = query.data;

  return (
    <>
      <PageHeader title="My Grades" description="Your academic record, grouped by term." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatTile label="Total units" value={record.totalUnits} hint="Across every term" />
        <StatTile
          label="Overall average"
          value={record.overallGwa}
          hint={record.hasUnresolvedInc ? 'Held at 0.000 by an unresolved INC' : 'Unit-weighted'}
        />
      </div>

      {record.hasUnresolvedInc ? (
        <div className="mb-4">
          <InfoNote tone="warning" title="You have an unresolved INC">
            Your average reads 0.000 until it is settled. Speak to your trainer about completing
            the outstanding requirement, then the Registrar will record it.
          </InfoNote>
        </div>
      ) : null}

      {record.groups.length === 0 ? (
        <EmptyState
          title="No records yet"
          hint="Your grades will appear here once you are enrolled and your trainers have encoded them."
        />
      ) : (
        <div className="space-y-4">
          {record.groups.map((group) => (
            <Card key={group.enrollmentId}>
              <CardHeader
                title={group.academicYearLabel + ' · ' + group.termLabel}
                description={group.totalUnits + ' units · GWA ' + group.gwa}
                actions={<Badge tone="neutral">{group.status}</Badge>}
              />
              <TableWrap>
                <Table className="min-w-[36rem]">
                  <thead>
                    <tr>
                      <Th>Subject</Th>
                      <Th className="text-right">Units</Th>
                      <Th className="text-right">Grade</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id}>
                        <Td>
                          <span className="block font-medium text-ink-900">{row.subjectCode}</span>
                          <span className="block text-xs text-ink-500">{row.subjectTitle}</span>
                        </Td>
                        <Td className="text-right tabular-nums">{row.units}</Td>
                        <Td className="text-right tabular-nums font-medium text-ink-900">
                          {row.finalGrade ?? '—'}
                          {row.completionGrade ? (
                            <span className="block text-[11px] font-normal text-ink-500">
                              completed {row.completionGrade}
                            </span>
                          ) : null}
                        </Td>
                        <Td>
                          <GradeStatusBadge status={row.gradeStatus} />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
