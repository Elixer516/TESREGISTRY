/**
 * The trainer's side of grading.
 *
 * Their own classes, and the sheet for whichever one is open. A sheet that
 * the registrar sent back reopens pre-filled with what was submitted — the
 * trainer edits it, never re-keys it — and can also be reached by typing the
 * reference number they were given over the phone.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ALL_GRADE_MARKERS, GRADE_MARKER_LABELS, GRADING_SHEET_STATUS_LABELS } from '@/types';
import type { GradingSheetStatus } from '@/types';
import type { GradingSheetSummaryView, GradingSheetView } from '@/types/views';
import { gradingSheetsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useSort, type SortColumn } from '@/lib/use-sort';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionItem,
  Field,
  InfoNote,
  PageHeader,
  SortableTh,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { GradingSheetStatusBadge } from './GradingSheetStatusBadge';

/**
 * Where a status sits in the trainer's workflow, not the alphabet.
 *
 * Sorting by Status is really the question "what still needs me?", so the
 * order runs from the sheets that are the trainer's move to the ones that are
 * finished with them: a sheet sent back is the most urgent thing on the page,
 * and an approved one is the least.
 */
const STATUS_ORDER: Record<GradingSheetStatus, number> = {
  PENDING: 0,
  DRAFT: 1,
  SUBMITTED: 2,
  APPROVED: 3,
};

type ClassSortKey = 'course' | 'section' | 'schedule' | 'level' | 'reference' | 'status';

const CLASS_COLUMNS: ReadonlyArray<readonly [ClassSortKey, string]> = [
  ['course', 'Course'],
  ['section', 'Section'],
  ['schedule', 'Schedule'],
  ['level', 'Level / Semester'],
  ['reference', 'Reference'],
  ['status', 'Status'],
];

export function TrainerSheets() {
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const classes = useQuery({
    queryKey: ['my-grading-classes'],
    queryFn: () => gradingSheetsApi.myClasses(),
  });

  const sortColumns = useMemo<Record<ClassSortKey, SortColumn<GradingSheetSummaryView>>>(
    () => ({
      course: { value: (row) => row.courseCode },
      section: { value: (row) => row.sectionCode },
      // Grouped by the days it meets, then chronologically within them — the
      // shape of a working week rather than a list of formatted strings.
      schedule: { value: (row) => `${row.dayPattern} ${row.startTime}` },
      level: { value: (row) => `${row.academicYearLabel} ${row.levelSemester}` },
      // Blank references belong with the drafts they came from, not scattered
      // through the numbered ones.
      reference: { value: (row) => row.referenceNumber || '￿' },
      // The column carries a status and a progress count, so it sorts by
      // both: workflow position first, and within one status the emptiest
      // sheet first, since that is the one with the most work left in it.
      status: {
        value: (row) => {
          const done = row.rowCount === 0 ? 1 : row.filledCount / row.rowCount;
          return STATUS_ORDER[row.status] * 100 + Math.round(done * 99);
        },
      },
    }),
    [],
  );

  const { sorted, sort, toggle } = useSort<GradingSheetSummaryView, ClassSortKey>(
    classes.data ?? [],
    sortColumns,
    { key: 'course', direction: 'asc' },
  );

  const lookup = useMutation({
    mutationFn: (code: string) => gradingSheetsApi.byReference(code),
    onSuccess: (sheet) => {
      setLookupError(null);
      setOpenClassId(sheet.classScheduleId);
    },
    onError: (caught) => setLookupError(errorMessage(caught)),
  });

  if (openClassId) {
    return <SheetEditor classScheduleId={openClassId} onClose={() => setOpenClassId(null)} />;
  }

  return (
    <>
      <PageHeader
        title="Grading Sheets"
        description="Your classes. Enter the grades and submit the sheet to the Registrar."
      />

      <Card className="mb-4">
        <CardHeader
          title="Reopen a sheet by reference number"
          description="If the Registrar sent a sheet back, enter the number they gave you."
        />
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Reference number" htmlFor="gs-ref" className="min-w-[14rem] flex-1">
            <TextInput
              id="gs-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="GS-202608-00001"
            />
          </Field>
          <Button
            variant="secondary"
            loading={lookup.isPending}
            disabled={!reference.trim()}
            onClick={() => {
              setLookupError(null);
              lookup.mutate(reference);
            }}
          >
            Open sheet
          </Button>
        </div>
        {lookupError ? (
          <div className="px-4 pb-4">
            <InfoNote tone="danger">{lookupError}</InfoNote>
          </div>
        ) : null}
      </Card>

      <QueryState
        isLoading={classes.isLoading}
        error={classes.error}
        isEmpty={(classes.data ?? []).length === 0}
        onRetry={() => classes.refetch()}
        loadingLabel="Loading your classes…"
        emptyTitle="No classes assigned to you"
        emptyHint="Published classes assigned to you appear here. Ask the Registrar if you expect one."
      >
        <Card>
          <TableWrap>
            <Table className="min-w-[46rem]">
              <thead>
                <tr>
                  {CLASS_COLUMNS.map(([key, label]) => (
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
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-2">
                    <Td>
                      <span className="block font-medium text-ink-900">{row.courseCode}</span>
                      <span className="block text-xs text-ink-500">{row.description}</span>
                    </Td>
                    <Td>{row.sectionCode}</Td>
                    <Td className="text-xs">
                      <span className="block">{row.dayPattern}</span>
                      <span className="block text-ink-500">{row.timeRange} · {row.room}</span>
                    </Td>
                    <Td className="text-xs">
                      <span className="block">{row.levelSemester}</span>
                      <span className="block text-ink-500">{row.academicYearLabel}</span>
                    </Td>
                    <Td className="font-mono text-xs">{row.referenceNumber || '—'}</Td>
                    <Td>
                      <GradingSheetStatusBadge status={row.status} />
                      <span className="mt-0.5 block text-[11px] text-ink-500">
                        {row.filledCount} of {row.rowCount} graded
                      </span>
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant={row.status === 'PENDING' ? 'primary' : 'secondary'}
                        onClick={() => setOpenClassId(row.classScheduleId)}
                      >
                        {row.status === 'APPROVED'
                          ? 'View'
                          : row.status === 'PENDING'
                            ? 'Fix and resubmit'
                            : 'Open'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The sheet itself                                                    */
/* ------------------------------------------------------------------ */

function SheetEditor({
  classScheduleId,
  onClose,
}: {
  classScheduleId: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const sheet = useQuery({
    queryKey: ['grading-sheet', classScheduleId],
    queryFn: () => gradingSheetsApi.forClass(classScheduleId),
  });

  // Pre-fill from what was submitted. This is what makes a sent-back sheet an
  // edit rather than a blank re-entry.
  useEffect(() => {
    if (!sheet.data) return;
    const seededEntries: Record<string, string> = {};
    const seededRemarks: Record<string, string> = {};
    for (const row of sheet.data.rows) {
      seededEntries[row.studentId] =
        row.marker ?? row.grade ?? '';
      seededRemarks[row.studentId] = row.remarks;
    }
    setEntries(seededEntries);
    setRemarks(seededRemarks);
  }, [sheet.data]);

  const submit = useMutation({
    mutationFn: (data: GradingSheetView) =>
      gradingSheetsApi.submit(
        data.classScheduleId,
        data.rows.map((row) => ({
          studentId: row.studentId,
          value: entries[row.studentId] ?? '',
          remarks: remarks[row.studentId] ?? '',
        })),
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-grading-classes'] });
      queryClient.invalidateQueries({ queryKey: ['grading-sheet', classScheduleId] });
      toast.success(
        `Sheet ${result.referenceNumber} submitted.`,
        'The Registrar will review it. Keep the reference number.',
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const data = sheet.data;
  const locked = data?.status === 'APPROVED' || data?.status === 'SUBMITTED';

  return (
    <>
      <PageHeader
        title="Grading Sheet"
        description={data ? `${data.courseCode} — ${data.description}` : 'Loading…'}
        breadcrumb={
          <button type="button" onClick={onClose} className="text-brand-text hover:underline">
            ← Back to my classes
          </button>
        }
        actions={
          data && !locked ? (
            <Button
              variant="primary"
              loading={submit.isPending}
              onClick={() => {
                setError(null);
                submit.mutate(data);
              }}
            >
              {data.status === 'PENDING' ? 'Resubmit sheet' : 'Submit sheet'}
            </Button>
          ) : undefined
        }
      />

      <QueryState
        isLoading={sheet.isLoading}
        error={sheet.error}
        isEmpty={!data}
        onRetry={() => sheet.refetch()}
        loadingLabel="Loading the sheet…"
        emptyTitle="That sheet could not be loaded"
      >
        {data ? (
          <div className="space-y-4">
            {data.status === 'PENDING' && data.registrarRemarks ? (
              <InfoNote tone="warning" title="The Registrar sent this back">
                {data.registrarRemarks}
              </InfoNote>
            ) : null}
            {data.status === 'SUBMITTED' ? (
              <InfoNote tone="info" title="With the Registrar for review">
                Submitted {data.submittedAt ? formatDateTime(data.submittedAt) : ''}. You will be
                able to edit this only if it is sent back.
              </InfoNote>
            ) : null}
            {data.status === 'APPROVED' ? (
              <InfoNote tone="success" title="Approved">
                These grades are on the trainees&rsquo; records. Ask the Registrar if something
                needs correcting.
              </InfoNote>
            ) : null}

            <Card>
              <CardHeader
                title={`Reference ${data.referenceNumber || '— not yet issued'}`}
                actions={<GradingSheetStatusBadge status={data.status} />}
              />
              <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
                <DescriptionItem label="Course Code">{data.courseCode}</DescriptionItem>
                <DescriptionItem label="Description">{data.description}</DescriptionItem>
                <DescriptionItem label="Course">{data.course}</DescriptionItem>
                <DescriptionItem label="Batch">{data.batch}</DescriptionItem>
                <DescriptionItem label="Level/Semester">{data.levelSemester}</DescriptionItem>
                <DescriptionItem label="Section">{data.sectionCode}</DescriptionItem>
              </dl>
            </Card>

            {error ? <InfoNote tone="danger" title="Nothing was submitted">{error}</InfoNote> : null}

            <Card>
              <CardHeader
                title="Trainees"
                description="Enter grades on the 1.00–5.00 scale — 1.00 is highest, 3.00 is the passing mark (the 75% equivalent). For anyone without a number, enter INC, DRP or NG."
              />
              <TableWrap>
                <Table className="min-w-[44rem]">
                  <thead>
                    <tr>
                      <Th className="w-12">No.</Th>
                      <Th>Names of Trainees</Th>
                      <Th className="w-36">Final Rating</Th>
                      <Th>Remarks</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.studentId}>
                        <Td className="tabular-nums text-ink-500">{row.number}</Td>
                        <Td>
                          <span className="block font-medium text-ink-900">{row.studentName}</span>
                          <span className="block text-xs text-ink-500">{row.studentNumber}</span>
                        </Td>
                        <Td>
                          <TextInput
                            value={entries[row.studentId] ?? ''}
                            disabled={locked}
                            onChange={(e) =>
                              setEntries((current) => ({
                                ...current,
                                [row.studentId]: e.target.value,
                              }))
                            }
                            placeholder="e.g. 1.50 or INC"
                            aria-label={`Grade for ${row.studentName}`}
                          />
                          {row.grade ? (
                            <span className="mt-0.5 block text-[11px] text-ink-500">
                              = {row.grade}
                            </span>
                          ) : null}
                        </Td>
                        <Td>
                          <TextInput
                            value={remarks[row.studentId] ?? ''}
                            disabled={locked}
                            onChange={(e) =>
                              setRemarks((current) => ({
                                ...current,
                                [row.studentId]: e.target.value,
                              }))
                            }
                            aria-label={`Remarks for ${row.studentName}`}
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 text-xs text-ink-500">
                <span>Markers:</span>
                {ALL_GRADE_MARKERS.map((marker) => (
                  <Badge key={marker} tone="neutral">
                    {marker} — {GRADE_MARKER_LABELS[marker]}
                  </Badge>
                ))}
                <span className="ml-auto">
                  {data.filledCount} of {data.rowCount} filled ·{' '}
                  {GRADING_SHEET_STATUS_LABELS[data.status]}
                </span>
              </div>
            </Card>
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
