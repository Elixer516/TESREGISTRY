import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { errorMessage } from '@/lib/api-error';
import { passwordProblem } from '@/lib/passwords';
import { PasswordField } from '@/components/PasswordField';
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

  const weak = passwordProblem(next) !== null;
  const mismatch = confirm.length > 0 && confirm !== next;

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
            disabled={!current || !next || !confirm || weak || mismatch}
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
        <PasswordField id="cp-new" label="New password" value={next} onChange={setNext} />
        <Field label="Confirm new password" htmlFor="cp-confirm" required error={mismatch ? 'Does not match.' : null}>
          <TextInput id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
