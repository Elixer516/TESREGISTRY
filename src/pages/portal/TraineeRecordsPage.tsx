import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
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

export function TraineeRecordsPage() {
  const query = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.evaluation() });
  const queryClient = useQueryClient();
  const toast = useToast();
  // Confirming is what lets the Registrar enrol the trainee into their next
  // semester, so it is a deliberate press on each finished term.
  const confirm = useMutation({
    mutationFn: (enrollmentId: string) => mineApi.confirmGradesViewed(enrollmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-record'] });
      toast.success('Thank you — the Registrar can now see that you have viewed these grades.');
    },
    onError: (error) => toast.error('Could not confirm.', errorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Loading your grades…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;

  const record = query.data;
  const pendingTerms = record.groups.filter((g) => g.gradesViewPending);

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

      {pendingTerms.length > 0 ? (
        <div className="mb-4">
          <InfoNote tone="warning" title="Please confirm you have viewed your grades">
            Review the grades below, then press <strong>I have viewed these grades</strong> on{' '}
            {pendingTerms.length === 1 ? 'the term' : `each of the ${pendingTerms.length} terms`}{' '}
            marked. The Registrar cannot enroll you in your next semester until you do.
          </InfoNote>
        </div>
      ) : null}

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
            <Card key={group.semesterId}>
              <CardHeader
                title={group.academicYearLabel + ' · ' + group.label}
                description={group.totalUnits + ' units · GWA ' + group.gwa}
                actions={
                  group.gradesViewPending ? (
                    <Button
                      size="sm"
                      variant="primary"
                      loading={confirm.isPending && confirm.variables === group.enrollmentId}
                      onClick={() => confirm.mutate(group.enrollmentId)}
                    >
                      I have viewed these grades
                    </Button>
                  ) : group.gradesViewedAt ? (
                    <Badge tone="success">Viewed {formatDateTime(group.gradesViewedAt)}</Badge>
                  ) : null
                }
              />
              <TableWrap>
                <Table className="min-w-[36rem]">
                  <thead>
                    <tr>
                      <Th>Subject</Th>
                      <Th className="text-right">Grade</Th>
                      <Th className="text-right">Units</Th>
                      <Th className="text-right">Completion</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.enrollmentSubjectId}>
                        <Td>
                          <span className="block font-medium text-ink-900">{row.courseCode}</span>
                          <span className="block text-xs text-ink-500">{row.courseTitle}</span>
                        </Td>
                        <Td className="text-right tabular-nums font-medium text-ink-900">
                          {row.grade ?? '—'}
                        </Td>
                        <Td className="text-right tabular-nums">{row.units}</Td>
                        <Td className="text-right tabular-nums">
                          {row.completionGrade ?? ''}
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
