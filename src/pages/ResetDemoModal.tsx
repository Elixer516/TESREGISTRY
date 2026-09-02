import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { demoApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextInput } from '@/components/ui';

const PHRASE = 'RESET DEMO';

/**
 * Restore the prepared demonstration state.
 *
 * Guarded twice — a typed phrase and the registrar's own password — because
 * the cost of an accidental press is the entire demonstration, and it is
 * reached from the dashboard the registrar lands on. Neither guard is
 * security; both are friction, deliberately placed where a stray click would
 * otherwise land.
 *
 * Worth saying out loud to a panel: this is safe precisely because the data
 * lives in this browser. It restores one machine and reaches nobody else's.
 */
export function ResetDemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setPhrase('');
      setPassword('');
      setError(null);
    }
  }, [open]);

  const reset = useMutation({
    mutationFn: () => demoApi.reset(phrase, password),
    onSuccess: (summary) => {
      // Everything on screen is now describing records that no longer exist.
      void queryClient.invalidateQueries();
      toast.success(
        'Demonstration data restored.',
        `${summary.students} trainees, ${summary.enrollments} enrolments. Open: ${summary.openSemesters.join(' · ')}.`,
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset Demonstration Data?"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={reset.isPending}
            disabled={phrase.trim().toUpperCase() !== PHRASE || password.length === 0}
            onClick={() => {
              setError(null);
              reset.mutate();
            }}
          >
            Restore demonstration data
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-700">
        <p>
          This restores the system to the prepared demonstration state. Student, enrolment,
          grade and application records created since then are removed, while the prepared
          demonstration data and all system configuration are put back exactly as they were.
        </p>

        <InfoNote tone="info" title="What comes back">
          <ul className="list-inside list-disc space-y-1">
            <li>A clean Pending tab, ready for a fresh application</li>
            <li>The continuing trainee, with their finished semester and grades intact</li>
            <li>Diplomas, curricula, subjects, class schedules and every account</li>
          </ul>
        </InfoNote>

        <p className="font-medium text-ink-900">This action cannot be undone.</p>

        <Field
          label={`Type ${PHRASE} to confirm`}
          htmlFor="reset-phrase"
          required
          hint="Case does not matter."
        >
          <TextInput
            id="reset-phrase"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder={PHRASE}
            autoComplete="off"
          />
        </Field>

        <Field label="Your password" htmlFor="reset-password" required>
          <TextInput
            id="reset-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
