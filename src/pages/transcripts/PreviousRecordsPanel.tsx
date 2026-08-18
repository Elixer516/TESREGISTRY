import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transcriptsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { LoadingState } from '@/components/states';

const EMPTY = {
  schoolName: '',
  schoolYear: '',
  courseCode: '',
  courseTitle: '',
  grade: '',
  units: 3,
};

/**
 * Credited subjects from a previous school, entered by hand.
 *
 * This is the only path by which previous work reaches a transcript. The
 * uploaded PDF is never parsed, so a subject missing from this table is
 * missing from the transcript.
 */
export function PreviousRecordsPanel({ student }: { student: StudentView }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const records = useQuery({
    queryKey: ['previous-records', student.id],
    queryFn: () => transcriptsApi.listPrevious(student.id),
  });

  const add = useMutation({
    mutationFn: () => transcriptsApi.addPrevious({ studentId: student.id, ...form }),
    onSuccess: (rows) => {
      queryClient.setQueryData(['previous-records', student.id], rows);
      toast.success('Credited subject added.');
      setForm(EMPTY);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => transcriptsApi.removePrevious(id),
    onSuccess: (rows) => {
      queryClient.setQueryData(['previous-records', student.id], rows);
      toast.success('Credited subject removed.');
    },
    onError: (caught) => toast.error('Could not remove that row.', errorMessage(caught)),
  });

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const rows = records.data ?? [];
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);

  return (
    <Card>
      <CardHeader
        title="Previous school records"
        description={
          rows.length + ' credited subject(s) · ' + totalUnits + ' units. These are what appear on the transcript.'
        }
      />

      <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="School" htmlFor="psr-school" required className="sm:col-span-2">
          <TextInput
            id="psr-school"
            value={form.schoolName}
            onChange={(e) => set('schoolName', e.target.value)}
            placeholder="Davao Central College"
          />
        </Field>
        <Field label="School year" htmlFor="psr-year">
          <TextInput
            id="psr-year"
            value={form.schoolYear}
            onChange={(e) => set('schoolYear', e.target.value)}
            placeholder="2023-2024"
          />
        </Field>
        <Field label="Course code" htmlFor="psr-code" required>
          <TextInput
            id="psr-code"
            value={form.courseCode}
            onChange={(e) => set('courseCode', e.target.value)}
            placeholder="IT111"
          />
        </Field>
        <Field label="Grade" htmlFor="psr-grade" required>
          <TextInput
            id="psr-grade"
            value={form.grade}
            onChange={(e) => set('grade', e.target.value)}
            placeholder="1.75"
          />
        </Field>
        <Field label="Units" htmlFor="psr-units" required>
          <TextInput
            id="psr-units"
            type="number"
            min={1}
            value={form.units}
            onChange={(e) => set('units', Number(e.target.value))}
          />
        </Field>
        <Field label="Course title" htmlFor="psr-title" required className="sm:col-span-3 lg:col-span-5">
          <TextInput
            id="psr-title"
            value={form.courseTitle}
            onChange={(e) => set('courseTitle', e.target.value)}
            placeholder="Introduction to Information Technology"
          />
        </Field>
        <div className="flex items-end">
          <Button
            variant="primary"
            className="w-full"
            loading={add.isPending}
            onClick={() => {
              setError(null);
              add.mutate();
            }}
          >
            Add row
          </Button>
        </div>
      </div>

      {error ? (
        <div className="p-4">
          <InfoNote tone="danger">{error}</InfoNote>
        </div>
      ) : null}

      {records.isLoading ? (
        <div className="p-4">
          <LoadingState label="Loading credited subjects…" rows={2} />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-ink-500">
          No credited subjects yet. Anything not entered here will not appear on the transcript,
          however complete the uploaded PDF may be.
        </p>
      ) : (
        <TableWrap>
          <Table className="min-w-[46rem]">
            <thead>
              <tr>
                <Th>School</Th>
                <Th>School year</Th>
                <Th>Course</Th>
                <Th className="text-right">Units</Th>
                <Th className="text-right">Grade</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Td>{row.schoolName}</Td>
                  <Td>{row.schoolYear || '—'}</Td>
                  <Td>
                    <span className="block font-medium text-ink-900">{row.courseCode}</span>
                    <span className="block text-xs text-ink-500">{row.courseTitle}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{row.units}</Td>
                  <Td className="text-right tabular-nums">{row.grade}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(row.id)}>
                      Remove
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
