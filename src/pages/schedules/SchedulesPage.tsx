import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, schedulesApi } from '@/api';
import type { ClassScheduleView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Tabs,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { ScheduleStatusBadge } from '@/components/StatusBadge';
import { SchoolYearTermFilter } from '@/components/SchoolYearTermFilter';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ScheduleFormModal } from './ScheduleFormModal';
import { ImportFacultyScheduleModal } from '../catalog/ImportFacultyScheduleModal';

type View = 'GRID' | 'LIST';

/**
 * Class schedules.
 *
 * Draft rows are visible only until published — the service filters them out
 * of every trainee-facing view, so this page cannot leak one by forgetting to.
 */
export function SchedulesPage() {
  const canWrite = true;
  const [view, setView] = useState<View>('GRID');
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [status, setStatus] = useState<'ALL' | 'DRAFT' | 'PUBLISHED'>('ALL');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<ClassScheduleView | null>(null);
  const [deleting, setDeleting] = useState<ClassScheduleView | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  // Several semesters are open at once — one per diploma and year level — so
  // the first is only a starting selection, not "the" active term.
  const activeTerm = useQuery({
    queryKey: ['active-semesters'],
    queryFn: () => catalogApi.listActiveSemesters(),
  });

  useEffect(() => {
    if (!semesterId && activeTerm.data?.length) setSemesterId(activeTerm.data[0].id);
  }, [activeTerm.data, semesterId]);

  const schedules = useQuery({
    queryKey: ['schedules', semesterId, status, search],
    queryFn: () =>
      schedulesApi.list({
        semesterId: semesterId ?? undefined,
        status,
        query: search,
      }),
    enabled: Boolean(semesterId),
  });

  const publish = useMutation({
    mutationFn: (id: string) => schedulesApi.publish(id),
    onSuccess: (schedule) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(schedule.subjectCode + ' published.', 'Students and the trainer were notified.');
    },
    onError: (caught) => toast.error('Could not publish.', errorMessage(caught)),
  });

  const unpublish = useMutation({
    mutationFn: (id: string) => schedulesApi.unpublish(id),
    onSuccess: (schedule) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success(schedule.subjectCode + ' returned to draft.', 'It is now hidden from trainees until republished.');
    },
    onError: (caught) => toast.error('Could not unpublish.', errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => schedulesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted.');
      setDeleting(null);
    },
    onError: (caught) => {
      setDeleting(null);
      toast.error('Could not delete the schedule.', errorMessage(caught));
    },
  });

  const rows = schedules.data ?? [];

  return (
    <>
      <PageHeader
        title="Class Schedules"
        description="A conflicting schedule is refused outright — a section cannot be in two rooms at once, so there is no override."
        actions={
          canWrite ? (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                Import schedules
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                New schedule
              </Button>
            </>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <SchoolYearTermFilter semesterId={semesterId} onChange={setSemesterId} />
          </div>
          <Field label="Status" htmlFor="sched-status">
            <Select
              id="sched-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'ALL' | 'DRAFT' | 'PUBLISHED')}
            >
              <option value="ALL">All</option>
              <option value="PUBLISHED">Published</option>
              {canWrite ? <option value="DRAFT">Draft</option> : null}
            </Select>
          </Field>
          <Field label="Search" htmlFor="sched-search">
            <TextInput
              id="sched-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Subject, section, trainer, room…"
            />
          </Field>
        </div>
      </Card>

      <div className="mb-4">
        <Tabs<View>
          ariaLabel="Schedule view"
          value={view}
          onChange={setView}
          options={[
            { value: 'GRID', label: 'Week grid' },
            { value: 'LIST', label: 'List', count: rows.length },
          ]}
        />
      </div>

      <QueryState
        isLoading={schedules.isLoading}
        error={schedules.error}
        isEmpty={rows.length === 0}
        onRetry={() => schedules.refetch()}
        loadingLabel="Loading schedules…"
        emptyTitle="No schedules for this term"
        emptyHint="Create one. It starts as a draft, visible only to you until you publish it."
        emptyAction={
          canWrite ? (
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              New schedule
            </Button>
          ) : undefined
        }
      >
        {view === 'GRID' ? (
          <WeeklyCalendar schedules={rows} />
        ) : (
          <Card>
            <CardHeader title="Schedules" description={rows.length + ' row(s) for this term.'} />
            <TableWrap>
              <Table className="min-w-[54rem]">
                <thead>
                  <tr>
                    <Th>Subject</Th>
                    <Th>Section</Th>
                    <Th>Days &amp; time</Th>
                    <Th>Room</Th>
                    <Th>Trainer</Th>
                    <Th>Status</Th>
                    {canWrite ? <Th className="text-right">Actions</Th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((schedule) => (
                    <tr key={schedule.id} className="hover:bg-surface-2">
                      <Td>
                        <span className="block font-medium text-ink-900">{schedule.subjectCode}</span>
                        <span className="block text-xs text-ink-500">{schedule.subjectTitle}</span>
                      </Td>
                      <Td>{schedule.sectionCode}</Td>
                      <Td>
                        <span className="block">{schedule.dayPattern}</span>
                        <span className="block text-xs text-ink-500">{schedule.timeRange}</span>
                      </Td>
                      <Td>{schedule.room || 'TBA'}</Td>
                      <Td>{schedule.trainerName}</Td>
                      <Td>
                        <ScheduleStatusBadge status={schedule.status} />
                      </Td>
                      {canWrite ? (
                        <Td className="text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditing(schedule);
                                setFormOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            {schedule.status === 'DRAFT' ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => publish.mutate(schedule.id)}
                              >
                                Publish
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => unpublish.mutate(schedule.id)}
                              >
                                Unpublish
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setDeleting(schedule)}>
                              Delete
                            </Button>
                          </div>
                        </Td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </QueryState>

      <ScheduleFormModal
        open={formOpen}
        schedule={editing}
        semesterId={semesterId}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this schedule?"
        message={
          deleting
            ? deleting.subjectCode + ' for ' + deleting.sectionCode + ' will be removed. Enrolled subject rows pointing at it will block the delete.'
            : ''
        }
        confirmLabel="Delete schedule"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />

      <ImportFacultyScheduleModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
