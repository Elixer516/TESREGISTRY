import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayCode } from '@/types';
import { ALL_DAYS, DAY_LABELS } from '@/types';
import { availabilityApi, catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
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
  TextArea,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * Trainer availability.
 *
 * This is a declaration, not a request. Marking a submission INCORPORATED is
 * an acknowledgement by the Training Department — it creates no schedule and
 * moves nothing on the timetable. The UI says so, because the status name
 * alone invites the wrong assumption.
 */
export function AvailabilityPage() {
  const { role } = useAuth();
  const isTrainer = role === 'TRAINER';
  const [semesterId, setSemesterId] = useState('');
  const [days, setDays] = useState<DayCode[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const semesters = useQuery({
    queryKey: ['semesters'],
    queryFn: () => catalogApi.listSemesters(),
  });

  const submissions = useQuery({
    queryKey: ['availability'],
    queryFn: () => availabilityApi.list(),
  });

  const submit = useMutation({
    mutationFn: () =>
      availabilityApi.submit({ semesterId, days, startTime, endTime, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(
        'Availability submitted.',
        'Nothing is scheduled automatically — the Training Department reviews it.',
      );
      setDays([]);
      setNotes('');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const incorporate = useMutation({
    mutationFn: (id: string) => availabilityApi.incorporate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Marked as incorporated.', 'No schedule was created or changed by this.');
    },
    onError: (caught) => toast.error('Could not update the submission.', errorMessage(caught)),
  });

  const rows = submissions.data ?? [];

  return (
    <>
      <PageHeader
        title="Trainer Availability"
        description="Trainers declare when they can teach; the Training Department acknowledges it. The flow is one-way."
      />

      <div className="mb-4">
        <InfoNote tone="info" title="What the two statuses mean">
          <ul className="list-inside list-disc space-y-1">
            <li>
              <strong>Submitted</strong> — the trainer has stated their availability. Only that
              trainer can change it, and only while it is still in this state.
            </li>
            <li>
              <strong>Incorporated</strong> — the Training Department has taken it into account
              while planning. Only they can set this, and it locks the submission.
            </li>
          </ul>
          <p className="mt-2">
            Neither status creates or edits a class schedule. Schedules are always made by hand
            under Class Schedules.
          </p>
        </InfoNote>
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        {isTrainer ? (
          <Card className="h-fit">
            <CardHeader title="Submit availability" description="One submission per term." />
            <div className="space-y-4 p-4">
              <Field label="Term" htmlFor="av-term" required>
                <Select
                  id="av-term"
                  value={semesterId}
                  onChange={(event) => setSemesterId(event.target.value)}
                >
                  <option value="">Select a term…</option>
                  {(semesters.data ?? []).map((semester) => (
                    <option key={semester.id} value={semester.id}>
                      {semester.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <fieldset>
                <legend className="mb-1.5 text-xs font-semibold text-ink-700">
                  Preferred days <span className="text-danger">*</span>
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DAYS.map((day) => {
                    const selected = days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setDays((current) =>
                            current.includes(day)
                              ? current.filter((d) => d !== day)
                              : [...current, day],
                          )
                        }
                        className={
                          'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ' +
                          (selected
                            ? 'border-transparent bg-brand text-white'
                            : 'border-line bg-surface text-ink-700 hover:bg-surface-2')
                        }
                      >
                        {DAY_LABELS[day].slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="From" htmlFor="av-start" required>
                  <TextInput
                    id="av-start"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </Field>
                <Field label="To" htmlFor="av-end" required>
                  <TextInput
                    id="av-end"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Notes" htmlFor="av-notes" hint="Anything the planners should know.">
                <TextArea
                  id="av-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Unavailable Tuesdays for industry consultancy."
                />
              </Field>

              {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

              <Button
                variant="primary"
                className="w-full"
                disabled={!semesterId || days.length === 0}
                loading={submit.isPending}
                onClick={() => {
                  setError(null);
                  submit.mutate();
                }}
              >
                Submit availability
              </Button>
            </div>
          </Card>
        ) : null}

        <div className={isTrainer ? '' : 'lg:col-span-2'}>
          <QueryState
            isLoading={submissions.isLoading}
            error={submissions.error}
            isEmpty={rows.length === 0}
            onRetry={() => submissions.refetch()}
            loadingLabel="Loading submissions…"
            emptyTitle="No submissions yet"
            emptyHint={
              isTrainer
                ? 'Submit your availability for a term using the form on the left.'
                : 'Trainers have not submitted availability for any term yet.'
            }
          >
            <Card>
              <CardHeader
                title={isTrainer ? 'My submissions' : 'Submissions'}
                description="Newest first."
              />
              <TableWrap>
                <Table className="min-w-[46rem]">
                  <thead>
                    <tr>
                      {!isTrainer ? <Th>Trainer</Th> : null}
                      <Th>Term</Th>
                      <Th>Days</Th>
                      <Th>Time</Th>
                      <Th>Status</Th>
                      <Th>Notes</Th>
                      {!isTrainer ? <Th className="text-right">Action</Th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        {!isTrainer ? (
                          <Td>
                            <span className="block font-medium text-ink-900">{row.facultyName}</span>
                            <span className="block text-xs text-ink-500">
                              {row.employeeId} · {row.department}
                            </span>
                          </Td>
                        ) : null}
                        <Td>{row.semesterLabel}</Td>
                        <Td>{row.dayPattern}</Td>
                        <Td>{row.timeRange}</Td>
                        <Td>
                          <Badge tone={row.status === 'INCORPORATED' ? 'success' : 'warning'}>
                            {row.status === 'INCORPORATED' ? 'Incorporated' : 'Submitted'}
                          </Badge>
                          {row.reviewedAt ? (
                            <span className="mt-1 block text-[11px] text-ink-500">
                              by {row.reviewedByName} · {formatDateTime(row.reviewedAt)}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="max-w-[16rem] text-xs">{row.notes || '—'}</Td>
                        {!isTrainer ? (
                          <Td className="text-right">
                            {row.status === 'SUBMITTED' ? (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={incorporate.isPending}
                                onClick={() => incorporate.mutate(row.id)}
                              >
                                Mark incorporated
                              </Button>
                            ) : (
                              <span className="text-xs text-ink-400">Locked</span>
                            )}
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          </QueryState>
        </div>
      </div>
    </>
  );
}
