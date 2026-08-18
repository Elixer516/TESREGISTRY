import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesApi } from '@/api';
import type { ClassScheduleView } from '@/types/views';
import { errorMessage, isApiError } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  InfoNote,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { GradeStatusBadge } from '@/components/StatusBadge';

/** The whole roster of one class, editable in place. */
export function ClassRosterPanel({
  schedule,
  onPickClass,
}: {
  schedule: ClassScheduleView | null;
  onPickClass: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const roster = useQuery({
    queryKey: ['class-roster', schedule?.id],
    queryFn: () => gradesApi.classRoster(schedule?.id ?? ''),
    enabled: Boolean(schedule),
  });

  useEffect(() => {
    setDrafts({});
    setError(null);
  }, [schedule?.id]);

  const save = useMutation({
    mutationFn: (entries: Array<{ enrollmentSubjectId: string; finalGrade: string | null }>) =>
      gradesApi.save(entries),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['class-roster'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['academic-record'] });
      toast.success(count + ' grade(s) saved.');
      setDrafts({});
    },
    onError: (caught) => setError(caught),
  });

  if (!schedule) {
    return (
      <EmptyState
        title="Choose a class"
        hint="Pick the school year and term on the left, then search for the class you are encoding."
        action={
          <Button variant="primary" onClick={onPickClass}>
            Find a class
          </Button>
        }
      />
    );
  }

  if (roster.isLoading) return <LoadingState label="Loading the roster…" />;
  if (roster.error) return <ErrorState error={roster.error} onRetry={() => roster.refetch()} />;
  if (!roster.data) return null;

  const data = roster.data;
  const dirty = Object.keys(drafts);

  const currentValue = (id: string, stored: string | null) =>
    drafts[id] !== undefined ? drafts[id] : (stored ?? '');

  return (
    <Card>
      <CardHeader
        title={data.schedule.subjectCode + ' — ' + data.schedule.subjectTitle}
        description={
          data.schedule.sectionCode +
          ' · ' +
          data.schedule.dayPattern +
          ' ' +
          data.schedule.timeRange +
          ' · ' +
          data.schedule.room +
          ' · ' +
          data.schedule.trainerName
        }
        actions={
          <Button
            variant="primary"
            disabled={!data.canEncode || dirty.length === 0}
            loading={save.isPending}
            onClick={() => {
              setError(null);
              save.mutate(
                dirty.map((id) => ({
                  enrollmentSubjectId: id,
                  finalGrade: drafts[id].trim() === '' ? null : drafts[id],
                })),
              );
            }}
          >
            Save {dirty.length > 0 ? dirty.length + ' change(s)' : 'changes'}
          </Button>
        }
      />

      {data.encodingBlockedReason ? (
        <div className="p-4">
          <InfoNote tone="warning" title="Read-only">
            {data.encodingBlockedReason}
          </InfoNote>
        </div>
      ) : null}

      {error ? (
        <div className="p-4">
          <InfoNote tone="danger" title="Nothing was saved">
            <p>{errorMessage(error)}</p>
            {isApiError(error) && error.details ? (
              <ul className="mt-2 list-inside list-disc space-y-0.5">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </InfoNote>
        </div>
      ) : null}

      {data.rows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="Nobody is enrolled in this class"
            hint="Enroll students into the term first — a grade can only exist against an enrollment."
          />
        </div>
      ) : (
        <TableWrap>
          <Table className="min-w-[42rem]">
            <thead>
              <tr>
                <Th>Student</Th>
                <Th className="text-right">Units</Th>
                <Th className="w-32">Grade</Th>
                <Th>Status</Th>
                <Th>Remarks</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.enrollmentSubjectId}>
                  <Td>
                    <span className="block font-medium text-ink-900">{row.studentName}</span>
                    <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{row.units}</Td>
                  <Td>
                    <TextInput
                      value={currentValue(row.enrollmentSubjectId, row.finalGrade)}
                      disabled={!data.canEncode}
                      placeholder="1.00–5.00 or INC"
                      aria-label={'Grade for ' + row.studentName}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.enrollmentSubjectId]: event.target.value,
                        }))
                      }
                    />
                  </Td>
                  <Td>
                    <GradeStatusBadge status={row.gradeStatus} />
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {row.completionGrade ? 'INC completed with ' + row.completionGrade : row.remarks}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}
