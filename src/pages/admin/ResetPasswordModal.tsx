import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api';
import type { UserView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextInput } from '@/components/ui';

export function ResetPasswordModal({
  user,
  onClose,
}: {
  user: UserView | null;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (user) {
      setNewPassword('');
      setAdminPassword('');
      setError(null);
    }
  }, [user]);

  const reset = useMutation({
    mutationFn: () => usersApi.resetPassword(user?.id ?? '', newPassword, adminPassword),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Password reset for ' + updated.email + '.', 'Any lockout was cleared.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={user ? 'Reset password — ' + user.fullName : 'Reset password'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={newPassword.length < 8 || !adminPassword}
            loading={reset.isPending}
            onClick={() => {
              setError(null);
              reset.mutate();
            }}
          >
            Reset password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="New password"
          htmlFor="rp-new"
          required
          hint="At least 8 characters. Resetting also clears any failed-login lockout."
        >
          <TextInput
            id="rp-new"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
        <Field label="Your administrator password" htmlFor="rp-admin" required>
          <TextInput
            id="rp-admin"
            type="password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
          />
        </Field>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
