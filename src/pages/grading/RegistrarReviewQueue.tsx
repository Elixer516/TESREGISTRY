/**
 * The registrar's side of grading.
 *
 * They no longer encode grades — they check whether a submitted roster is
 * complete, then either approve it (which is what posts the grades) or send
 * it back with a reason. Every sheet is listed with its reference number,
 * because that number is how the two sides talk about it on the phone.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GradingSheetStatus } from '@/types';
import type { GradingSheetSummaryView } from '@/types/views';
import { GRADING_SHEET_STATUS_LABELS } from '@/types';
import { gradingSheetsApi } from '@/api';
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

type TabValue = GradingSheetStatus | 'ALL';

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
  const [tab, setTab] = useState<TabValue>('SUBMITTED');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const sheets = useQuery({
    queryKey: ['grading-sheets', tab, search],
    queryFn: () => gradingSheetsApi.list({ status: tab, search }),
  });

  const counts = useQuery({
    queryKey: ['grading-sheets', 'ALL', ''],
    queryFn: () => gradingSheetsApi.list({ status: 'ALL' }),
  });
  const all = counts.data ?? [];

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
    sheets.data ?? [],
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

  return (
    <>
      <PageHeader
        title="Grading Sheets"
        description="Submissions from trainers. Approving a sheet is what posts its grades to trainee records."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs<TabValue>
          ariaLabel="Grading sheet status"
          value={tab}
          onChange={setTab}
          options={[
            {
              value: 'SUBMITTED',
              label: 'Submitted',
              count: all.filter((s) => s.status === 'SUBMITTED').length,
            },
            {
              value: 'PENDING',
              label: 'Pending',
              count: all.filter((s) => s.status === 'PENDING').length,
            },
            {
              value: 'APPROVED',
              label: 'Approved',
              count: all.filter((s) => s.status === 'APPROVED').length,
            },
            { value: 'ALL', label: 'All', count: all.length },
          ]}
        />
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, course, section or trainer…"
            aria-label="Search grading sheets"
          />
        </div>
      </div>

      <QueryState
        isLoading={sheets.isLoading}
        error={sheets.error}
        isEmpty={(sheets.data ?? []).length === 0}
        onRetry={() => sheets.refetch()}
        loadingLabel="Loading grading sheets…"
        emptyTitle={
          tab === 'SUBMITTED' ? 'Nothing waiting for review' : 'Nothing in this tab yet'
        }
        emptyHint="Sheets appear here once a trainer submits one."
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
                  <Td colSpan={8} className="border-b border-line py-2">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm font-semibold text-ink-900">
                        {group.programCode}
                      </span>
                      <span className="text-xs text-ink-500">{group.programName}</span>
                      <span className="ml-auto text-[11px] text-ink-500">
                        {group.rows.length} sheet{group.rows.length === 1 ? '' : 's'}
                        {group.awaiting > 0 ? ` · ${group.awaiting} awaiting review` : ''}
                        {group.incomplete > 0 ? ` · ${group.incomplete} incomplete` : ''}
                      </span>
                    </div>
                  </Td>
                </tr>
                {group.rows.map((row) => (
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
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(row.id)}>
                        Review
                      </Button>
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
