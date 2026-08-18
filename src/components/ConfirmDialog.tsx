import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Field, Modal, TextInput } from './ui';

/**
 * Confirmation for destructive actions.
 *
 * When `requirePassword` is set the actor must re-enter their own password —
 * used wherever an unattended workstation would otherwise be enough.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  requirePassword = false,
  passwordLabel = 'Your password',
  passwordHint,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  requirePassword?: boolean;
  passwordLabel?: string;
  passwordHint?: string;
  loading?: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setPassword('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      initialFocusRef={requirePassword ? inputRef : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={requirePassword && password.length === 0}
            onClick={() => onConfirm(password)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-700">
        <div>{message}</div>
        {requirePassword ? (
          <Field
            label={passwordLabel}
            htmlFor="confirm-password"
            hint={
              passwordHint ??
              'Re-entering your password confirms it is really you making this change.'
            }
          >
            <TextInput
              id="confirm-password"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && password) onConfirm(password);
              }}
            />
          </Field>
        ) : null}
      </div>
    </Modal>
  );
}
