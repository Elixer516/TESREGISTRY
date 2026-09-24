import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TraineeAccountView } from '@/types/views';
import { accountsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { DEFAULT_TRAINEE_PASSWORD } from '@/lib/passwords';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  InfoNote,
  PageHeader,
  Table,
  TableWrap,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ConfirmDialog } from '@/components/ConfirmDialog';

/**
 * The IT Administrator's list of trainee sign-ins.
 *
 * One action, deliberately: put a trainee's password back to the default.
 * The IT Administrator never sees or chooses a trainee's own password — the
 * trainee picks a new one themselves at their next sign-in.
 */
export function TraineeAccountsPage() {
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<TraineeAccountView | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const accounts = useQuery({
    queryKey: ['trainee-accounts', query],
    queryFn: () => accountsApi.listTrainees(query),
  });

  const reset = useMutation({
    mutationFn: (userId: string) => accountsApi.resetTraineePassword(userId),
    onSuccess: async () => {
      toast.success(
        'Password reset.',
        `${target?.name ?? 'The trainee'} signs in with ${target?.idNumber ?? 'their ID Number'} and ${DEFAULT_TRAINEE_PASSWORD}, then chooses a new password.`,
      );
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['trainee-accounts'] });
    },
    onError: (error) => toast.error('Could not reset the password.', errorMessage(error)),
  });

  return (
    <>
      <PageHeader
        title="Trainee Accounts"
        description="Every approved trainee signs in with their ID Number. Reset a password when a trainee has forgotten it or is locked out."
      />

      <div className="mb-4">
        <InfoNote tone="info">
          A reset puts the password back to <strong>{DEFAULT_TRAINEE_PASSWORD}</strong> and lifts
          any lockout. The trainee must choose a new password the next time they sign in.
        </InfoNote>
      </div>

      <Card>
        <div className="border-b border-line p-3">
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by ID Number, name or diploma"
            aria-label="Search trainee accounts"
          />
        </div>

        {accounts.isLoading ? (
          <div className="p-4">
            <LoadingState label="Loading accounts…" rows={3} />
          </div>
        ) : accounts.error ? (
          <ErrorState error={accounts.error} onRetry={() => accounts.refetch()} />
        ) : (accounts.data ?? []).length === 0 ? (
          <EmptyState
            title={query ? 'No account matches' : 'No trainee accounts yet'}
            hint="An account is created when the Registrar approves an application."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>ID Number</Th>
                  <Th>Name</Th>
                  <Th>Diploma</Th>
                  <Th>Password</Th>
                  <Th>Last sign-in</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {(accounts.data ?? []).map((row) => (
                  <tr key={row.userId}>
                    <Td className="font-mono text-xs">{row.idNumber}</Td>
                    <Td className="font-medium text-ink-900">{row.name}</Td>
                    <Td>{row.programCode}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {row.mustChangePassword ? (
                          <Badge tone="warning">Default — change pending</Badge>
                        ) : (
                          <Badge tone="success">Own password set</Badge>
                        )}
                        {row.locked ? <Badge tone="danger">Locked</Badge> : null}
                      </span>
                    </Td>
                    <Td className="text-xs text-ink-500">
                      {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : 'Never'}
                    </Td>
                    <Td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setTarget(row)}>
                        Reset password
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <ConfirmDialog
        open={target !== null}
        title="Reset this trainee's password?"
        message={
          target ? (
            <>
              <strong>{target.name}</strong> ({target.idNumber}) will sign in with{' '}
              <strong>{DEFAULT_TRAINEE_PASSWORD}</strong> and be made to choose a new password.
              Their current password stops working immediately.
            </>
          ) : null
        }
        confirmLabel="Reset password"
        tone="primary"
        loading={reset.isPending}
        onConfirm={() => target && reset.mutate(target.userId)}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
