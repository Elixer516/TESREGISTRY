import { useEffect, useState } from 'react';
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
  InfoNote,
  Modal,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

export function SectionsPanel({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', programId: '', yearLevel: 1, capacity: 30 });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const programs = useQuery({ queryKey: ['programs'], queryFn: () => catalogApi.listPrograms() });
  const sections = useQuery({ queryKey: ['sections', 'all'], queryFn: () => catalogApi.listSections() });

  useEffect(() => {
    if (!form.programId && programs.data?.[0]) {
      setForm((current) => ({ ...current, programId: programs.data[0].id }));
    }
  }, [programs.data, form.programId]);

  const create = useMutation({
    mutationFn: () => catalogApi.createSection(form),
    onSuccess: (section) => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success('Section ' + section.code + ' created.');
      setOpen(false);
      setForm({ code: '', programId: form.programId, yearLevel: 1, capacity: 30 });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      catalogApi.setSectionActive(input.id, input.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections'] });
      toast.success('Section updated.');
    },
    onError: (caught) => toast.error('Could not update the section.', errorMessage(caught)),
  });

  const rows = sections.data ?? [];

  return (
    <>
      <QueryState
        isLoading={sections.isLoading}
        error={sections.error}
        isEmpty={rows.length === 0}
        onRetry={() => sections.refetch()}
        emptyTitle="No sections yet"
        emptyHint="Sections group students for scheduling. Create one per program and year level."
      >
        <Card>
          <CardHeader
            title="Sections"
            description="A section is an exclusive resource in the schedule — it cannot be in two classes at once."
            actions={
              canWrite ? (
                <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
                  New section
                </Button>
              ) : undefined
            }
          />
          <TableWrap>
            <Table className="min-w-[42rem]">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Program</Th>
                  <Th className="text-right">Year</Th>
                  <Th className="text-right">Enrolled / capacity</Th>
                  <Th>Status</Th>
                  {canWrite ? <Th className="text-right">Action</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((section) => (
                  <tr key={section.id}>
                    <Td className="font-medium text-ink-900">{section.code}</Td>
                    <Td>{section.programName}</Td>
                    <Td className="text-right tabular-nums">{section.yearLevel}</Td>
                    <Td className="text-right tabular-nums">
                      {section.studentCount} / {section.capacity}
                    </Td>
                    <Td>
                      <Badge tone={section.isActive ? 'success' : 'neutral'}>
                        {section.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toggle.mutate({ id: section.id, isActive: !section.isActive })
                          }
                        >
                          {section.isActive ? 'Deactivate' : 'Reactivate'}
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
        title="New section"
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
              Create section
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="sec-code" required>
            <TextInput
              id="sec-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CSS-1B"
            />
          </Field>
          <Field label="Program" htmlFor="sec-prog" required>
            <Select
              id="sec-prog"
              value={form.programId}
              onChange={(e) => setForm({ ...form, programId: e.target.value })}
            >
              {(programs.data ?? []).map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} — {program.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Year level" htmlFor="sec-year">
            <TextInput
              id="sec-year"
              type="number"
              min={1}
              max={6}
              value={form.yearLevel}
              onChange={(e) => setForm({ ...form, yearLevel: Number(e.target.value) })}
            />
          </Field>
          <Field label="Capacity" htmlFor="sec-cap">
            <TextInput
              id="sec-cap"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            />
          </Field>
        </div>
        {error ? (
          <div className="mt-4">
            <InfoNote tone="danger">{error}</InfoNote>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
