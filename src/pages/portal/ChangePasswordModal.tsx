import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { errorMessage } from '@/lib/api-error';
import { DEFAULT_TRAINEE_PASSWORD, MIN_PASSWORD_LENGTH } from '@/lib/passwords';
import { Button, Field, InfoNote, Modal, TextInput } from '@/components/ui';

/** A trainee changing their own password, any time after the first. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  }, [open]);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== next;
  const isDefault = next === DEFAULT_TRAINEE_PASSWORD;

  const save = async () => {
    setError(null);
    setPending(true);
    try {
      await changePassword(current, next);
      toast.success('Your password is changed.');
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={pending}
            disabled={!current || !next || !confirm || tooShort || mismatch || isDefault}
            onClick={save}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Current password" htmlFor="cp-current" required>
          <TextInput id="cp-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field
          label="New password"
          htmlFor="cp-new"
          required
          hint={`At least ${MIN_PASSWORD_LENGTH} characters, and not the default.`}
          error={tooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : isDefault ? 'Choose something other than the default.' : null}
        >
          <TextInput id="cp-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" htmlFor="cp-confirm" required error={mismatch ? 'Does not match.' : null}>
          <TextInput id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
