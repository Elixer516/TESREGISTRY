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
import type { GradeDeadline, GradingSheetSummaryView } from '@/types/views';
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
import { DeadlineBadge, GradeDeadlineAlerts } from './DeadlineBadge';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { StudentGradingSheetModal } from './StudentGradingSheetModal';
import { ClassDeadlineModal } from './ClassDeadlineModal';
import { StudentPicker } from '@/components/pickers';
import type { StudentView } from '@/types/views';

const YEAR_WORDING: Record<string, string> = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };

/** "DIT 1 - Section 1" → year level "1" and batch (the section) "1". */
function splitSection(sectionCode: string): { yearLevel: string; batch: string } {
  const m = sectionCode.match(/(\d+)\s*-\s*Section\s*(\d+)/i);
  return m ? { yearLevel: m[1], batch: m[2] } : { yearLevel: '', batch: '' };
}

/** "Late": past the deadline, or handed in after it. "On track": everything else that has one. */
function deadlineBucket(d: GradeDeadline): 'LATE' | 'ON_TRACK' | 'NONE' {
  if (d.state === 'OVERDUE' || d.state === 'LATE') return 'LATE';
  return d.state === 'NONE' ? 'NONE' : 'ON_TRACK';
}

type QueueSortKey =
  | 'reference'
  | 'course'
  | 'section'
  | 'trainer'
  | 'roster'
  | 'status'
  | 'submitted';

const QUEUE_COLUMNS: ReadonlyArray<readonly [QueueSortKey, string]> = [
  ['reference', 'Reference'],
  ['course', 'Course'],
  ['section', 'Section'],
  ['trainer', 'Trainer'],
  ['roster', 'Roster'],
  ['status', 'Status'],
  ['submitted', 'Submitted'],
];

/**
 * Where a status sits in the REGISTRAR's queue, which is not the order the
 * trainer sees it in. Submitted comes first because it is the registrar's
 * move; pending is sitting with the trainer; approved is finished with.
 */
const QUEUE_STATUS_ORDER: Record<GradingSheetStatus, number> = {
  SUBMITTED: 0,
  PENDING: 1,
  DRAFT: 2,
  APPROVED: 3,
};

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
  const all = sheets.data ?? [];
  const deadlineAlerts = useQuery({
    queryKey: ['grade-deadline-alerts'],
    queryFn: () => gradeDeadlinesApi.alerts(),
  });
  const programs = useQuery({ queryKey: ['programs', 'all'], queryFn: () => catalogApi.listPrograms(true) });

  // Every diploma gets a tab, with how many sheets it has.
  const diplomaTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of all) counts.set(r.programCode, (counts.get(r.programCode) ?? 0) + 1);
    const codes = new Set([...(programs.data ?? []).filter((p) => p.isActive).map((p) => p.code), ...counts.keys()]);
    return [
      { value: 'ALL', label: 'All diplomas', count: all.length },
      ...[...codes].sort().map((code) => ({ value: code, label: code, count: counts.get(code) ?? 0 })),
    ];
  }, [all, programs.data]);

  const inDiploma = useMemo(
    () => (diploma === 'ALL' ? all : all.filter((r) => r.programCode === diploma)),
    [all, diploma],
  );
  const alertsInDiploma = useMemo(
    () => (deadlineAlerts.data ?? []).filter((a) => diploma === 'ALL' || a.programCode === diploma),
    [deadlineAlerts.data, diploma],
  );

  const filterGroups = useMemo<FilterGroup[]>(() => {
    const sections = [...inDiploma.map((r) => r.sectionCode), ...alertsInDiploma.map((a) => a.sectionCode)].map(splitSection);
    const years = [...new Set(sections.map((x) => x.yearLevel))].filter(Boolean).sort();
    const batches = [...new Set(sections.map((x) => x.batch))].filter(Boolean).sort((a, b) => Number(a) - Number(b));
    const statuses = new Set(inDiploma.map((r) => r.status));
    return [
      {
        key: 'status',
        label: 'sheet',
        chips: (Object.keys(QUEUE_STATUS_ORDER) as GradingSheetStatus[])
          .sort((a, b) => QUEUE_STATUS_ORDER[a] - QUEUE_STATUS_ORDER[b])
          .filter((st) => statuses.has(st))
          .map((st) => ({ value: st, label: GRADING_SHEET_STATUS_LABELS[st] })),
      },
      { key: 'year', label: 'year level', chips: years.map((y) => ({ value: y, label: YEAR_WORDING[y] ?? `Year ${y}` })) },
      { key: 'batch', label: 'batch', chips: batches.map((b) => ({ value: b, label: `Batch ${b}`, title: `Section ${b}` })) },
      {
        key: 'deadline',
        label: 'deadline',
        chips: [
          { value: 'LATE', label: 'Late' },
          { value: 'ON_TRACK', label: 'On track' },
        ],
      },
    ];
  }, [inDiploma, alertsInDiploma]);

  /** What a row offers each filter group; the alerts have no sheet status. */
  const valuesOf = (sectionCode: string, deadline: GradeDeadline, status: string | null) => (key: string) => {
    const { yearLevel, batch } = splitSection(sectionCode);
    switch (key) {
      case 'status': return status;
      case 'year': return yearLevel;
      case 'batch': return batch;
      case 'deadline': return deadlineBucket(deadline);
      default: return null;
    }
  };
  const needle = search.trim().toLowerCase();
  const visibleSheets = useMemo(
    () =>
      inDiploma.filter(
        (r) =>
          matchesSelection(filters, valuesOf(r.sectionCode, r.deadline, r.status)) &&
          (!needle ||
            `${r.referenceNumber} ${r.courseCode} ${r.description} ${r.sectionCode} ${r.trainerName}`.toLowerCase().includes(needle)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inDiploma, filters, needle],
  );
  // The overdue list follows the diploma, search, year, batch and deadline; it has no sheet to filter on.
  const visibleAlerts = useMemo(
    () =>
      alertsInDiploma.filter(
        (a) =>
          matchesSelection({ ...filters, status: [] }, valuesOf(a.sectionCode, a.deadline, null)) &&
          (!needle || `${a.subjectCode} ${a.subjectTitle} ${a.sectionCode} ${a.trainerName}`.toLowerCase().includes(needle)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alertsInDiploma, filters, needle],
  );
  const filtersOn = Object.values(filters).some((v) => v.length > 0) || needle !== '';

  const sortColumns = useMemo<Record<QueueSortKey, SortColumn<GradingSheetSummaryView>>>(
    () => ({
      reference: { value: (row) => row.referenceNumber || '￿' },
      course: { value: (row) => row.courseCode },
      section: { value: (row) => `${row.sectionCode} ${row.levelSemester}` },
      trainer: { value: (row) => row.trainerName },
      // Least complete first: a half-filled sheet is the one with a problem
      // in it, and the finished ones need no attention.
      roster: { value: (row) => (row.rowCount === 0 ? -1 : row.filledCount / row.rowCount) },
      status: { value: (row) => QUEUE_STATUS_ORDER[row.status] },
      // Newest first, matching the order the service already returns and the
      // way a queue is normally read.
      submitted: { value: (row) => row.submittedAt ?? '', defaultDirection: 'desc' },
    }),
    [],
  );

  const { sorted, sort, toggle } = useSort<GradingSheetSummaryView, QueueSortKey>(
    visibleSheets,
    sortColumns,
    { key: 'submitted', direction: 'desc' },
  );

  /**
   * Split into one block per diploma.
   *
   * A flat list of sixteen sheets from one diploma reads fine; the same list
   * across eight does not, because the eye has nothing to hold on to. The
   * groups are ordered by diploma code and the chosen sort runs INSIDE each
   * one, so sorting rearranges rows without scattering the diplomas.
   */
  const groups = useMemo(() => {
    const byProgram = new Map<string, GradingSheetSummaryView[]>();
    for (const row of sorted) {
      const key = row.programCode;
      const bucket = byProgram.get(key);
      if (bucket) bucket.push(row);
      else byProgram.set(key, [row]);
    }
    return [...byProgram.entries()]
      .map(([programCode, rows]) => ({
        programCode,
        programName: rows[0]?.course ?? '',
        rows,
        awaiting: rows.filter((r) => r.status === 'SUBMITTED').length,
        incomplete: rows.filter((r) => !r.isComplete).length,
      }))
      .sort((a, b) => a.programCode.localeCompare(b.programCode));
  }, [sorted]);

  /**
   * Which diploma blocks are folded away.
   *
   * Collapsed rather than hidden: the header keeps its counts, so a folded
   * block still says how many sheets it holds and how many are waiting. That
   * is the point of folding it — a registrar working through one diploma can
   * put the other seven out of the way without losing sight of whether
   * anything in them needs them.
   *
   * Held by diploma code rather than by index, so the set survives sorting
   * and re-filtering; and stored as the collapsed ones rather than the open
   * ones, so a diploma appearing for the first time is open by default.
   */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // The per-subject queue answers "how is this class doing?". This answers
  // "how is this trainee doing?" — the other question a registrar arrives
  // with, and one the queue's own shape cannot express.
  const [sheetStudent, setSheetStudent] = useState<StudentView | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.programCode));

  function toggleGroup(programCode: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(programCode)) next.delete(programCode);
      else next.add(programCode);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Grading Sheets"
        description="Submissions from trainers. Approving a sheet is what posts its grades to trainee records."
        actions={
          <>
            <Button variant="secondary" onClick={() => setStudentPickerOpen(true)}>
              View a student&rsquo;s grading sheet
            </Button>
            {groups.length > 1 ? (
              <Button
                variant="secondary"
                onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.programCode)))}
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
            ) : null}
          </>
        }
      />

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

      {visibleAlerts.length > 0 ? (
        <div className="mb-4">
          <GradeDeadlineAlerts alerts={visibleAlerts} onSetDeadline={setDeadlineFor} />
        </div>
      ) : null}

      <QueryState
        isLoading={sheets.isLoading}
        error={sheets.error}
        isEmpty={visibleSheets.length === 0}
        onRetry={() => sheets.refetch()}
        loadingLabel="Loading grading sheets…"
        emptyTitle={filtersOn ? 'No grading sheets match these filters' : 'No grading sheets yet'}
        emptyHint={filtersOn ? 'Clear a filter or the search to see more.' : 'Sheets appear here once a trainer submits one.'}
      >
        <Card>
          <TableWrap>
            <Table className="min-w-[62rem]">
              <thead>
                <tr>
                  {QUEUE_COLUMNS.map(([key, label]) => (
                    <SortableTh
                      key={key}
                      active={sort.key === key}
                      direction={sort.direction}
                      onClick={() => toggle(key)}
                    >
                      {label}
                    </SortableTh>
                  ))}
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              {groups.map((group) => (
              <tbody key={group.programCode}>
                <tr className="bg-surface-2">
                  <Td colSpan={8} className="border-b border-line p-0">
                    <button
                      type="button"
                      aria-expanded={!collapsed.has(group.programCode)}
                      onClick={() => toggleGroup(group.programCode)}
                      className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-surface-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                    >
                      <span
                        aria-hidden
                        className={`text-[10px] leading-none text-ink-500 transition-transform ${
                          collapsed.has(group.programCode) ? '' : 'rotate-90'
                        }`}
                      >
                        ▶
                      </span>
                      <span className="text-sm font-semibold text-ink-900">
                        {group.programCode}
                      </span>
                      <span className="text-xs text-ink-500">{group.programName}</span>
                      <span className="ml-auto text-[11px] text-ink-500">
                        {group.rows.length} sheet{group.rows.length === 1 ? '' : 's'}
                        {group.awaiting > 0 ? ` · ${group.awaiting} awaiting review` : ''}
                        {group.incomplete > 0 ? ` · ${group.incomplete} incomplete` : ''}
                      </span>
                    </button>
                  </Td>
                </tr>
                {(collapsed.has(group.programCode) ? [] : group.rows).map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2">
                    <Td className="font-mono text-xs">{row.referenceNumber}</Td>
                    <Td>
                      <span className="block font-medium text-ink-900">{row.courseCode}</span>
                      <span className="block text-xs text-ink-500">{row.description}</span>
                    </Td>
                    <Td>
                      <span className="block">{row.sectionCode}</span>
                      <span className="block text-[11px] text-ink-500">
                        {row.levelSemester} · {row.academicYearLabel}
                      </span>
                    </Td>
                    <Td className="text-xs">{row.trainerName}</Td>
                    <Td>
                      {row.isComplete ? (
                        <Badge tone="success">Complete</Badge>
                      ) : (
                        <Badge tone="warning">
                          {row.filledCount} of {row.rowCount}
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      <GradingSheetStatusBadge status={row.status} />
                      {row.deadline.state === 'LATE' ? (
                        <span className="mt-0.5 block">
                          <DeadlineBadge deadline={row.deadline} />
                        </span>
                      ) : null}
                      {row.submissionCount > 1 ? (
                        <span className="mt-0.5 block text-[11px] text-ink-500">
                          submission {row.submissionCount}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-500">
                      {row.submittedAt ? (
                        <>
                          <span className="block text-ink-700">
                            {relativeTime(row.submittedAt)}
                          </span>
                          <span className="block">{formatDateTime(row.submittedAt)}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="text-right">
                      <span className="inline-flex flex-col items-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setOpenId(row.id)}>
                          Review
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeadlineFor(row.classScheduleId)}
                          className="text-[11px] font-medium text-brand-text hover:underline"
                          title={row.deadline.dueDate ? `Grades due ${row.deadline.dueDate}` : 'No deadline set'}
                        >
                          Set deadline
                        </button>
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
