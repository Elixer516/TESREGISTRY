import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesApi } from '@/api';
import type { StudentView } from '@/types/views';
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

/** One student's subjects for one term — only what they are enrolled in. */
export function StudentGradePanel({
  student,
  semesterId,
  onPickStudent,
}: {
  student: StudentView | null;
  semesterId: string | null;
  onPickStudent: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const sheet = useQuery({
    queryKey: ['student-grade-sheet', student?.id, semesterId],
    queryFn: () => gradesApi.studentSheet(student?.id ?? '', semesterId ?? ''),
    enabled: Boolean(student && semesterId),
  });

  useEffect(() => {
    setDrafts({});
    setError(null);
  }, [student?.id, semesterId]);

  const save = useMutation({
    mutationFn: (entries: Array<{ enrollmentSubjectId: string; finalGrade: string | null }>) =>
      gradesApi.save(entries),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['student-grade-sheet'] });
      queryClient.invalidateQueries({ queryKey: ['academic-record'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(count + ' grade(s) saved.');
      setDrafts({});
    },
    onError: (caught) => setError(caught),
  });

  if (!student) {
    return (
      <EmptyState
        title="Choose a student"
        hint="Search by name or student number, then pick the term. Only subjects on their enrollment appear."
        action={
          <Button variant="primary" onClick={onPickStudent}>
            Find a student
          </Button>
        }
      />
    );
  }

  if (sheet.isLoading) return <LoadingState label="Loading enrolled subjects…" />;
  if (sheet.error) return <ErrorState error={sheet.error} onRetry={() => sheet.refetch()} />;
  if (!sheet.data) return null;

  const data = sheet.data;
  const dirty = Object.keys(drafts);
  const currentValue = (id: string, stored: string | null) =>
    drafts[id] !== undefined ? drafts[id] : (stored ?? '');

  const saveOne = (id: string) => {
    setError(null);
    save.mutate([
      {
        enrollmentSubjectId: id,
        finalGrade: (drafts[id] ?? '').trim() === '' ? null : drafts[id],
      },
    ]);
  };

  return (
    <Card>
      <CardHeader
        title={data.student.fullName}
        description={
          data.student.studentNumber +
          ' · ' +
          data.student.programCode +
          ' · ' +
          data.semester.label
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
            Save all {dirty.length > 0 ? '(' + dirty.length + ')' : ''}
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
            title="No subjects to grade"
            hint="This student has no enrolled subjects you can encode for this term. Check the term, or enroll them first."
          />
        </div>
      ) : (
        <TableWrap>
          <Table className="min-w-[46rem]">
            <thead>
              <tr>
                <Th>Subject</Th>
                <Th className="text-right">Units</Th>
                <Th className="w-32">Grade</Th>
                <Th>Status</Th>
                <Th className="text-right">Save</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.enrollmentSubjectId}>
                  <Td>
                    <span className="block font-medium text-ink-900">{row.subjectCode}</span>
                    <span className="block text-xs text-ink-500">{row.subjectTitle}</span>
                    {row.scheduleLabel ? (
                      <span className="block text-[11px] text-ink-400">{row.scheduleLabel}</span>
                    ) : null}
                  </Td>
                  <Td className="text-right tabular-nums">{row.units}</Td>
                  <Td>
                    <TextInput
                      value={currentValue(row.enrollmentSubjectId, row.finalGrade)}
                      disabled={!data.canEncode}
                      placeholder="1.00–5.00 or INC"
                      aria-label={'Grade for ' + row.subjectCode}
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
                    {row.completionGrade ? (
                      <span className="mt-1 block text-[11px] text-ink-500">
                        Completed with {row.completionGrade}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!data.canEncode || drafts[row.enrollmentSubjectId] === undefined}
                      onClick={() => saveOne(row.enrollmentSubjectId)}
                    >
                      Save
                    </Button>
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
