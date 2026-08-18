import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Modal,
  Table,
  TableWrap,
  Td,
  Th,
  TextArea,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

export function ProgramsPanel({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', description: '', yearsToComplete: 1 });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const programs = useQuery({
    queryKey: ['programs', 'all'],
    queryFn: () => catalogApi.listPrograms(true),
  });

  const create = useMutation({
    mutationFn: () => catalogApi.createProgram(form),
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success('Program ' + program.code + ' created.');
      setOpen(false);
      setForm({ code: '', name: '', description: '', yearsToComplete: 1 });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      catalogApi.setProgramActive(input.id, input.isActive),
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      toast.success(
        'Program ' + program.code + (program.isActive ? ' reactivated.' : ' deactivated.'),
      );
    },
    onError: (caught) => toast.error('Could not change the program.', errorMessage(caught)),
  });

  const rows = programs.data ?? [];

  return (
    <>
      <QueryState
        isLoading={programs.isLoading}
        error={programs.error}
        isEmpty={rows.length === 0}
        onRetry={() => programs.refetch()}
        emptyTitle="No programs yet"
        emptyHint="Create the first qualification the centre offers."
      >
        <Card>
          <CardHeader
            title="Programs"
            description="Deactivating keeps history intact; deleting would orphan it."
            actions={
              canWrite ? (
                <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                  New program
                </Button>
              ) : undefined
            }
          />
          <TableWrap>
            <Table className="min-w-[44rem]">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th className="text-right">Years</Th>
                  <Th>Status</Th>
                  {canWrite ? <Th className="text-right">Action</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((program) => (
                  <tr key={program.id}>
                    <Td className="font-medium text-ink-900">{program.code}</Td>
                    <Td>
                      <span className="block">{program.name}</span>
                      <span className="block text-xs text-ink-500">{program.description}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{program.yearsToComplete}</Td>
                    <Td>
                      <Badge tone={program.isActive ? 'success' : 'neutral'}>
                        {program.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toggle.mutate({ id: program.id, isActive: !program.isActive })
                          }
                        >
                          {program.isActive ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New program"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              Create program
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="p-code" required>
            <TextInput
              id="p-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CSS"
            />
          </Field>
          <Field label="Years to complete" htmlFor="p-years">
            <TextInput
              id="p-years"
              type="number"
              min={1}
              value={form.yearsToComplete}
              onChange={(e) => setForm({ ...form, yearsToComplete: Number(e.target.value) })}
            />
          </Field>
          <Field label="Name" htmlFor="p-name" required className="sm:col-span-2">
            <TextInput
              id="p-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Computer Systems Servicing NC II"
            />
          </Field>
          <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
            <TextArea
              id="p-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {error}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
