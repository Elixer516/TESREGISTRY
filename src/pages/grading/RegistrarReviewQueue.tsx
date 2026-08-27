/**
 * The registrar's side of grading.
 *
 * They no longer encode grades — they check whether a submitted roster is
 * complete, then either approve it (which is what posts the grades) or send
 * it back with a reason. Every sheet is listed with its reference number,
 * because that number is how the two sides talk about it on the phone.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GradingSheetStatus } from '@/types';
import { GRADING_SHEET_STATUS_LABELS } from '@/types';
import { gradingSheetsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
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
  Tabs,
  Td,
  TextArea,
  TextInput,
  Th,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { GradingSheetStatusBadge } from './GradingSheetStatusBadge';

type TabValue = GradingSheetStatus | 'ALL';

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
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Course</Th>
                  <Th>Section</Th>
                  <Th>Trainer</Th>
                  <Th>Roster</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {(sheets.data ?? []).map((row) => (
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
                    <Td className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setOpenId(row.id)}>
                        Review
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
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
              {data.rowCount - data.filledCount} trainee(s) have no rating. A sheet cannot be
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
                  placeholder="Three trainees have no rating, and ALBUTRA's 105% is out of range."
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
                  <Th className="text-right">Final Rating</Th>
                  <Th className="text-right">Equivalent</Th>
                  <Th>Remarks</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => {
                  const blank = row.percentage === null && row.marker === null;
                  return (
                    <tr key={row.studentId} className={blank ? 'bg-warning-soft/40' : undefined}>
                      <Td className="tabular-nums text-ink-500">{row.number}</Td>
                      <Td>
                        <span className="block font-medium text-ink-900">{row.studentName}</span>
                        <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {row.marker ? (
                          <Badge tone="neutral">{row.marker}</Badge>
                        ) : row.percentage !== null ? (
                          `${row.percentage}%`
                        ) : (
                          <span className="text-warning-ink">— missing</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums text-ink-500">
                        {row.grade ?? '—'}
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
