import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluationApi } from '@/api';

/** The minimum an INC needs to be resolved: what to act on, and what to call it. */
export interface IncTarget {
  enrollmentSubjectId: string;
  subjectCode: string;
  subjectTitle: string;
}
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextArea, TextInput } from '@/components/ui';

type Exit = 'COMPLETION' | 'CORRECTION';

/**
 * The two INC exits, deliberately presented as a choice rather than one button.
 *
 * They mean different things about what happened, so merging them would lose
 * information the transcript is supposed to carry.
 */
export function IncResolutionModal({
  row,
  onClose,
  onResolved,
}: {
  row: IncTarget | null;
  onClose: () => void;
  onResolved?: () => void;
}) {
  const [exit, setExit] = useState<Exit>('COMPLETION');
  const [grade, setGrade] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (row) {
      setExit('COMPLETION');
      setGrade('');
      setRemarks('');
      setError(null);
    }
  }, [row]);

  const resolve = useMutation({
    mutationFn: () =>
      exit === 'COMPLETION'
        ? evaluationApi.completeInc(row?.enrollmentSubjectId ?? '', grade, remarks)
        : evaluationApi.correctInc(row?.enrollmentSubjectId ?? '', grade, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grade-evaluation'] });
      toast.success(
        exit === 'COMPLETION' ? 'INC completed.' : 'INC corrected.',
        exit === 'COMPLETION'
          ? 'The INC stays on the record with a completion grade beside it.'
          : 'The INC was removed and the final grade replaced.',
      );
      onResolved?.();
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      title={row ? 'Resolve INC — ' + row.subjectCode : 'Resolve INC'}
      description="Choose what actually happened. The two outcomes produce different records."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!grade || (exit === 'CORRECTION' && !remarks.trim())}
            loading={resolve.isPending}
            onClick={() => {
              setError(null);
              resolve.mutate();
            }}
          >
            {exit === 'COMPLETION' ? 'Record completion' : 'Record correction'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold text-ink-700">What happened?</legend>

          <label className="flex cursor-pointer gap-2.5 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2">
            <input
              type="radio"
              name="inc-exit"
              className="mt-1 h-4 w-4 accent-[var(--brand)]"
              checked={exit === 'COMPLETION'}
              onChange={() => setExit('COMPLETION')}
            />
            <span>
              <span className="block text-sm font-medium text-ink-900">
                Completion — the student finished the work
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                The final grade stays INC and a completion grade is added beside it, so the
                record still shows that an INC occurred.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer gap-2.5 rounded-lg border border-line bg-surface p-3 hover:bg-surface-2">
            <input
              type="radio"
              name="inc-exit"
              className="mt-1 h-4 w-4 accent-[var(--brand)]"
              checked={exit === 'CORRECTION'}
              onChange={() => setExit('CORRECTION')}
            />
            <span>
              <span className="block text-sm font-medium text-ink-900">
                Correction — the INC was recorded in error
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                The final grade is replaced outright and the INC disappears from the record,
                because it should never have been there.
              </span>
            </span>
          </label>
        </fieldset>

        <Field
          label={exit === 'COMPLETION' ? 'Completion grade' : 'Correct grade'}
          htmlFor="inc-grade"
          required
          hint="A number from 1.00 to 5.00. INC is not a valid resolution."
        >
          <TextInput
            id="inc-grade"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            placeholder="2.00"
          />
        </Field>

        <Field
          label="Remarks"
          htmlFor="inc-remarks"
          required={exit === 'CORRECTION'}
          hint={
            exit === 'CORRECTION'
              ? 'Required. A correction rewrites history, so the reason is kept with it.'
              : 'Optional. Noting what was submitted helps later readers.'
          }
        >
          <TextArea
            id="inc-remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </Field>

        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
