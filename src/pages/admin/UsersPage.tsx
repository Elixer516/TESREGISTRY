import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, UserAccountStatus } from '@/types';
import { ACCOUNT_STATUS_LABELS, ALL_ROLES, ROLE_LABELS } from '@/types';
import { usersApi } from '@/api';
import type { UserView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { AccountStatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreateUserModal } from './CreateUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';

interface PendingAction {
  user: UserView;
  status: UserAccountStatus;
  label: string;
}

/**
 * User accounts.
 *
 * Every mutation re-checks the administrator's own password. Suspending a
 * colleague should not be possible just because someone walked past an
 * unlocked workstation.
 */
export function UsersPage() {
  const [role, setRole] = useState<Role | 'ALL'>('ALL');
  const [status, setStatus] = useState<UserAccountStatus | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [resetting, setResetting] = useState<UserView | null>(null);
  const [action, setAction] = useState<PendingAction | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const users = useQuery({
    queryKey: ['users', role, status, query],
    queryFn: () => usersApi.list({ role, status, query }),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { userId: string; status: UserAccountStatus; password: string }) =>
      usersApi.setStatus(input.userId, input.status, input.password),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(updated.fullName + ' is now ' + updated.statusLabel + '.');
      setAction(null);
    },
    onError: (caught) => {
      toast.error('Nothing was changed.', errorMessage(caught));
      setAction(null);
    },
  });

  const rows = users.data ?? [];

  const actionsFor = (user: UserView): PendingAction[] => {
    const list: PendingAction[] = [];
    if (user.status === 'PENDING') {
      list.push({ user, status: 'APPROVED', label: 'Approve' });
      list.push({ user, status: 'REJECTED', label: 'Reject' });
    }
    if (user.status === 'APPROVED') {
      list.push({ user, status: 'SUSPENDED', label: 'Suspend' });
      list.push({ user, status: 'DEACTIVATED', label: 'Deactivate' });
    }
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      list.push({ user, status: 'APPROVED', label: 'Reinstate' });
    }
    return list;
  };

  return (
    <>
      <PageHeader
        title="User Accounts"
        description="Create, approve and suspend logins. A trainer account must be linked to an existing faculty record — one login per record."
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New account
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Role" htmlFor="u-role">
            <Select
              id="u-role"
              value={role}
              onChange={(event) => setRole(event.target.value as Role | 'ALL')}
            >
              <option value="ALL">All roles</option>
              {ALL_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="u-status">
            <Select
              id="u-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as UserAccountStatus | 'ALL')}
            >
              <option value="ALL">All statuses</option>
              {(Object.keys(ACCOUNT_STATUS_LABELS) as UserAccountStatus[]).map((value) => (
                <option key={value} value={value}>
                  {ACCOUNT_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="u-search">
            <TextInput
              id="u-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email or employee ID…"
            />
          </Field>
        </div>
      </Card>

      <div className="mb-4">
        <InfoNote tone="info" title="Passwords are stored in plain text in this build">
          There is no backend and no hashing here. Treat every credential in this prototype as
          public, and never reuse a real password.
        </InfoNote>
      </div>

      <QueryState
        isLoading={users.isLoading}
        error={users.error}
        isEmpty={rows.length === 0}
        onRetry={() => users.refetch()}
        loadingLabel="Loading accounts…"
        emptyTitle="No accounts match"
        emptyHint="Clear the filters, or create a new account."
      >
        <Card>
          <CardHeader title="Accounts" description={rows.length + ' account(s).'} />
          <TableWrap>
            <Table className="min-w-[56rem]">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Linked record</Th>
                  <Th>Status</Th>
                  <Th>Last sign-in</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-2">
                    <Td className="font-medium text-ink-900">{user.fullName}</Td>
                    <Td className="break-all text-xs">{user.email}</Td>
                    <Td>{user.roleLabel}</Td>
                    <Td className="text-xs">
                      {user.facultyName
                        ? user.facultyName + ' (' + user.facultyEmployeeId + ')'
                        : user.studentName
                          ? user.studentName
                          : '—'}
                    </Td>
                    <Td>
                      <AccountStatusBadge status={user.status} />
                      {user.isLocked ? (
                        <span className="mt-1 block text-[11px] font-semibold text-danger-ink">
                          Locked out
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-xs text-ink-500">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                    </Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {actionsFor(user).map((item) => (
                          <Button
                            key={item.label}
                            size="sm"
                            variant={item.status === 'APPROVED' ? 'primary' : 'secondary'}
                            onClick={() => setAction(item)}
                          >
                            {item.label}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setResetting(user)}>
                          Reset password
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />

      <ConfirmDialog
        open={action !== null}
        title={action ? action.label + ' this account?' : ''}
        message={
          action
            ? action.user.fullName + ' (' + action.user.email + ') will be set to ' + ACCOUNT_STATUS_LABELS[action.status] + '.'
            : ''
        }
        confirmLabel={action?.label ?? 'Confirm'}
        tone={action?.status === 'APPROVED' ? 'primary' : 'danger'}
        requirePassword
        passwordLabel="Your administrator password"
        loading={changeStatus.isPending}
        onConfirm={(password) =>
          action &&
          changeStatus.mutate({ userId: action.user.id, status: action.status, password })
        }
        onCancel={() => setAction(null)}
      />
    </>
  );
}
