import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * School years and terms — Registrar-owned.
 *
 * Exactly one term is active at a time. That flag is what opens and closes
 * grade encoding, so two active terms would make "the active term" meaningless.
 */
export function TermsPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: '', startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => catalogApi.listSemesters(),
  });

  const create = useMutation({
    mutationFn: () => catalogApi.createAcademicYear(form),
    onSuccess: (year) => {
      queryClient.invalidateQueries({ queryKey: ['semesters'] });
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      toast.success('School year ' + year.label + ' created.', 'Two semesters, each with two terms, were created with it.');
      setOpen(false);
      setForm({ label: '', startDate: '', endDate: '' });
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const activate = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      catalogApi.setSemesterActive(input.id, input.isActive),
    onSuccess: (rows) => {
      queryClient.setQueryData(['semesters'], rows);
      queryClient.invalidateQueries({ queryKey: ['active-semester'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Active term updated.', 'Grade encoding follows the active term.');
    },
    onError: (caught) => toast.error('Could not change the active term.', errorMessage(caught)),
  });

  const rows = semesters.data ?? [];
  const active = rows.find((row) => row.isActive);

  return (
    <>
      <PageHeader
        title="School Years & Terms"
        description="The active term gates grade encoding. Only one term can be active at a time."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New school year
          </Button>
        }
      />

      <div className="mb-4">
        {active ? (
          <InfoNote tone="success" title={'Active term: ' + active.label}>
            Grades can be encoded for this term. Every other term is read-only.
          </InfoNote>
        ) : (
          <InfoNote tone="warning" title="No active term">
            Grade encoding is closed everywhere until a term is activated below.
          </InfoNote>
        )}
      </div>

      <QueryState
        isLoading={semesters.isLoading}
        error={semesters.error}
        isEmpty={rows.length === 0}
        onRetry={() => semesters.refetch()}
        emptyTitle="No school years yet"
        emptyHint="Create a school year — its two semesters, each with two terms, are created with it."
      >
        <Card>
          <CardHeader title="Terms" description="Newest school year first." />
          <TableWrap>
            <Table className="min-w-[42rem]">
              <thead>
                <tr>
                  <Th>School year</Th>
                  <Th>Term</Th>
                  <Th>Starts</Th>
                  <Th>Ends</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium text-ink-900">{row.academicYearLabel}</Td>
                    <Td>{row.termLabel}</Td>
                    <Td>{formatDate(row.startDate)}</Td>
                    <Td>{formatDate(row.endDate)}</Td>
                    <Td>
                      <Badge tone={row.isActive ? 'success' : 'neutral'}>
                        {row.isActive ? 'Active' : 'Closed'}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant={row.isActive ? 'secondary' : 'primary'}
                        loading={activate.isPending}
                        onClick={() => activate.mutate({ id: row.id, isActive: !row.isActive })}
                      >
                        {row.isActive ? 'Close term' : 'Make active'}
                      </Button>
                    </Td>
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
        title="New school year"
        description="Two semesters, each with two terms, are created alongside it."
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
              Create school year
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Label" htmlFor="ay-label" required hint="Format: YYYY-YYYY">
            <TextInput
              id="ay-label"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="2027-2028"
            />
          </Field>
          <Field label="Starts" htmlFor="ay-start">
            <TextInput
              id="ay-start"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Ends" htmlFor="ay-end">
            <TextInput
              id="ay-end"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
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
