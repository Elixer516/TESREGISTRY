import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HeadTrainerClassView, HeadTrainerOverview } from '@/types/views';
import { headTrainerApi } from '@/api';
import { GRADING_SHEET_STATUS_LABELS } from '@/types';
import { Badge, Button, Card, InfoNote, Modal, PageHeader, Table, TableWrap, Tabs, Td, TextInput, Th } from '@/components/ui';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { QueryState } from '@/components/states';
import { GradingSheetStatusBadge } from './GradingSheetStatusBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { GradeEvaluationSheet } from '../evaluation/GradeEvaluationSheet';

type TabValue = 'CLASSES' | 'TRAINEES';

const LEVEL_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year'];
const SEMESTER_ORDER = ['1st Semester', '2nd Semester', 'Summer'];

/** Chips for the values present, in a known order first, anything else after. */
function distinctInOrder(values: string[], order: string[]) {
  const present = [...new Set(values.filter(Boolean))];
  const rank = (v: string) => (order.includes(v) ? order.indexOf(v) : order.length);
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((v) => ({ value: v, label: v }));
}

const DEADLINE_WORDING: Record<HeadTrainerClassView['deadline']['state'], string> = {
  OVERDUE: 'Overdue',
  DUE_SOON: 'Due within a week',
  OPEN: 'Not yet due',
  LATE: 'Submitted late',
  ON_TIME: 'Submitted on time',
  NONE: 'No deadline',
};

/** "First Year, 2nd Semester" → ["First Year", "2nd Semester"]. */
function splitLevelSemester(c: HeadTrainerClassView): [string, string] {
  const [level = '', semester = ''] = c.levelSemester.split(', ');
  return [level, semester];
}

/** What a class's posted grades show, for the "grades posted" chips. */
function gradeFlags(c: HeadTrainerClassView): string[] {
  const flags: string[] = [];
  if (c.passed + c.failed + c.inc === 0) flags.push('NONE');
  if (c.failed > 0) flags.push('FAILED');
  if (c.inc > 0) flags.push('INC');
  return flags;
}

/**
 * The head trainer's view of their diploma: every class — theirs and every
 * other trainer's — with its sheet, the grades it posted and its deadline;
 * and every trainee, whose Grade Evaluation they can open. Read-only: grades
 * are still entered by each class's trainer and approved by the Registrar.
 */
export function HeadTrainerPage() {
  const [tab, setTab] = useState<TabValue>('CLASSES');
  // Batch (the year trainees were admitted), term, own classes, sheet,
  // deadline and grades posted. Batch carries over to the Trainees tab.
  const [filters, setFilters] = useState<FilterSelection>({});
  const [openClass, setOpenClass] = useState<HeadTrainerClassView | null>(null);
  const [traineeQuery, setTraineeQuery] = useState('');
  const [trainee, setTrainee] = useState<HeadTrainerOverview['trainees'][number] | null>(null);

  const overview = useQuery({ queryKey: ['head-trainer'], queryFn: () => headTrainerApi.overview() });
  const data = overview.data;

  const classes = useMemo(
    () =>
      (data?.classes ?? []).filter((c) =>
        matchesSelection(filters, (key) => {
          switch (key) {
            case 'batch': return c.batches;
            case 'schoolYear': return c.semesterIsActive ? [c.academicYearLabel, 'OPEN'] : c.academicYearLabel;
            case 'level': return splitLevelSemester(c)[0];
            case 'semester': return splitLevelSemester(c)[1];
            case 'show': return c.isMine ? 'MINE' : null;
            case 'sheet': return c.status;
            case 'deadline': return c.deadline.state;
            case 'grades': return gradeFlags(c);
            default: return null;
          }
        }),
      ),
    [data, filters],
  );
  const trainees = useMemo(() => {
    const needle = traineeQuery.trim().toLowerCase();
    return (data?.trainees ?? []).filter(
      (t) =>
        matchesSelection({ batch: filters.batch ?? [] }, () => t.batch) &&
        (!needle || `${t.name} ${t.studentNumber}`.toLowerCase().includes(needle)),
    );
  }, [data, traineeQuery, filters]);
  const batches = useMemo(
    () => [...new Set((data?.trainees ?? []).map((t) => t.batch))].sort().reverse(),
    [data],
  );

  const late = (data?.classes ?? []).filter((c) => c.deadline.state === 'OVERDUE').length;

  const filterGroups = useMemo<FilterGroup[]>(() => {
    const all = data?.classes ?? [];
    const batchChips = batches.map((b) => ({ value: b, label: `Batch ${b}` }));
    if (tab === 'TRAINEES') return [{ key: 'batch', label: 'batch', chips: batchChips }];
    const present = <T extends string>(order: T[], values: T[]) => order.filter((v) => values.includes(v));
    const deadlineOrder = Object.keys(DEADLINE_WORDING) as Array<keyof typeof DEADLINE_WORDING>;
    const sheetOrder = Object.keys(GRADING_SHEET_STATUS_LABELS) as Array<keyof typeof GRADING_SHEET_STATUS_LABELS>;
    const flags = new Set(all.flatMap(gradeFlags));
    return [
      { key: 'batch', label: 'batch', chips: batchChips },
      {
        key: 'schoolYear',
        label: 'school year',
        chips: [
          ...(all.some((c) => c.semesterIsActive) ? [{ value: 'OPEN', label: 'Open semesters' }] : []),
          ...[...new Set(all.map((c) => c.academicYearLabel))].sort().reverse().map((y) => ({ value: y, label: y })),
        ],
      },
      { key: 'level', label: 'year level', chips: distinctInOrder(all.map((c) => splitLevelSemester(c)[0]), LEVEL_ORDER) },
      { key: 'semester', label: 'semester', chips: distinctInOrder(all.map((c) => splitLevelSemester(c)[1]), SEMESTER_ORDER) },
      { key: 'show', label: 'trainer', chips: all.some((c) => c.isMine) ? [{ value: 'MINE', label: 'My classes' }] : [] },
      {
        key: 'sheet',
        label: 'sheet',
        chips: present(sheetOrder, all.map((c) => c.status)).map((st) => ({ value: st, label: GRADING_SHEET_STATUS_LABELS[st] })),
      },
      {
        key: 'deadline',
        label: 'deadline',
        chips: present(deadlineOrder, all.map((c) => c.deadline.state)).map((st) => ({ value: st, label: DEADLINE_WORDING[st] })),
      },
      {
        key: 'grades',
        label: 'grades',
        chips: [
          { value: 'NONE', label: 'None posted yet' },
          { value: 'FAILED', label: 'Has failures' },
          { value: 'INC', label: 'Has INC' },
        ].filter((chip) => flags.has(chip.value)),
      },
    ];
  }, [data, tab, batches]);

  return (
    <>
      <PageHeader
        title={data ? `${data.programCode} — Diploma Grades` : 'Diploma Grades'}
        description={
          data
            ? `As head trainer of the ${data.programName}: every class and trainee of the diploma, across ${data.trainerCount} trainers.`
            : 'Every class and trainee of the diploma you head.'
        }
      />

      <QueryState isLoading={overview.isLoading} error={overview.error} onRetry={() => overview.refetch()}>
        {data ? (
          <>
            {late > 0 ? (
              <div className="mb-4">
                <InfoNote tone="danger" title={`${late} class${late === 1 ? '' : 'es'} past the grade deadline`}>
                  Their trainers have not submitted grades yet. The Registrar has been notified too.
                </InfoNote>
              </div>
            ) : null}
            <div className="mb-4 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Tabs<TabValue>
                  ariaLabel="View"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'CLASSES', label: 'Classes & grades', count: data.classes.length },
                    { value: 'TRAINEES', label: 'Trainees', count: data.trainees.length },
                  ]}
                />
              </div>
              <FilterPanel groups={filterGroups} value={filters} onChange={setFilters} />
            </div>

            {tab === 'CLASSES' ? (
              <Card>
                {classes.length === 0 ? (
                  <p className="p-4 text-sm text-ink-500">No classes match these filters.</p>
                ) : (
                  <TableWrap>
                    <Table className="min-w-[60rem]">
                      <thead>
                        <tr>
                          <Th>Class</Th>
                          <Th>Section · Term</Th>
                          <Th>Trainer</Th>
                          <Th>Sheet</Th>
                          <Th>Grades posted</Th>
                          <Th>Deadline</Th>
                          <Th className="text-right"> </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {classes.map((c) => (
                          <tr key={c.classScheduleId} className="hover:bg-surface-2">
                            <Td>
                              <span className="block font-medium text-ink-900">
                                {c.courseCode} {c.isMine ? <Badge tone="brand">Yours</Badge> : null}
                              </span>
                              <span className="block text-xs text-ink-500">{c.description}</span>
                            </Td>
                            <Td className="text-xs">
                              <span className="block">{c.sectionCode}</span>
                              <span className="block text-ink-500">{c.semesterLabel}</span>
                              {c.batches.length ? (
                                <span className="block text-ink-500">Batch {c.batches.join(', ')}</span>
                              ) : null}
                            </Td>
                            <Td className="text-xs">{c.trainerName}</Td>
                            <Td>
                              <GradingSheetStatusBadge status={c.status} />
                              <span className="mt-0.5 block text-[11px] text-ink-500">
                                {c.filledCount} of {c.rowCount} entered
                              </span>
                            </Td>
                            <Td className="text-xs">
                              {c.passed + c.failed + c.inc === 0 ? (
                                <span className="text-ink-400">None yet</span>
                              ) : (
                                <span>
                                  <span className="text-success-ink">{c.passed} passed</span>
                                  {c.failed ? <span className="text-danger-ink"> · {c.failed} failed</span> : null}
                                  {c.inc ? <span className="text-warning-ink"> · {c.inc} INC</span> : null}
                                </span>
                              )}
                            </Td>
                            <Td>
                              <DeadlineBadge deadline={c.deadline} />
                            </Td>
                            <Td className="text-right">
                              <Button size="sm" variant="secondary" onClick={() => setOpenClass(c)}>
                                View grades
                              </Button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
                <Card className="h-fit p-3">
                  <TextInput
                    value={traineeQuery}
                    onChange={(e) => setTraineeQuery(e.target.value)}
                    placeholder="Search a trainee…"
                    aria-label="Search trainees"
                  />
                  <ul className="mt-2 max-h-[28rem] overflow-y-auto">
                    {trainees.map((t) => (
                      <li key={t.studentId}>
                        <button
                          type="button"
                          onClick={() => setTrainee(t)}
                          className={
                            'w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 ' +
                            (trainee?.studentId === t.studentId ? 'bg-surface-2 font-semibold' : '')
                          }
                        >
                          <span className="block text-ink-900">{t.name}</span>
                          <span className="block text-xs text-ink-500">
                            {t.studentNumber} · Batch {t.batch} · Year {t.yearLevel} · {t.status}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card className="min-w-0 p-4">
                  {trainee ? (
                    <>
                      <div className="no-print mb-3 flex justify-end">
                        <Button variant="secondary" onClick={() => window.print()}>
                          Print
                        </Button>
                      </div>
                      <GradeEvaluationSheet student={{ id: trainee.studentId }} />
                    </>
                  ) : (
                    <p className="text-sm text-ink-500">Choose a trainee to see their Grade Evaluation.</p>
                  )}
                </Card>
              </div>
            )}
          </>
        ) : null}
      </QueryState>

      <ClassGradesModal open={openClass} onClose={() => setOpenClass(null)} />
    </>
  );
}

function ClassGradesModal({ open, onClose }: { open: HeadTrainerClassView | null; onClose: () => void }) {
  const sheet = useQuery({
    queryKey: ['head-trainer-sheet', open?.classScheduleId],
    queryFn: () => headTrainerApi.sheet(open?.classScheduleId ?? ''),
    enabled: Boolean(open),
  });
  const data = sheet.data;
  return (
    <Modal
      open={open !== null}
      onClose={onClose}
      size="lg"
      title={open ? `${open.courseCode} — ${open.description}` : 'Class grades'}
      description={open ? `${open.sectionCode} · ${open.trainerName} · ${open.semesterLabel}` : undefined}
    >
      <QueryState isLoading={sheet.isLoading} error={sheet.error} onRetry={() => sheet.refetch()}>
        {data ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <GradingSheetStatusBadge status={data.status} />
              {data.referenceNumber ? <span className="font-mono">{data.referenceNumber}</span> : null}
              {data.status === 'SUBMITTED' ? <span>· awaiting the Registrar’s approval</span> : null}
            </div>
            <TableWrap>
              <Table className="min-w-[30rem]">
                <thead>
                  <tr>
                    <Th className="w-10">No.</Th>
                    <Th>Trainee</Th>
                    <Th className="text-right">Percentage</Th>
                    <Th className="text-right">Grade</Th>
                    <Th>Remarks</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.studentId}>
                      <Td className="tabular-nums">{row.number}</Td>
                      <Td>
                        <span className="block text-ink-900">{row.studentName}</span>
                        <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                      </Td>
                      <Td className="text-right tabular-nums">{row.percentage !== null ? `${row.percentage}%` : '—'}</Td>
                      <Td className="text-right font-medium tabular-nums">{row.marker ?? row.grade ?? '—'}</Td>
                      <Td className="text-xs">{row.remarks}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        ) : null}
      </QueryState>
    </Modal>
  );
}
