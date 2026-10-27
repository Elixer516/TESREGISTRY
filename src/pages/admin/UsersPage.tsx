import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@/types';
import { ALL_ROLES, ROLE_LABELS } from '@/types';
import type { UserAccountView } from '@/types/views';
import { usersApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime, classNames } from '@/lib/format';
import { passwordProblem } from '@/lib/passwords';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Tabs,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordField } from '@/components/PasswordField';

type TabValue = 'ALL' | 'STAFF' | 'TRAINEE' | 'DEACTIVATED';

/** Every role, in the order the role box lists them. */
const ROLE_ORDER: Role[] = ['REGISTRAR', 'TRAINER', 'IT_ADMIN', 'TRAINEE'];

const ROLE_TONE: Record<Role, 'brand' | 'info' | 'neutral' | 'warning'> = {
  REGISTRAR: 'brand',
  TRAINER: 'info',
  TRAINEE: 'neutral',
  IT_ADMIN: 'warning',
};

/**
 * The IT Administrator's accounts: every sign-in in the system. Create an
 * account with its first password, edit it, set a new password for someone
 * who has forgotten theirs, deactivate or reactivate it. Each row's actions
 * sit in a ⋮ menu so they fit the row.
 */
export function UsersPage() {
  const [tab, setTab] = useState<TabValue>('ALL');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ mode: 'create' } | { mode: 'edit'; account: UserAccountView } | null>(null);
  const [resetFor, setResetFor] = useState<UserAccountView | null>(null);
  const [toggling, setToggling] = useState<UserAccountView | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const accounts = useQuery({ queryKey: ['user-accounts'], queryFn: () => usersApi.list() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['user-accounts'] });

  const all = accounts.data ?? [];
  const counts = {
    ALL: all.length,
    STAFF: all.filter((a) => a.role !== 'TRAINEE').length,
    TRAINEE: all.filter((a) => a.role === 'TRAINEE').length,
    DEACTIVATED: all.filter((a) => a.status !== 'APPROVED').length,
  };
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all
      .filter((a) =>
        tab === 'STAFF' ? a.role !== 'TRAINEE' : tab === 'TRAINEE' ? a.role === 'TRAINEE' : tab === 'DEACTIVATED' ? a.status !== 'APPROVED' : true,
      )
      .filter(
        (a) =>
          !needle ||
          `${a.name} ${a.signInId} ${ROLE_LABELS[a.role]} ${a.position} ${a.detail}`.toLowerCase().includes(needle),
      );
  }, [all, tab, query]);

  const setActive = useMutation({
    mutationFn: (a: UserAccountView) => usersApi.setActive(a.userId, a.status !== 'APPROVED'),
    onSuccess: (account) => {
      toast.success(account.status === 'APPROVED' ? 'Account reactivated.' : 'Account deactivated.', account.name);
      setToggling(null);
      void refresh();
    },
    onError: (caught) => {
      toast.error('Could not do that.', errorMessage(caught));
      setToggling(null);
    },
  });

  return (
    <>
      <PageHeader
        title="User Management"
        description="Every sign-in in RegiStream. Create accounts with their first password, edit them, reset forgotten passwords, and deactivate accounts that should no longer sign in."
        actions={
          <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
            New account
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs<TabValue>
          ariaLabel="Accounts"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'ALL', label: 'All', count: counts.ALL },
            { value: 'STAFF', label: 'Staff', count: counts.STAFF },
            { value: 'TRAINEE', label: 'Trainees', count: counts.TRAINEE },
            { value: 'DEACTIVATED', label: 'Deactivated', count: counts.DEACTIVATED },
          ]}
        />
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, ID Number, role or position…"
            aria-label="Search accounts"
          />
        </div>
      </div>

      <QueryState isLoading={accounts.isLoading} error={accounts.error} onRetry={() => accounts.refetch()}>
        <Card>
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-ink-500">No accounts match.</p>
          ) : (
            <TableWrap>
              <Table className="min-w-[52rem]">
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Signs in with</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Last sign-in</Th>
                    <Th className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => {
                    const active = a.status === 'APPROVED';
                    return (
                      <tr key={a.userId} className={active ? 'hover:bg-surface-2' : 'bg-surface-2/60 text-ink-500'}>
                        <Td>
                          <span className="block font-medium text-ink-900">
                            {a.name} {a.isSelf ? <Badge tone="brand">You</Badge> : null}
                          </span>
                          <span className="block text-xs text-ink-500">
                            {[a.position, a.detail].filter(Boolean).join(' · ')}
                          </span>
                        </Td>
                        <Td className="font-mono text-xs">{a.signInId}</Td>
                        <Td>
                          <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABELS[a.role]}</Badge>
                        </Td>
                        <Td>
                          {!active ? (
                            <Badge tone="danger">Deactivated</Badge>
                          ) : a.mustChangePassword ? (
                            <Badge tone="warning">Default password</Badge>
                          ) : (
                            <Badge tone="success">Active</Badge>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-ink-500">
                          {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}
                        </Td>
                        <Td className="text-right">
                          <RowMenu
                            label={`Actions for ${a.name}`}
                            items={[
                              { label: 'Edit', onSelect: () => setForm({ mode: 'edit', account: a }) },
                              ...(active && !a.isSelf
                                ? [{ label: 'Reset password', onSelect: () => setResetFor(a) }]
                                : []),
                              ...(a.isSelf
                                ? []
                                : [
                                    active
                                      ? { label: 'Deactivate', danger: true, divider: true, onSelect: () => setToggling(a) }
                                      : { label: 'Reactivate', divider: true, onSelect: () => setToggling(a) },
                                  ]),
                            ]}
                          />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </QueryState>

      <ConfirmDialog
        open={toggling !== null}
        tone={toggling?.status === 'APPROVED' ? 'danger' : 'primary'}
        title={toggling?.status === 'APPROVED' ? 'Deactivate this account?' : 'Reactivate this account?'}
        message={
          toggling ? (
            toggling.status === 'APPROVED' ? (
              <>
                <strong>{toggling.name}</strong> will no longer be able to sign in. Nothing they did is removed, and you can
                reactivate the account at any time.
              </>
            ) : (
              <>
                <strong>{toggling.name}</strong> will be able to sign in again with their existing password.
              </>
            )
          ) : null
        }
        confirmLabel={toggling?.status === 'APPROVED' ? 'Deactivate' : 'Reactivate'}
        loading={setActive.isPending}
        onConfirm={() => toggling && setActive.mutate(toggling)}
        onCancel={() => setToggling(null)}
      />

      <AccountFormModal
        state={form}
        onClose={() => setForm(null)}
        onSaved={(account, created) => {
          toast.success(created ? 'Account created.' : 'Account updated.', `${account.name} signs in with ${account.signInId}.`);
          setForm(null);
          void refresh();
        }}
      />
      <ResetPasswordModal
        account={resetFor}
        onClose={() => setResetFor(null)}
        onDone={(account) => {
          toast.success('Password reset.', `Give ${account.name} their new password; they can change it from their account menu.`);
          setResetFor(null);
          void refresh();
        }}
      />
    </>
  );
}

interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Draw a line above this item. */
  divider?: boolean;
}

/**
 * The ⋮ button and its menu. The menu is drawn on top of the page (not
 * inside the table, whose scrolling would clip it) and closes on a click
 * elsewhere, Escape, or scrolling.
 */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const width = 176;
    const height = menu.current?.offsetHeight ?? 120;
    const below = r.bottom + 4 + height < window.innerHeight;
    setPos({ top: below ? r.bottom + 4 : r.top - height - 4, left: Math.max(8, r.right - width) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event.type === 'keydown' && (event as KeyboardEvent).key !== 'Escape') return;
      if (event.type === 'pointerdown' && (menu.current?.contains(event.target as Node) || button.current?.contains(event.target as Node))) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={classNames(
          'inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-ink-500 transition-colors hover:bg-surface-3 hover:text-ink-900',
          open && 'bg-surface-3 text-ink-900',
        )}
      >
        ⋮
      </button>
      {open
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
              className="fixed z-50 w-44 rounded-lg border border-line bg-surface py-1 shadow-xl"
            >
              {items.map((item) => (
                <div key={item.label}>
                  {item.divider ? <div className="my-1 border-t border-line" /> : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.onSelect();
                    }}
                    className={classNames(
                      'block w-full px-3.5 py-2 text-left text-sm hover:bg-surface-2',
                      item.danger ? 'text-danger' : 'text-ink-900',
                    )}
                  >
                    {item.label}
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

interface FormState {
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber: string;
  password: string;
  position: string;
}

const BLANK: FormState = {
  role: 'REGISTRAR',
  firstName: '',
  lastName: '',
  email: '',
  studentNumber: '',
  password: '',
  position: '',
};

/** New account and Edit share one form: role, name, email, (ID Number), password, position. */
function AccountFormModal({
  state,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' } | { mode: 'edit'; account: UserAccountView } | null;
  onClose: () => void;
  onSaved: (account: UserAccountView, created: boolean) => void;
}) {
  const editing = state?.mode === 'edit' ? state.account : null;
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!state) return;
    if (state.mode === 'create') {
      setForm(BLANK);
      return;
    }
    const a = state.account;
    setForm({
      role: a.role,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      studentNumber: a.role === 'TRAINEE' ? a.signInId : '',
      password: '',
      position: a.position,
    });
  }, [state]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const isTrainee = form.role === 'TRAINEE';

  const save = useMutation({
    mutationFn: () =>
      editing
        ? usersApi.update(editing.userId, {
            role: form.role,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            position: form.position,
          })
        : usersApi.create({ ...form, studentNumber: isTrainee ? form.studentNumber : '' }),
    onSuccess: (account) => onSaved(account, !editing),
    onError: (caught) => setError(errorMessage(caught)),
  });

  const blocking =
    !form.firstName.trim() ||
    !form.lastName.trim() ||
    !form.email.trim() ||
    (!editing && passwordProblem(form.password) !== null) ||
    (!editing && isTrainee && !form.studentNumber.trim());

  // Roles an account may move to: staff among staff; a trainee stays a trainee.
  const roleChoices: Role[] = editing
    ? editing.role === 'TRAINEE'
      ? ['TRAINEE']
      : ROLE_ORDER.filter((r) => r !== 'TRAINEE')
    : ROLE_ORDER.filter((r) => ALL_ROLES.includes(r));

  return (
    <Modal
      open={state !== null}
      onClose={onClose}
      title={editing ? 'Edit account' : 'New account'}
      description={
        editing
          ? `${editing.name} — signs in with ${editing.signInId}`
          : 'Set the first password here; they can change it themselves from their account menu.'
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} disabled={blocking} onClick={() => save.mutate()}>
            {editing ? 'Save changes' : 'Create account'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="ac-role" required className="sm:col-span-2">
          <Select
            id="ac-role"
            value={form.role}
            disabled={editing?.isSelf || roleChoices.length === 1}
            onChange={(e) => set('role', e.target.value as Role)}
          >
            {roleChoices.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First name" htmlFor="ac-first" required>
          <TextInput id="ac-first" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="ac-last" required>
          <TextInput id="ac-last" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field
          label="Email"
          htmlFor="ac-email"
          required
          hint={isTrainee ? 'For contacting them. Trainees sign in with their ID Number.' : 'What they sign in with.'}
          className={isTrainee ? '' : 'sm:col-span-2'}
        >
          <TextInput id="ac-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        {isTrainee ? (
          <Field label="ID Number" htmlFor="ac-id" required hint="As on their student record, e.g. 2026-00004.">
            <TextInput
              id="ac-id"
              value={form.studentNumber}
              disabled={!!editing}
              onChange={(e) => set('studentNumber', e.target.value)}
              placeholder="2026-00000"
            />
          </Field>
        ) : null}
        {editing ? null : (
          <div className="sm:col-span-2">
            <PasswordField id="ac-password" label="Password" value={form.password} onChange={(v) => set('password', v)} />
          </div>
        )}
        <Field label="Position" htmlFor="ac-position" hint="Prints on signature lines." className="sm:col-span-2">
          <TextInput
            id="ac-position"
            value={form.position}
            onChange={(e) => set('position', e.target.value)}
            placeholder={isTrainee ? 'Trainee' : form.role === 'TRAINER' ? 'Trainer' : ROLE_LABELS[form.role]}
          />
        </Field>
        {editing ? (
          <p className="text-xs text-ink-500 sm:col-span-2">
            To give them a new password, use <strong>Reset password</strong> in the row's ⋮ menu.
          </p>
        ) : null}
        {error ? (
          <div className="sm:col-span-2">
            <InfoNote tone="danger" title={editing ? 'Could not save' : 'Could not create the account'}>
              {error}
            </InfoNote>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function ResetPasswordModal({
  account,
  onClose,
  onDone,
}: {
  account: UserAccountView | null;
  onClose: () => void;
  onDone: (account: UserAccountView) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setPassword('');
    setError(null);
  }, [account]);
  const reset = useMutation({
    mutationFn: () => usersApi.resetPassword(account?.userId ?? '', password),
    onSuccess: onDone,
    onError: (caught) => setError(errorMessage(caught)),
  });
  return (
    <Modal
      open={account !== null}
      onClose={onClose}
      title="Reset password"
      description={account ? `${account.name} — signs in with ${account.signInId}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={reset.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={reset.isPending} disabled={passwordProblem(password) !== null} onClick={() => reset.mutate()}>
            Set new password
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <PasswordField id="rp-password" label="New password" value={password} onChange={setPassword} />
        <p className="text-xs text-ink-500">
          Their old password stops working at once. Tell them the new one; they can change it from their account menu.
        </p>
        {error ? <InfoNote tone="danger" title="Could not reset the password">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
