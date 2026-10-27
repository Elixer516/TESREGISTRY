import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role } from '@/types';
import { ROLE_LABELS } from '@/types';
import type { FacultyView, NewAccountInput, UserAccountView } from '@/types/views';
import { usersApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { DEFAULT_TRAINEE_PASSWORD } from '@/lib/passwords';
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
import { PickerButton } from '@/components/RecordPicker';
import { FacultyPicker } from '@/components/pickers';

type TabValue = 'ALL' | 'STAFF' | 'TRAINEE' | 'DEACTIVATED';

const STAFF_ROLES: Array<NewAccountInput['role']> = ['REGISTRAR', 'TRAINER', 'IT_ADMIN'];

const ROLE_TONE: Record<Role, 'brand' | 'info' | 'neutral' | 'warning'> = {
  REGISTRAR: 'brand',
  TRAINER: 'info',
  TRAINEE: 'neutral',
  IT_ADMIN: 'warning',
};

type Pending =
  | { kind: 'reset'; account: UserAccountView }
  | { kind: 'deactivate'; account: UserAccountView }
  | { kind: 'reactivate'; account: UserAccountView };

/**
 * The IT Administrator's accounts: every sign-in in the system. Create staff
 * accounts, change a staff member's role, deactivate or reactivate any
 * account, and put any password back to the default. Trainee accounts are
 * created by the Registrar approving an application.
 */
export function UsersPage() {
  const [tab, setTab] = useState<TabValue>('ALL');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [roleFor, setRoleFor] = useState<UserAccountView | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
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

  const act = useMutation({
    mutationFn: async (p: Pending) => {
      if (p.kind === 'reset') return usersApi.resetPassword(p.account.userId);
      return usersApi.setActive(p.account.userId, p.kind === 'reactivate');
    },
    onSuccess: (account, p) => {
      if (p.kind === 'reset') {
        toast.success(
          'Password reset.',
          `${account.name} signs in with ${account.signInId} and ${DEFAULT_TRAINEE_PASSWORD}, then chooses a new password.`,
        );
      } else {
        toast.success(p.kind === 'deactivate' ? 'Account deactivated.' : 'Account reactivated.', account.name);
      }
      setPending(null);
      void refresh();
    },
    onError: (caught) => {
      toast.error('Could not do that.', errorMessage(caught));
      setPending(null);
    },
  });

  return (
    <>
      <PageHeader
        title="User Management"
        description="Every sign-in in RegiStream. Create staff accounts, assign roles, deactivate accounts and reset passwords. Trainee accounts appear when the Registrar approves an application."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
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
            placeholder="Search by name, email, ID Number, role or diploma…"
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
              <Table className="min-w-[56rem]">
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Signs in with</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Last sign-in</Th>
                    <Th className="text-right">Actions</Th>
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
                          {active ? (
                            a.mustChangePassword ? (
                              <Badge tone="warning">Default password</Badge>
                            ) : (
                              <Badge tone="success">Active</Badge>
                            )
                          ) : (
                            <Badge tone="danger">Deactivated</Badge>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap text-xs text-ink-500">
                          {a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}
                        </Td>
                        <Td className="text-right">
                          {a.isSelf ? (
                            <span className="text-xs text-ink-400">Your own account</span>
                          ) : (
                            <span className="inline-flex flex-wrap justify-end gap-1.5">
                              {active ? (
                                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'reset', account: a })}>
                                  Reset password
                                </Button>
                              ) : null}
                              {active && a.role !== 'TRAINEE' ? (
                                <Button size="sm" variant="secondary" onClick={() => setRoleFor(a)}>
                                  Change role
                                </Button>
                              ) : null}
                              {active ? (
                                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPending({ kind: 'deactivate', account: a })}>
                                  Deactivate
                                </Button>
                              ) : (
                                <Button size="sm" variant="secondary" onClick={() => setPending({ kind: 'reactivate', account: a })}>
                                  Reactivate
                                </Button>
                              )}
                            </span>
                          )}
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
        open={pending !== null}
        tone={pending?.kind === 'reactivate' ? 'primary' : pending?.kind === 'reset' ? 'primary' : 'danger'}
        title={
          pending?.kind === 'reset'
            ? 'Reset this password?'
            : pending?.kind === 'deactivate'
              ? 'Deactivate this account?'
              : 'Reactivate this account?'
        }
        message={
          pending ? (
            pending.kind === 'reset' ? (
              <>
                <strong>{pending.account.name}</strong> will sign in with <strong>{pending.account.signInId}</strong> and the
                default password <strong>{DEFAULT_TRAINEE_PASSWORD}</strong>, and must choose a new one straight away.
              </>
            ) : pending.kind === 'deactivate' ? (
              <>
                <strong>{pending.account.name}</strong> will no longer be able to sign in. Nothing they did is removed, and
                you can reactivate the account at any time.
              </>
            ) : (
              <>
                <strong>{pending.account.name}</strong> will be able to sign in again with their existing password.
              </>
            )
          ) : null
        }
        confirmLabel={pending?.kind === 'reset' ? 'Reset password' : pending?.kind === 'deactivate' ? 'Deactivate' : 'Reactivate'}
        loading={act.isPending}
        onConfirm={() => pending && act.mutate(pending)}
        onCancel={() => setPending(null)}
      />

      <NewAccountModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(account) => {
          toast.success(
            'Account created.',
            `${account.name} signs in with ${account.signInId} and ${DEFAULT_TRAINEE_PASSWORD}, then chooses their own password.`,
          );
          setCreating(false);
          void refresh();
        }}
      />
      <ChangeRoleModal
        account={roleFor}
        onClose={() => setRoleFor(null)}
        onChanged={(account) => {
          toast.success('Role changed.', `${account.name} is now ${ROLE_LABELS[account.role]}.`);
          setRoleFor(null);
          void refresh();
        }}
      />
    </>
  );
}

const BLANK: NewAccountInput = {
  role: 'TRAINER',
  email: '',
  firstName: '',
  lastName: '',
  title: '',
  position: '',
  facultyId: null,
};

function NewAccountModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (account: UserAccountView) => void;
}) {
  const [form, setForm] = useState<NewAccountInput>(BLANK);
  const [faculty, setFaculty] = useState<FacultyView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof NewAccountInput>(key: K, value: NewAccountInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const create = useMutation({
    mutationFn: () => usersApi.create({ ...form, facultyId: form.role === 'TRAINER' ? faculty?.id ?? null : null }),
    onSuccess: (account) => {
      setForm(BLANK);
      setFaculty(null);
      setError(null);
      onCreated(account);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New account"
      description="A staff sign-in. It starts on the default password, which they replace at first sign-in."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Create account
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="na-role" required className="sm:col-span-2">
          <Select id="na-role" value={form.role} onChange={(e) => set('role', e.target.value as NewAccountInput['role'])}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {form.role === 'TRAINER' ? (
          <div className="sm:col-span-2">
            <PickerButton
              label="Faculty record *"
              placeholder="Choose a trainer…"
              value={faculty ? `${faculty.fullName} · ${faculty.diploma}` : null}
              onClick={() => setPickerOpen(true)}
            />
            <p className="mt-1 text-xs text-ink-500">
              Links the account to the trainer's classes. Picking one fills in the name and email.
            </p>
          </div>
        ) : null}
        <Field label="First name" htmlFor="na-first" required>
          <TextInput id="na-first" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="na-last" required>
          <TextInput id="na-last" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="na-email" required hint="What they sign in with." className="sm:col-span-2">
          <TextInput id="na-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Title" htmlFor="na-title" hint="e.g. Ms., Engr.">
          <TextInput id="na-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Position" htmlFor="na-position" hint="Prints on signature lines.">
          <TextInput id="na-position" value={form.position} onChange={(e) => set('position', e.target.value)} placeholder={form.role === 'TRAINER' ? 'Trainer' : ROLE_LABELS[form.role]} />
        </Field>
        {error ? (
          <div className="sm:col-span-2">
            <InfoNote tone="danger" title="Could not create the account">{error}</InfoNote>
          </div>
        ) : null}
      </div>
      <FacultyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={faculty?.id ?? null}
        onSelect={(picked) => {
          setFaculty(picked);
          setPickerOpen(false);
          setForm((f) => ({
            ...f,
            firstName: f.firstName || picked.firstName,
            lastName: f.lastName || picked.lastName,
            email: f.email || picked.email || '',
          }));
        }}
      />
    </Modal>
  );
}

function ChangeRoleModal({
  account,
  onClose,
  onChanged,
}: {
  account: UserAccountView | null;
  onClose: () => void;
  onChanged: (account: UserAccountView) => void;
}) {
  const [role, setRole] = useState<Role | ''>('');
  const [error, setError] = useState<string | null>(null);
  const change = useMutation({
    mutationFn: () => usersApi.setRole(account?.userId ?? '', role as Role),
    onSuccess: (updated) => {
      setRole('');
      setError(null);
      onChanged(updated);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const current = role || account?.role || '';
  return (
    <Modal
      open={account !== null}
      onClose={() => {
        setRole('');
        setError(null);
        onClose();
      }}
      title="Change role"
      description={account ? `${account.name} — now ${ROLE_LABELS[account.role]}` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={change.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={change.isPending} disabled={!role || role === account?.role} onClick={() => change.mutate()}>
            Change role
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <Field label="Role" htmlFor="cr-role">
          <Select id="cr-role" value={current} onChange={(e) => setRole(e.target.value as Role)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-xs text-ink-500">
          The role decides what they can see and do from their next page load. A trainer needs a faculty record, so only
          accounts linked to one can become Trainer.
        </p>
        {error ? <InfoNote tone="danger" title="Could not change the role">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
