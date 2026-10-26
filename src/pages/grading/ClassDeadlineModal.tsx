import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradeDeadlinesApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextInput } from '@/components/ui';

const SOURCE_WORDING = {
  CLASS: 'Set for this class',
  EXCEPTION: 'From an exception for its subject or batch',
  SEMESTER: "The semester's deadline",
  NONE: 'No deadline set',
} as const;

/**
 * The Registrar sets, moves or removes one class's grade deadline, right
 * from Grading Sheets — say, to give a trainer who asked a few more days.
 * Removing it puts the class back on the semester's deadline.
 */
export function ClassDeadlineModal({
  classScheduleId,
  onClose,
}: {
  classScheduleId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = useQuery({
    queryKey: ['class-deadline', classScheduleId],
    queryFn: () => gradeDeadlinesApi.classDeadline(classScheduleId ?? ''),
    enabled: classScheduleId !== null,
  });

  useEffect(() => {
    setError(null);
    setDate(current.data?.dueDate ?? '');
  }, [current.data, classScheduleId]);

  const save = useMutation({
    mutationFn: (dueDate: string | null) => gradeDeadlinesApi.setClassDeadline(classScheduleId ?? '', dueDate),
    onSuccess: (view, dueDate) => {
      // Badges, alerts, the dashboard and the head trainer's view all show it.
      void queryClient.invalidateQueries();
      toast.success(
        dueDate === null ? 'Deadline removed.' : 'Deadline set.',
        view.dueDate ? `${view.classLabel}: grades due ${formatDate(view.dueDate)}.` : `${view.classLabel}: no deadline.`,
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const data = current.data;
  return (
    <Modal
      open={classScheduleId !== null}
      onClose={onClose}
      title="Set grade deadline"
      description={data ? `${data.classLabel} — ${data.semesterLabel}` : undefined}
      size="sm"
      footer={
        <>
          {data?.source === 'CLASS' ? (
            <Button variant="ghost" className="mr-auto" loading={save.isPending && save.variables === null} onClick={() => save.mutate(null)}>
              Use the semester's deadline
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending && save.variables !== null}
            disabled={!date || date === data?.dueDate}
            onClick={() => {
              setError(null);
              save.mutate(date);
            }}
          >
            Save deadline
          </Button>
        </>
      }
    >
      {data ? (
        <div className="space-y-4 text-sm">
          <p className="text-ink-700">
            Now:{' '}
            <span className="font-semibold text-ink-900">
              {data.dueDate ? formatDate(data.dueDate) : 'none'}
            </span>{' '}
            <span className="text-ink-500">({SOURCE_WORDING[data.source]})</span>
          </p>
          <Field
            label="Grades due on"
            htmlFor="class-deadline"
            hint="Only this class. Every other class keeps its own deadline."
          >
            <TextInput
              id="class-deadline"
              type="date"
              value={date}
              min={data.semesterStartDate}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          {data.source === 'CLASS' && data.fallbackDueDate ? (
            <p className="text-xs text-ink-500">
              Without its own date, this class would be due {formatDate(data.fallbackDueDate)}.
            </p>
          ) : null}
          {error ? <InfoNote tone="danger" title="Could not save">{error}</InfoNote> : null}
        </div>
      ) : (
        <p className="text-sm text-ink-500">{current.error ? errorMessage(current.error) : 'Loading…'}</p>
      )}
    </Modal>
  );
}
