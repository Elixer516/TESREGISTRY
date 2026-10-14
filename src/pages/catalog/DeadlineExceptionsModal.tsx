import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SemesterView } from '@/types/views';
import { gradeDeadlinesApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, Table, TableWrap, Td, TextInput, Th } from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * Grade deadlines that differ from the semester's: for one subject, one
 * batch (year admitted), or one subject of one batch. The most specific
 * one that matches a class is the one its trainer counts down to.
 */
export function DeadlineExceptionsModal({ semester, onClose }: { semester: SemesterView | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [subjectId, setSubjectId] = useState('');
  const [batch, setBatch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['deadline-overrides', semester?.id],
    queryFn: () => gradeDeadlinesApi.overrides(semester?.id ?? ''),
    enabled: Boolean(semester),
  });

  const after = (data: Awaited<ReturnType<typeof gradeDeadlinesApi.overrides>>) => {
    queryClient.setQueryData(['deadline-overrides', semester?.id], data);
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['grading-sheets'] });
    queryClient.invalidateQueries({ queryKey: ['grade-deadline-alerts'] });
  };
  const add = useMutation({
    mutationFn: () =>
      gradeDeadlinesApi.addOverride({
        semesterId: semester?.id ?? '',
        subjectId: subjectId || null,
        batch: batch || null,
        dueDate,
      }),
    onSuccess: (data) => {
      after(data);
      toast.success('Deadline set.');
      setSubjectId('');
      setBatch('');
      setDueDate('');
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => gradeDeadlinesApi.removeOverride(id),
    onSuccess: after,
    onError: (caught) => toast.error('Could not remove it.', errorMessage(caught)),
  });

  const data = list.data;
  return (
    <Modal
      open={semester !== null}
      onClose={onClose}
      size="lg"
      title="Grade deadlines by subject or batch"
      description={
        semester
          ? `${semester.label} · the semester's own deadline is ${semester.gradesDueDate ? formatDate(semester.gradesDueDate) : 'not set'}`
          : undefined
      }
    >
      <QueryState isLoading={list.isLoading} error={list.error} onRetry={() => list.refetch()}>
        {data ? (
          <div className="space-y-4">
            {data.overrides.length === 0 ? (
              <p className="text-sm text-ink-500">Every class of this semester follows the semester's deadline.</p>
            ) : (
              <TableWrap>
                <Table className="min-w-[30rem]">
                  <thead>
                    <tr>
                      <Th>Subject</Th>
                      <Th>Batch</Th>
                      <Th>Grades due</Th>
                      <Th className="text-right"> </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overrides.map((o) => (
                      <tr key={o.id}>
                        <Td>{o.subjectLabel}</Td>
                        <Td>{o.batch ? `Batch ${o.batch}` : 'All batches'}</Td>
                        <Td className="font-medium">{formatDate(o.dueDate)}</Td>
                        <Td className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => remove.mutate(o.id)}>
                            Remove
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}

            <div className="rounded-lg border border-line p-3">
              <p className="mb-2 text-sm font-semibold text-ink-900">Add a deadline</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Subject" htmlFor="ov-subject">
                  <Select id="ov-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">All subjects</option>
                    {data.subjects.map((s) => (
                      <option key={s.subjectId} value={s.subjectId}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Batch" htmlFor="ov-batch">
                  <Select id="ov-batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
                    <option value="">All batches</option>
                    {data.batches.map((b) => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Grades due" htmlFor="ov-date">
                  <TextInput id="ov-date" type="date" value={dueDate} min={semester?.startDate} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              </div>
              {error ? (
                <div className="mt-2">
                  <InfoNote tone="danger">{error}</InfoNote>
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" loading={add.isPending} disabled={!dueDate || (!subjectId && !batch)} onClick={() => add.mutate()}>
                  Set deadline
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
