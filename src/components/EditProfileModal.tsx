/**
 * "Edit my details" — the signed-in person's own name, title and position.
 *
 * These are what the printed forms put on the signature lines, so the person
 * whose name it is keeps them right. Role and email are shown but not
 * editable: one decides what the account may do, the other is the login.
 */

import { useEffect, useState } from 'react';
import { ROLE_LABELS } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextInput } from './ui';

export function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState({ firstName: '', lastName: '', title: '', position: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Start from what is saved each time the dialog opens, so a cancelled edit
  // is not still sitting there next time.
  useEffect(() => {
    if (!open || !user) return;
    setDraft({
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title,
      position: user.position,
    });
    setError(null);
  }, [open, user]);

  if (!user) return null;

  const set = (key: keyof typeof draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: event.target.value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile(draft);
      toast.success('Your details are saved.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit my details"
      description="How your name and position print on the forms you sign."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Title" hint="e.g. Ms., Mr., Engr., Dr." htmlFor="profile-title">
          <TextInput id="profile-title" value={draft.title} onChange={set('title')} />
        </Field>
        <Field label="Position" hint="e.g. Registrar II" htmlFor="profile-position">
          <TextInput id="profile-position" value={draft.position} onChange={set('position')} />
        </Field>
        <Field label="First name" required htmlFor="profile-first">
          <TextInput id="profile-first" value={draft.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Last name" required htmlFor="profile-last">
          <TextInput id="profile-last" value={draft.lastName} onChange={set('lastName')} />
        </Field>
        <p className="text-xs text-ink-500 sm:col-span-2">
          Signed in as <span className="font-medium text-ink-700">{user.email}</span> ·{' '}
          {ROLE_LABELS[user.role]}. Your role controls what you can do and is set by the
          administrator, not here.
        </p>
        {error ? (
          <div className="sm:col-span-2">
            <InfoNote tone="danger">{error}</InfoNote>
          </div>
        ) : null}
        {/* Lets Enter submit from any field. */}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

