import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, enrollmentApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage, isApiError } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  InfoNote,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker } from '@/components/pickers';
import { SchoolYearTermFilter } from '@/components/SchoolYearTermFilter';

/**
 * Enrollment.
 *
 * The subject list is the student's own curriculum for their year level and
 * the chosen term — not a free-for-all catalog. Anything already passed is
 * disabled rather than hidden, so the reason is visible.
 */
export function EnrollmentPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
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

  const options = useQuery({
    queryKey: ['enrollment-options', student?.id, semesterId],
    queryFn: () => enrollmentApi.options(student?.id ?? '', semesterId ?? ''),
    enabled: Boolean(student && semesterId),
  });

  useEffect(() => {
    setSelected([]);
    setError(null);
  }, [student?.id, semesterId]);

  const data = options.data;
  const selectable = useMemo(
    () => (data?.subjects ?? []).filter((subject) => !subject.disabledReason),
    [data],
  );
  const totalUnits = useMemo(
    () =>
      (data?.subjects ?? [])
        .filter((subject) => selected.includes(subject.subjectId))
        .reduce((sum, subject) => sum + subject.units, 0),
    [data, selected],
  );

  const enroll = useMutation({
    mutationFn: () => enrollmentApi.create(student?.id ?? '', semesterId ?? '', selected),
    onSuccess: (enrollment) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-options'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        enrollment.studentName + ' enrolled for ' + enrollment.termLabel + '.',
        enrollment.subjectCount + ' subject(s), ' + enrollment.totalUnits + ' units.',
      );
      setSelected([]);
    },
    onError: (caught) => setError(caught),
  });

  const recent = useQuery({
    queryKey: ['enrollments', semesterId],
    queryFn: () => enrollmentApi.list({ semesterId: semesterId ?? undefined }),
    enabled: Boolean(semesterId),
  });

  return (
    <>
      <PageHeader
        title="Enrollment"
        description="One enrollment per student per term. Units are copied onto the enrollment at this moment and never re-read from the subject afterwards."
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-4">
          <div className="space-y-4">
            <PickerButton
              label="Student"
              value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
              placeholder="Choose a student…"
              onClick={() => setPickerOpen(true)}
              onClear={() => setStudent(null)}
            />
            <SchoolYearTermFilter
              semesterId={semesterId}
              onChange={setSemesterId}
              className="space-y-3"
            />
            {student ? (
              <dl className="space-y-1.5 rounded-lg border border-line bg-surface-2 p-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Program</dt>
                  <dd className="font-medium text-ink-900">{student.programCode}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Year level</dt>
                  <dd className="font-medium text-ink-900">{student.yearLevel}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Section</dt>
                  <dd className="font-medium text-ink-900">{student.sectionCode ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Curriculum</dt>
                  <dd className="text-right font-medium text-ink-900">
                    {student.curriculumName ?? 'Not assigned'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a student to begin"
              hint="Search by name or student number. Only approved students can be enrolled."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a student
                </Button>
              }
            />
          ) : options.isLoading ? (
            <LoadingState label="Working out what this student may take…" />
          ) : options.error ? (
            <ErrorState error={options.error} onRetry={() => options.refetch()} />
          ) : data ? (
            <Card>
              <CardHeader
                title={'Subjects for ' + data.semester.label}
                description={
                  'Year ' + data.student.yearLevel + ' · ' + (data.student.curriculumName ?? 'no curriculum')
                }
                actions={
                  <Badge tone={totalUnits > 0 ? 'brand' : 'neutral'}>{totalUnits} units selected</Badge>
                }
              />

              {data.blockedReason ? (
                <div className="p-4">
                  <InfoNote tone="warning" title="This student cannot be enrolled here">
                    {data.blockedReason}
                  </InfoNote>
                </div>
              ) : data.subjects.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No subjects mapped for this term"
                    hint={
                      'The curriculum has nothing at Year ' +
                      data.student.yearLevel +
                      ', ' +
                      data.semester.termLabel +
                      '. Map subjects yourself under Academic Catalog.'
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-2 p-4 sm:grid-cols-2">
                    {data.subjects.map((subject) => (
                      <Checkbox
                        key={subject.subjectId}
                        label={subject.code + ' — ' + subject.title}
                        description={
                          subject.units +
                          ' units' +
                          (subject.scheduleLabel ? ' · ' + subject.scheduleLabel : ' · no published class yet') +
                          (subject.disabledReason ? ' · ' + subject.disabledReason : '')
                        }
                        disabled={Boolean(subject.disabledReason)}
                        checked={selected.includes(subject.subjectId)}
                        onChange={(event) =>
                          setSelected((current) =>
                            event.target.checked
                              ? [...current, subject.subjectId]
                              : current.filter((id) => id !== subject.subjectId),
                          )
                        }
                      />
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <div className="text-xs text-ink-500">
                      {selected.length} of {selectable.length} selectable subject(s) chosen ·{' '}
                      {totalUnits} units
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelected(selectable.map((s) => s.subjectId))}
                        disabled={selectable.length === 0}
                      >
                        Select all available
                      </Button>
                      <Button
                        variant="primary"
                        disabled={selected.length === 0}
                        loading={enroll.isPending}
                        onClick={() => {
                          setError(null);
                          enroll.mutate();
                        }}
                      >
                        Enroll
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {error ? (
                <div className="border-t border-line p-4">
                  <InfoNote tone="danger" title="Nothing was enrolled">
                    <p>{errorMessage(error)}</p>
                    {isApiError(error) && error.details ? (
                      <ul className="mt-2 list-inside list-disc space-y-0.5">
                        {error.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    ) : null}
                  </InfoNote>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Enrollments this term"
          description="Newest first. One row per student per term, by design."
        />
        {recent.isLoading ? (
          <div className="p-4">
            <LoadingState label="Loading enrollments…" rows={2} />
          </div>
        ) : (recent.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-ink-500">
            Nobody is enrolled in this term yet.
          </p>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Term</Th>
                  <Th className="text-right">Subjects</Th>
                  <Th className="text-right">Units</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {(recent.data ?? []).map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <span className="block font-medium text-ink-900">{row.studentName}</span>
                      <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                    </Td>
                    <Td>
                      {row.academicYearLabel} · {row.termLabel}
                    </Td>
                    <Td className="text-right tabular-nums">{row.subjectCount}</Td>
                    <Td className="text-right tabular-nums">{row.totalUnits}</Td>
                    <Td>
                      <Badge tone={row.status === 'DROPPED' ? 'danger' : 'success'}>
                        {row.status}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
        statuses={['APPROVED', 'ACTIVE', 'INACTIVE']}
        title="Find a student to enroll"
        description="Only students who have been approved appear here."
      />
    </>
  );
}
