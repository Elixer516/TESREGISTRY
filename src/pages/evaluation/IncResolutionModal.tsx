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
import { gradeDescriptor, parsePercentage } from '@/server/services/grade-rules';
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
  const [percentage, setPercentage] = useState('');
  // The grade point the percentage transmutes to, shown as it is typed so
  // the registrar sees exactly what will be recorded before confirming.
  const preview = parsePercentage(percentage);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (row) {
      setExit('COMPLETION');
      setPercentage('');
      setRemarks('');
      setError(null);
    }
  }, [row]);

  const resolve = useMutation({
    mutationFn: () =>
      exit === 'COMPLETION'
        ? evaluationApi.completeInc(row?.enrollmentSubjectId ?? '', percentage, remarks)
        : evaluationApi.correctInc(row?.enrollmentSubjectId ?? '', percentage, remarks),
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
            disabled={
              !preview.ok || preview.grade === null || (exit === 'CORRECTION' && !remarks.trim())
            }
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
          label={exit === 'COMPLETION' ? 'Completion percentage' : 'Correct percentage'}
          htmlFor="inc-percentage"
          required
          hint="The trainee's percentage, 0 to 100. The grade is worked out from it."
          error={preview.ok ? null : preview.message}
        >
          <div className="flex items-center gap-3">
            <div className="relative w-32">
              <TextInput
                id="inc-percentage"
                inputMode="decimal"
                value={percentage}
                onChange={(event) => setPercentage(event.target.value)}
                placeholder="85"
                className="pr-7"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-500">
                %
              </span>
            </div>
            <span className="text-sm text-ink-700">
              {preview.ok && preview.grade ? (
                <>
                  Grade <strong className="tabular-nums text-ink-900">{preview.grade}</strong>
                  <span className="text-ink-500"> · {gradeDescriptor(preview.grade)}</span>
                </>
              ) : (
                <span className="text-ink-400">Grade appears here</span>
              )}
            </span>
          </div>
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
