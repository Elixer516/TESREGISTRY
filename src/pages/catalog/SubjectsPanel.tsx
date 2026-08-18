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
  InfoNote,
  Modal,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

const EMPTY = { code: '', title: '', description: '', units: 3, lectureHours: 3, labHours: 0 };

export function SubjectsPanel({ canWrite }: { canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();

  const subjects = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: () => catalogApi.listSubjects(true),
  });

  const create = useMutation({
    mutationFn: () => catalogApi.createSubject(form),
    onSuccess: (subject) => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject ' + subject.code + ' created.');
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const toggle = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      catalogApi.setSubjectActive(input.id, input.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Subject updated.');
    },
    onError: (caught) => toast.error('Could not update the subject.', errorMessage(caught)),
  });

  const needle = search.trim().toLowerCase();
  const rows = (subjects.data ?? []).filter(
    (subject) => !needle || (subject.code + ' ' + subject.title).toLowerCase().includes(needle),
  );

  return (
    <>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="Search subjects" htmlFor="subj-search">
              <TextInput
                id="subj-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Code or title…"
              />
            </Field>
          </div>
          {canWrite ? (
            <Button variant="primary" onClick={() => setOpen(true)}>
              New subject
            </Button>
          ) : null}
        </div>
      </Card>

      <QueryState
        isLoading={subjects.isLoading}
        error={subjects.error}
        isEmpty={rows.length === 0}
        onRetry={() => subjects.refetch()}
        emptyTitle={search ? 'No subject matches' : 'No subjects yet'}
        emptyHint={
          search
            ? 'Try a shorter search term.'
            : 'Create the subjects first, then map them into each curriculum that uses them.'
        }
      >
        <Card>
          <CardHeader
            title="Subjects"
            description="One record per subject, shared by every curriculum that maps it."
          />
          <TableWrap>
            <Table className="min-w-[44rem]">
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Title</Th>
                  <Th className="text-right">Units</Th>
                  <Th className="text-right">Lec / Lab</Th>
                  <Th>Status</Th>
                  {canWrite ? <Th className="text-right">Action</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((subject) => (
                  <tr key={subject.id}>
                    <Td className="font-medium text-ink-900">{subject.code}</Td>
                    <Td>{subject.title}</Td>
                    <Td className="text-right tabular-nums">{subject.units}</Td>
                    <Td className="text-right tabular-nums">
                      {subject.lectureHours} / {subject.labHours}
                    </Td>
                    <Td>
                      <Badge tone={subject.isActive ? 'success' : 'neutral'}>
                        {subject.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            toggle.mutate({ id: subject.id, isActive: !subject.isActive })
                          }
                        >
                          {subject.isActive ? 'Deactivate' : 'Reactivate'}
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
        title="New subject"
        description="Changing units later never alters enrollments already made — those keep the units they were enrolled with."
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
              Create subject
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Code" htmlFor="s-code" required>
            <TextInput
              id="s-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="CSS106"
            />
          </Field>
          <Field label="Units" htmlFor="s-units" required>
            <TextInput
              id="s-units"
              type="number"
              min={1}
              value={form.units}
              onChange={(e) => setForm({ ...form, units: Number(e.target.value) })}
            />
          </Field>
          <Field label="Lecture hours" htmlFor="s-lec">
            <TextInput
              id="s-lec"
              type="number"
              min={0}
              value={form.lectureHours}
              onChange={(e) => setForm({ ...form, lectureHours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Lab hours" htmlFor="s-lab">
            <TextInput
              id="s-lab"
              type="number"
              min={0}
              value={form.labHours}
              onChange={(e) => setForm({ ...form, labHours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Title" htmlFor="s-title" required className="sm:col-span-2">
            <TextInput
              id="s-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
