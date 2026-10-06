import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DropCaseStatus } from '@/types';
import { DROP_CASE_STATUS_LABELS } from '@/types';
import type { DropCaseView } from '@/types/views';
import { catalogApi, dropsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Tabs,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/states';
import { StudentPicker } from '@/components/pickers';
import { ReportHeader, ReportSignatures, downloadCsv } from '../reports/report-parts';
import { DROP_STATUS_TONE, DropCaseModal } from './DropCaseModal';

type Tab = DropCaseStatus | 'ALL';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'FOR_REVIEW', label: 'For review' },
  { value: 'DROPPED', label: 'Dropped' },
  { value: 'REINSTATED', label: 'Reinstated' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

/**
 * Drops — every trainee leaving their diploma, as a case.
 *
 * The For review tab leads with the trainees the 79% line flags who have no
 * case yet, then the cases being looked into. Nothing is dropped from this
 * page without opening a case, giving a reason, and attaching proof.
 */
export function DropsPage() {
  const [tab, setTab] = useState<Tab>('FOR_REVIEW');
  const [search, setSearch] = useState('');
  const [programId, setProgramId] = useState('');
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const programs = useQuery({ queryKey: ['programs'], queryFn: () => catalogApi.listPrograms() });
  const cases = useQuery({
    queryKey: ['drop-cases', tab, search, programId],
    queryFn: () => dropsApi.list({ status: tab, search, programId: programId || undefined }),
  });
  const counts = useQuery({
    queryKey: ['drop-cases', 'counts'],
    queryFn: () => dropsApi.list({ status: 'ALL' }),
  });
  const candidates = useQuery({
    queryKey: ['drop-candidates'],
    queryFn: () => dropsApi.candidates(),
  });

  const open = useMutation({
    mutationFn: (input: { studentId: string; origin: 'STANDING' | 'MANUAL' }) => dropsApi.open(input),
    onSuccess: async (opened) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['drop-cases'] }),
        queryClient.invalidateQueries({ queryKey: ['drop-candidates'] }),
      ]);
      setOpenCaseId(opened.id);
    },
    onError: (caught) => toast.error('Could not open a case.', errorMessage(caught)),
  });

  // Arriving from the standing review with a trainee: open (or find) their case.
  const handled = useRef(false);
  useEffect(() => {
    const studentId = (location.state as { studentId?: string } | null)?.studentId;
    if (!studentId || handled.current) return;
    handled.current = true;
    open.mutate({ studentId, origin: 'STANDING' });
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, open]);

  const all = counts.data ?? [];
  const countOf = (status: DropCaseStatus) => all.filter((c) => c.status === status).length;
  const tabs = TABS.map((t) => ({
    ...t,
    label:
      t.value === 'ALL'
        ? `All (${all.length})`
        : `${t.label} (${countOf(t.value) + (t.value === 'FOR_REVIEW' ? (candidates.data?.length ?? 0) : 0)})`,
  }));
  const rows = cases.data ?? [];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Drops"
          description="Dropping a trainee from their diploma, as a case: opened, looked into, and confirmed with a reason and proof — or closed without a drop. Every step is kept."
          actions={
            <>
              <Button variant="secondary" disabled={rows.length === 0} onClick={() => exportCsv(rows, tab)}>
                Export CSV
              </Button>
              <Button variant="secondary" disabled={rows.length === 0} onClick={() => window.print()}>
                Print
              </Button>
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                Start a drop case
              </Button>
            </>
          }
        />

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Tabs options={tabs} value={tab} onChange={setTab} ariaLabel="Drop cases" />
          <TextInput
            type="search"
            className="max-w-xs"
            placeholder="Search name, ID or case number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search drop cases"
          />
          <Select
            className="max-w-xs"
            value={programId}
            onChange={(event) => setProgramId(event.target.value)}
            aria-label="Diploma"
          >
            <option value="">All diplomas</option>
            {(programs.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </Select>
        </div>

        {tab === 'FOR_REVIEW' && (candidates.data ?? []).length > 0 ? (
          <Card className="mb-4">
            <CardHeader
              title="Flagged by the 79% line — no case yet"
              description="75% and below is recommended for drop; 76–79% is for review. Opening a case changes nothing on the trainee's record."
            />
            <ul className="divide-y divide-line">
              {(candidates.data ?? []).map((c) => (
                <li key={c.student.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">
                      {c.student.lastFirstName}{' '}
                      <span className="text-xs font-normal text-ink-500">
                        {c.student.studentNumber} · {c.student.programCode} · Year {c.student.yearLevel}
                      </span>
                    </p>
                    <p className="text-xs text-ink-700">
                      {c.subjects
                        .slice(0, 3)
                        .map((s) => `${s.subjectCode} ${s.percentage !== null ? `${s.percentage}%` : s.grade}`)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge tone={c.recommendation === 'DROP' ? 'danger' : 'warning'}>
                    {c.recommendation === 'DROP' ? 'Recommended for drop' : 'For review'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={open.isPending && open.variables?.studentId === c.student.id}
                    onClick={() => open.mutate({ studentId: c.student.id, origin: 'STANDING' })}
                  >
                    Open case
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Card className="p-4">
        {cases.isLoading ? (
          <LoadingState label="Loading drop cases…" rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={tab === 'FOR_REVIEW' ? 'No case under review' : 'No cases here'}
            hint="Open a case from a flagged trainee above, or start one for any trainee."
          />
        ) : (
          <div className="print-sheet report-sheet space-y-4">
            <div className="hidden print:block">
              <ReportHeader
                title="Drop Cases"
                subtitle={tab === 'ALL' ? 'All cases' : DROP_CASE_STATUS_LABELS[tab]}
                generatedAt={new Date().toISOString()}
              />
            </div>
            <TableWrap>
              <Table className="min-w-[52rem] text-sm">
                <thead>
                  <tr>
                    <Th>Case</Th>
                    <Th>Trainee</Th>
                    <Th>Reason</Th>
                    <Th>Effective</Th>
                    <Th className="text-right">Proof</Th>
                    <Th>Status</Th>
                    <Th className="no-print text-right">
                      <span className="sr-only">Open</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <Td className="whitespace-nowrap font-mono text-xs">{row.caseNumber}</Td>
                      <Td>
                        <span className="block font-medium text-ink-900">{row.student.lastFirstName}</span>
                        <span className="block text-xs text-ink-500">
                          {row.student.studentNumber} · {row.student.programCode} · Year {row.student.yearLevel}
                        </span>
                      </Td>
                      <Td>
                        {row.reasonLabel ?? <span className="text-ink-400">Not yet given</span>}
                        {row.institutionInitiated !== null ? (
                          <span className="block text-[11px] text-ink-500">
                            {row.institutionInitiated ? 'Centre-initiated' : 'Trainee-initiated'}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="whitespace-nowrap text-ink-700">
                        {row.effectiveDate
                          ? formatDate(row.effectiveDate)
                          : row.droppedAt
                            ? formatDate(row.droppedAt)
                            : '—'}
                      </Td>
                      <Td className="text-right tabular-nums">{row.attachments.length}</Td>
                      <Td>
                        <Badge tone={DROP_STATUS_TONE[row.status]}>{DROP_CASE_STATUS_LABELS[row.status]}</Badge>
                      </Td>
                      <Td className="no-print text-right">
                        <Button size="sm" variant="secondary" onClick={() => setOpenCaseId(row.id)}>
                          Open
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
            <div className="hidden print:block">
              <ReportSignatures />
            </div>
          </div>
        )}
      </Card>

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Start a drop case"
        description="Choose the trainee. Nothing changes on their record until the drop is confirmed."
        statuses={['APPROVED', 'ACTIVE', 'INACTIVE']}
        onSelect={(student) => {
          setPickerOpen(false);
          open.mutate({ studentId: student.id, origin: 'MANUAL' });
        }}
      />

      <DropCaseModal caseId={openCaseId} onClose={() => setOpenCaseId(null)} />
    </>
  );
}

function exportCsv(rows: DropCaseView[], tab: Tab) {
  downloadCsv(`drop-cases-${tab.toLowerCase()}.csv`, [
    ['Case', 'ID Number', 'Name', 'Diploma', 'Year', 'Status', 'Reason', 'Initiated by', 'Effective date', 'Note', 'Attachments', 'Links'],
    ...rows.map((r) => [
      r.caseNumber,
      r.student.studentNumber,
      r.student.lastFirstName,
      r.student.programCode,
      r.student.yearLevel,
      DROP_CASE_STATUS_LABELS[r.status],
      r.reasonLabel ?? '',
      r.institutionInitiated === null ? '' : r.institutionInitiated ? 'Centre' : 'Trainee',
      r.effectiveDate ?? r.droppedAt?.slice(0, 10) ?? '',
      r.note,
      r.attachments.map((a) => a.name).join('; '),
      r.attachments.map((a) => a.url).join(' '),
    ]),
  ]);
}
