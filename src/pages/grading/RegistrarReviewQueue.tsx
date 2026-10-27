/**
 * The registrar's side of grading.
 *
 * They no longer encode grades — they check whether a submitted roster is
 * complete, then either approve it (which is what posts the grades) or send
 * it back with a reason. Every sheet is listed with its reference number,
 * because that number is how the two sides talk about it on the phone.
 */

import { useMemo, useState } from 'react';
import { AttachmentList } from '@/components/AttachmentsField';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GradingSheetStatus } from '@/types';
import type { GradeDeadline } from '@/types/views';
import { GRADING_SHEET_STATUS_LABELS } from '@/types';
import { catalogApi, gradeDeadlinesApi, gradingSheetsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useSort, type SortColumn } from '@/lib/use-sort';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  DescriptionItem,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Table,
  TableWrap,
  SortableTh,
  Tabs,
  Td,
  TextArea,
  TextInput,
  Th,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { GradingSheetStatusBadge } from './GradingSheetStatusBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { StudentGradingSheetModal } from './StudentGradingSheetModal';
import { ClassDeadlineModal } from './ClassDeadlineModal';
import { StudentPicker } from '@/components/pickers';
import type { StudentView } from '@/types/views';

/** A sheet's state in the Registrar's list; a class whose trainer has not started is "not started". */
type RowStatus = GradingSheetStatus | 'NOT_STARTED';

/** One class in the list: a grading sheet, or a class whose grades are due and not yet begun. */
interface ClassRow {
  key: string;
  classScheduleId: string;
  sheetId: string | null;
  referenceNumber: string;
  courseCode: string;
  description: string;
  programCode: string;
  sectionCode: string;
  term: string;
  trainerName: string;
  status: RowStatus;
  filledCount: number;
  rowCount: number;
  submittedAt: string | null;
  submissionCount: number;
  deadline: GradeDeadline;
  /** From "DIT 1 - Section 1": the year level ("1") and the section — the batch ("1"). */
  yearLevel: string;
  batch: string;
}

const STATUS_WORDING: Record<RowStatus, string> = {
  SUBMITTED: 'Submitted',
  PENDING: GRADING_SHEET_STATUS_LABELS.PENDING,
  DRAFT: 'Draft',
  NOT_STARTED: 'Not started',
  APPROVED: 'Approved',
};

/**
 * Where a class sits in the Registrar's list: a submitted sheet is their
 * move, a late class is the trainer's to chase, and approved ones are done.
 */
const STATUS_ORDER: Record<RowStatus, number> = {
  SUBMITTED: 0,
  NOT_STARTED: 1,
  PENDING: 2,
  DRAFT: 3,
  APPROVED: 4,
};

const YEAR_WORDING: Record<string, string> = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };

/** "Late" covers overdue and handed in late; "on track" is everything else with a deadline. */
function deadlineBucket(d: GradeDeadline): 'LATE' | 'ON_TRACK' | 'NONE' {
  if (d.state === 'OVERDUE' || d.state === 'LATE') return 'LATE';
  if (d.state === 'NONE') return 'NONE';
  return 'ON_TRACK';
}

function splitSection(sectionCode: string, levelSemester: string): { yearLevel: string; batch: string } {
  const m = sectionCode.match(/(\d+)\s*-\s*Section\s*(\d+)/i);
  if (m) return { yearLevel: m[1], batch: m[2] };
  const word = levelSemester.match(/^(First|Second|Third|Fourth)/i)?.[1]?.toLowerCase();
  const year = word ? String(['first', 'second', 'third', 'fourth'].indexOf(word) + 1) : '';
  return { yearLevel: year, batch: '' };
}

type SortKey = 'course' | 'section' | 'trainer' | 'status' | 'deadline';

const COLUMNS: ReadonlyArray<readonly [SortKey, string]> = [
  ['course', 'Class'],
  ['section', 'Section · Term'],
  ['trainer', 'Trainer'],
  ['status', 'Sheet'],
  ['deadline', 'Deadline'],
];

export function RegistrarReviewQueue() {
  const [diploma, setDiploma] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterSelection>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [deadlineFor, setDeadlineFor] = useState<string | null>(null);

  const sheets = useQuery({
    queryKey: ['grading-sheets', 'ALL', ''],
    queryFn: () => gradingSheetsApi.list({ status: 'ALL' }),
  });
  const deadlineAlerts = useQuery({
    queryKey: ['grade-deadline-alerts'],
    queryFn: () => gradeDeadlinesApi.alerts(),
  });
  const programs = useQuery({ queryKey: ['programs', 'all'], queryFn: () => catalogApi.listPrograms(true) });

  // Sheets, and the classes overdue or due this week whose trainer has not
  // begun one — so the late ones sit in the same list as everything else.
  const rows = useMemo<ClassRow[]>(() => {
    const out: ClassRow[] = (sheets.data ?? []).map((s) => ({
      key: s.id,
      classScheduleId: s.classScheduleId,
      sheetId: s.id,
      referenceNumber: s.referenceNumber,
      courseCode: s.courseCode,
      description: s.description,
      programCode: s.programCode,
      sectionCode: s.sectionCode,
      term: `${s.levelSemester} · ${s.academicYearLabel}`,
      trainerName: s.trainerName,
      status: s.status,
      filledCount: s.filledCount,
      rowCount: s.rowCount,
      submittedAt: s.submittedAt,
      submissionCount: s.submissionCount,
      deadline: s.deadline,
      ...splitSection(s.sectionCode, s.levelSemester),
    }));
    const withSheet = new Set(out.map((r) => r.classScheduleId));
    for (const a of deadlineAlerts.data ?? []) {
      if (withSheet.has(a.classScheduleId)) continue;
      out.push({
        key: `class-${a.classScheduleId}`,
        classScheduleId: a.classScheduleId,
        sheetId: null,
        referenceNumber: '',
        courseCode: a.subjectCode,
        description: a.subjectTitle,
        programCode: a.programCode,
        sectionCode: a.sectionCode,
        term: '',
        trainerName: a.trainerName,
        status: 'NOT_STARTED',
        filledCount: 0,
        rowCount: 0,
        submittedAt: null,
        submissionCount: 0,
        deadline: a.deadline,
        ...splitSection(a.sectionCode, ''),
      });
    }
    return out;
  }, [sheets.data, deadlineAlerts.data]);

  const programName = useMemo(
    () => new Map((programs.data ?? []).map((p) => [p.code, p.name])),
    [programs.data],
  );
  // Every diploma gets a tab, with how many classes it has here.
  const diplomaTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.programCode, (counts.get(r.programCode) ?? 0) + 1);
    const codes = new Set([...(programs.data ?? []).filter((p) => p.isActive).map((p) => p.code), ...counts.keys()]);
    return [
      { value: 'ALL', label: 'All diplomas', count: rows.length },
      ...[...codes].sort().map((code) => ({ value: code, label: code, count: counts.get(code) ?? 0 })),
    ];
  }, [rows, programs.data]);

  const inDiploma = useMemo(
    () => (diploma === 'ALL' ? rows : rows.filter((r) => r.programCode === diploma)),
    [rows, diploma],
  );

  const filterGroups = useMemo<FilterGroup[]>(() => {
    const present = <T extends string>(values: T[]) => new Set(values);
    const statuses = present(inDiploma.map((r) => r.status));
    const years = [...present(inDiploma.map((r) => r.yearLevel))].filter(Boolean).sort();
    const batches = [...present(inDiploma.map((r) => r.batch))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    const buckets = present(inDiploma.map((r) => deadlineBucket(r.deadline)));
    return [
      {
        key: 'status',
        label: 'sheet',
        chips: (Object.keys(STATUS_ORDER) as RowStatus[])
          .sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])
          .filter((st) => statuses.has(st))
          .map((st) => ({ value: st, label: STATUS_WORDING[st] })),
      },
      { key: 'year', label: 'year level', chips: years.map((y) => ({ value: y, label: YEAR_WORDING[y] ?? `Year ${y}` })) },
      { key: 'batch', label: 'batch', chips: batches.map((b) => ({ value: b, label: `Batch ${b}`, title: `Section ${b}` })) },
      {
        key: 'deadline',
        label: 'deadline',
        chips: [
          { value: 'LATE', label: 'Late' },
          { value: 'ON_TRACK', label: 'On track' },
          { value: 'NONE', label: 'No deadline' },
        ].filter((c) => buckets.has(c.value as 'LATE' | 'ON_TRACK' | 'NONE')),
      },
    ];
  }, [inDiploma]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inDiploma.filter(
      (r) =>
        matchesSelection(filters, (key) => {
          switch (key) {
            case 'status': return r.status;
            case 'year': return r.yearLevel;
            case 'batch': return r.batch;
            case 'deadline': return deadlineBucket(r.deadline);
            default: return null;
          }
        }) &&
        (!needle ||
          `${r.referenceNumber} ${r.courseCode} ${r.description} ${r.sectionCode} ${r.trainerName}`.toLowerCase().includes(needle)),
    );
  }, [inDiploma, filters, search]);

  const sortColumns = useMemo<Record<SortKey, SortColumn<ClassRow>>>(
    () => ({
      course: { value: (r) => r.courseCode },
      section: { value: (r) => `${r.sectionCode} ${r.term}` },
      trainer: { value: (r) => r.trainerName },
      status: { value: (r) => STATUS_ORDER[r.status] },
      // Most overdue first; no deadline last.
      deadline: { value: (r) => (r.deadline.dueDate ?? '9999') },
    }),
    [],
  );
  const { sorted, sort, toggle } = useSort<ClassRow, SortKey>(visible, sortColumns, { key: 'status', direction: 'asc' });

  /** One block per diploma when every diploma is shown, so the eye has something to hold on to. */
  const groups = useMemo(() => {
    const byProgram = new Map<string, ClassRow[]>();
    for (const row of sorted) {
      const bucket = byProgram.get(row.programCode);
      if (bucket) bucket.push(row);
      else byProgram.set(row.programCode, [row]);
    }
    return [...byProgram.entries()]
      .map(([programCode, groupRows]) => ({
        programCode,
        rows: groupRows,
        awaiting: groupRows.filter((r) => r.status === 'SUBMITTED').length,
        late: groupRows.filter((r) => r.deadline.state === 'OVERDUE').length,
      }))
      .sort((a, b) => a.programCode.localeCompare(b.programCode));
  }, [sorted]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (code: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // The per-class list answers "how is this class doing?"; this answers "how
  // is this trainee doing?", the other question a registrar arrives with.
  const [sheetStudent, setSheetStudent] = useState<StudentView | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  const alerts = deadlineAlerts.data ?? [];
  const overdue = alerts.filter((a) => a.deadline.state === 'OVERDUE').length;
  const dueSoon = alerts.length - overdue;
  const filtersOn = Object.values(filters).some((v) => v.length > 0) || search.trim() !== '';

  return (
    <>
      <PageHeader
        title="Grading Sheets"
        description="Submissions from trainers. Approving a sheet is what posts its grades to trainee records."
        actions={
          <Button variant="secondary" onClick={() => setStudentPickerOpen(true)}>
            View a student&rsquo;s grading sheet
          </Button>
        }
      />

      {alerts.length > 0 ? (
        <Card className={`mb-4 flex flex-wrap items-center gap-3 px-4 py-3 ${overdue > 0 ? 'border-danger/40' : 'border-warning/40'}`}>
          <span aria-hidden>⏰</span>
          <span className="font-semibold text-ink-900">Grade submissions</span>
          {overdue > 0 ? <Badge tone="danger">{overdue} overdue</Badge> : null}
          {dueSoon > 0 ? <Badge tone="warning">{dueSoon} due this week</Badge> : null}
          <span className="text-xs text-ink-500">
            Classes whose trainers have not yet submitted grades. Remind them before the next enrolment depends on it.
          </span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => setFilters((f) => ({ ...f, deadline: ['LATE'], status: ['NOT_STARTED', 'DRAFT', 'PENDING'] }))}
          >
            Show late classes
          </Button>
        </Card>
      ) : null}

      {/* The diplomas on their own row: thirteen do not fit beside the search. */}
      <div className="mb-3">
        <Tabs<string> ariaLabel="Diploma" value={diploma} onChange={setDiploma} options={diplomaTabs} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, course, section or trainer…"
            aria-label="Search grading sheets"
          />
        </div>
        <FilterPanel groups={filterGroups} value={filters} onChange={setFilters} />
      </div>

      <QueryState
        isLoading={sheets.isLoading}
        error={sheets.error}
        isEmpty={sorted.length === 0}
        onRetry={() => sheets.refetch()}
        loadingLabel="Loading grading sheets…"
        emptyTitle={filtersOn ? 'No classes match these filters' : 'No grading sheets yet'}
        emptyHint={filtersOn ? 'Clear a filter or the search to see more.' : 'Sheets appear here once a trainer starts one.'}
      >
        <Card>
          <TableWrap>
            <Table className="min-w-[60rem]">
              <thead>
                <tr>
                  {COLUMNS.map(([key, label]) => (
                    <SortableTh key={key} active={sort.key === key} direction={sort.direction} onClick={() => toggle(key)}>
                      {label}
                    </SortableTh>
                  ))}
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.programCode}>
                  {diploma === 'ALL' ? (
                    <tr className="bg-surface-2">
                      <Td colSpan={6} className="border-b border-line p-0">
                        <button
                          type="button"
                          aria-expanded={!collapsed.has(group.programCode)}
                          onClick={() => toggleGroup(group.programCode)}
                          className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-surface-3"
                        >
                          <span
                            aria-hidden
                            className={`text-[10px] leading-none text-ink-500 transition-transform ${collapsed.has(group.programCode) ? '' : 'rotate-90'}`}
                          >
                            ▶
                          </span>
                          <span className="text-sm font-semibold text-ink-900">{group.programCode}</span>
                          <span className="text-xs text-ink-500">{programName.get(group.programCode) ?? ''}</span>
                          <span className="ml-auto text-[11px] text-ink-500">
                            {group.rows.length} class{group.rows.length === 1 ? '' : 'es'}
                            {group.awaiting > 0 ? ` · ${group.awaiting} awaiting review` : ''}
                            {group.late > 0 ? ` · ${group.late} overdue` : ''}
                          </span>
                        </button>
                      </Td>
                    </tr>
                  ) : null}
                  {(diploma === 'ALL' && collapsed.has(group.programCode) ? [] : group.rows).map((row) => (
                    <tr key={row.key} className="hover:bg-surface-2">
                      <Td className="max-w-[15rem]">
                        <span className="block font-medium text-ink-900">{row.courseCode}</span>
                        <span className="block truncate text-xs text-ink-500" title={row.description}>
                          {row.description}
                        </span>
                        {row.referenceNumber ? (
                          <span className="block font-mono text-[11px] text-ink-400">{row.referenceNumber}</span>
                        ) : null}
                      </Td>
                      <Td className="text-xs">
                        <span className="block text-ink-900">{row.sectionCode}</span>
                        {row.term ? <span className="block text-ink-500">{row.term}</span> : null}
                      </Td>
                      <Td className="text-xs">{row.trainerName}</Td>
                      <Td className="text-xs">
                        {row.status === 'NOT_STARTED' ? (
                          <span className="text-ink-500">Not started</span>
                        ) : (
                          <>
                            <GradingSheetStatusBadge status={row.status} />
                            <span className="mt-0.5 block text-[11px] text-ink-500">
                              {row.filledCount} of {row.rowCount} entered
                              {row.submissionCount > 1 ? ` · submission ${row.submissionCount}` : ''}
                            </span>
                            {row.submittedAt ? (
                              <span className="block text-[11px] text-ink-500" title={formatDateTime(row.submittedAt)}>
                                {relativeTime(row.submittedAt)}
                              </span>
                            ) : null}
                          </>
                        )}
                      </Td>
                      <Td>
                        <DeadlineBadge deadline={row.deadline} />
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {row.sheetId ? (
                            <Button size="sm" variant={row.status === 'SUBMITTED' ? 'primary' : 'secondary'} onClick={() => setOpenId(row.sheetId)}>
                              {row.status === 'SUBMITTED' ? 'Review' : 'View'}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="secondary" onClick={() => setDeadlineFor(row.classScheduleId)}>
                            Set deadline
                          </Button>
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <ReviewModal sheetId={openId} onClose={() => setOpenId(null)} />
      <ClassDeadlineModal classScheduleId={deadlineFor} onClose={() => setDeadlineFor(null)} />

      <StudentPicker
        open={studentPickerOpen}
        onClose={() => setStudentPickerOpen(false)}
        selectedId={sheetStudent?.id ?? null}
        onSelect={(picked) => {
          setSheetStudent(picked);
          setStudentPickerOpen(false);
        }}
        title="Whose grading sheet?"
        description="Every grade on record for one trainee, across all their semesters."
      />

      <StudentGradingSheetModal student={sheetStudent} onClose={() => setSheetStudent(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function ReviewModal({ sheetId, onClose }: { sheetId: string | null; onClose: () => void }) {
  const [remarks, setRemarks] = useState('');
  const [showSendBack, setShowSendBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const sheet = useQuery({
    queryKey: ['grading-sheet-detail', sheetId],
    queryFn: () => gradingSheetsApi.get(sheetId ?? ''),
    enabled: Boolean(sheetId),
  });

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['grading-sheets'] });
    queryClient.invalidateQueries({ queryKey: ['grading-sheet-detail', sheetId] });
    queryClient.invalidateQueries({ queryKey: ['academic-record'] });
    setShowSendBack(false);
    setRemarks('');
    onClose();
  };

  const approve = useMutation({
    mutationFn: () => gradingSheetsApi.approve(sheetId ?? ''),
    onSuccess: (result) => {
      toast.success(
        `${result.referenceNumber} approved.`,
        'The grades are now on the trainees’ records.',
      );
      done();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const sendBack = useMutation({
    mutationFn: () => gradingSheetsApi.markPending(sheetId ?? '', remarks),
    onSuccess: (result) => {
      toast.success(
        `${result.referenceNumber} sent back.`,
        'Give the trainer the reference number so they can reopen it.',
      );
      done();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const data = sheet.data;
  const settled = data?.status === 'APPROVED';

  return (
    <Modal
      open={sheetId !== null}
      onClose={onClose}
      title={data ? `Sheet ${data.referenceNumber}` : 'Grading sheet'}
      description={data ? `${data.courseCode} — ${data.description} · ${data.sectionCode}` : undefined}
      size="xl"
      footer={
        data && !settled ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="danger"
              disabled={approve.isPending}
              onClick={() => {
                setError(null);
                setShowSendBack((v) => !v);
              }}
            >
              Mark as pending
            </Button>
            <Button
              variant="primary"
              loading={approve.isPending}
              disabled={sendBack.isPending}
              onClick={() => {
                setError(null);
                approve.mutate();
              }}
            >
              Approve
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink-900">
                {data.filledCount} of {data.rowCount} trainees rated
              </p>
              <p className="text-xs text-ink-500">
                {data.trainerName}
                {data.submittedAt ? ` · submitted ${formatDateTime(data.submittedAt)}` : ''}
                {data.submissionCount > 1 ? ` · submission ${data.submissionCount}` : ''}
              </p>
            </div>
            <GradingSheetStatusBadge status={data.status} />
          </div>

          {!data.isComplete ? (
            <InfoNote tone="warning" title="This roster is not complete">
              {data.rowCount - data.filledCount} trainee(s) have no grade. A sheet cannot be
              approved with blanks — send it back instead.
            </InfoNote>
          ) : null}

          {/* The trainer's own record of the grades, when they attached one. */}
          <div className="no-print">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Trainer&rsquo;s grades and class record
            </p>
            <AttachmentList items={data.attachments} empty="The trainer did not attach a class record." />
          </div>

          {data.status === 'PENDING' && data.registrarRemarks ? (
            <InfoNote tone="info" title="Already sent back">
              {data.registrarRemarks}
            </InfoNote>
          ) : null}

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

          {showSendBack ? (
            <Card className="p-4">
              <Field
                label="What needs fixing?"
                htmlFor="gs-remarks"
                required
                hint="The trainer sees this when they reopen the sheet."
              >
                <TextArea
                  id="gs-remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Three trainees have no grade, and one entry is outside the 1.00–5.00 scale."
                />
              </Field>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="danger"
                  loading={sendBack.isPending}
                  disabled={!remarks.trim()}
                  onClick={() => {
                    setError(null);
                    sendBack.mutate();
                  }}
                >
                  Send back to trainer
                </Button>
              </div>
            </Card>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DescriptionItem label="Course">{data.course}</DescriptionItem>
            <DescriptionItem label="Batch">{data.batch}</DescriptionItem>
            <DescriptionItem label="Level/Semester">{data.levelSemester}</DescriptionItem>
            <DescriptionItem label="Status">
              {GRADING_SHEET_STATUS_LABELS[data.status]}
            </DescriptionItem>
          </dl>

          <TableWrap>
            <Table className="min-w-[40rem]">
              <thead>
                <tr>
                  <Th className="w-12">No.</Th>
                  <Th>Names of Trainees</Th>
                  <Th className="text-right">Grade</Th>
                  <Th className="text-right">Units</Th>
                  <Th className="text-right">Completion</Th>
                  <Th>Remarks</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const blank = row.grade === null && row.marker === null;
                  return (
                    <tr key={row.studentId} className={blank ? 'bg-warning-soft/40' : undefined}>
                      <Td className="tabular-nums text-ink-500">{row.number}</Td>
                      <Td>
                        <span className="block font-medium text-ink-900">{row.studentName}</span>
                        <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                      </Td>
                      <Td className="text-right tabular-nums font-medium text-ink-900">
                        {row.marker ? (
                          <Badge tone="neutral">{row.marker}</Badge>
                        ) : row.grade !== null ? (
                          row.grade
                        ) : (
                          <span className="text-warning-ink">— missing</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-ink-500">{row.units}</Td>
                      {/* Blank unless the grade is INC — filled once resolved. */}
                      <Td className="text-right tabular-nums text-ink-500">
                        {row.completionGrade ?? ''}
                      </Td>
                      <Td className="text-xs">{row.remarks || '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      ) : null}
    </Modal>
  );
}
