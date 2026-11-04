/**
 * The Guidance Office's submission monitor: who has answered the Faculty
 * Evaluation and who still owes one, by trainee and by class, so the office
 * can follow up with whoever is behind. It shows that a trainee answered,
 * never what they answered; the combined results are on the Results page.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type { GuidanceSubmissionRow } from '@/types/views';
import { guidanceApi } from '@/api';
import { formatDate, formatDateTime } from '@/lib/format';
import { useSort, type SortColumn } from '@/lib/use-sort';
import { Badge, Button, Card, Modal, PageHeader, SortableTh, Table, TableWrap, Tabs, Td, TextInput, Th } from '@/components/ui';
import { QueryState } from '@/components/states';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { downloadCsv } from '@/pages/reports/report-parts';
import {
  DiplomaTabs,
  NothingHere,
  ProgressBar,
  ScopeTabs,
  StatusBadge,
  Tile,
  inScope,
  statusLabel,
  type Scope,
} from './guidance-parts';

type Grouping = 'TRAINEE' | 'CLASS';

const STATUS_CHIPS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NOT_OPEN', label: 'Not open yet', title: 'The grade is not posted, so the form has not opened' },
];

export function GuidancePage() {
  const [scope, setScope] = useState<Scope>('ALL');
  const [diploma, setDiploma] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterSelection>({});
  const [grouping, setGrouping] = useState<Grouping>('TRAINEE');
  const [openTrainee, setOpenTrainee] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['guidance-submissions'], queryFn: () => guidanceApi.submissions() });
  const all = useMemo(() => query.data ?? [], [query.data]);

  const scoped = useMemo(() => inScope(all, scope), [all, scope]);
  const inDiploma = useMemo(
    () => (diploma === 'ALL' ? scoped : scoped.filter((r) => r.programCode === diploma)),
    [scoped, diploma],
  );

  // Chips come from the rows in view, so a choice never leads to nothing.
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const uniq = <T,>(values: T[]) => [...new Set(values)];
    return [
      {
        key: 'year',
        label: 'School year',
        chips: uniq(inDiploma.map((r) => r.academicYearLabel)).sort().reverse().map((v) => ({ value: v, label: v })),
      },
      {
        key: 'semester',
        label: 'Semester',
        chips: (['FIRST', 'SECOND', 'SUMMER'] as const)
          .filter((p) => inDiploma.some((r) => r.semesterPeriod === p))
          .map((p) => ({ value: p, label: SEMESTER_PERIOD_LABELS[p] })),
      },
      {
        key: 'level',
        label: 'Year level',
        chips: uniq(inDiploma.map((r) => r.yearLevel))
          .sort((a, b) => a - b)
          .map((v) => ({ value: String(v), label: yearLevelLabel(v) })),
      },
      {
        key: 'batch',
        label: 'Batch',
        chips: uniq(inDiploma.map((r) => r.batch).filter(Boolean))
          .sort((a, b) => Number(a) - Number(b))
          .map((v) => ({ value: v, label: `Batch ${v}`, title: `Section ${v}` })),
      },
      {
        key: 'trainer',
        label: 'Trainer',
        chips: uniq(inDiploma.map((r) => r.trainerName)).sort().map((v) => ({ value: v, label: v })),
      },
      { key: 'status', label: 'Status', chips: STATUS_CHIPS },
    ];
  }, [inDiploma]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inDiploma.filter(
      (r) =>
        (!needle ||
          `${r.studentName} ${r.studentNumber} ${r.subjectCode} ${r.subjectTitle} ${r.trainerName} ${r.sectionCode}`
            .toLowerCase()
            .includes(needle)) &&
        matchesSelection(filters, (key) =>
          key === 'year'
            ? r.academicYearLabel
            : key === 'semester'
              ? r.semesterPeriod
              : key === 'level'
                ? String(r.yearLevel)
                : key === 'batch'
                  ? r.batch
                  : key === 'trainer'
                    ? r.trainerName
                    : key === 'status'
                      ? r.status
                      : null,
        ),
    );
  }, [inDiploma, search, filters]);

  const narrowed = search.trim() !== '' || Object.values(filters).some((v) => v.length > 0);
  const clearAll = () => {
    setSearch('');
    setFilters({});
  };

  const stats = useMemo(() => {
    const submitted = filtered.filter((r) => r.status === 'SUBMITTED').length;
    const pending = filtered.filter((r) => r.status === 'PENDING').length;
    const owed = submitted + pending;
    return {
      submitted,
      pending,
      notOpen: filtered.filter((r) => r.status === 'NOT_OPEN').length,
      rate: owed ? Math.round((submitted / owed) * 100) : null,
      trainees: new Set(filtered.map((r) => r.studentId)).size,
      classes: new Set(filtered.map((r) => r.classScheduleId)).size,
      behind: new Set(filtered.filter((r) => r.status === 'PENDING').map((r) => r.studentId)).size,
    };
  }, [filtered]);

  function exportCsv() {
    downloadCsv(`faculty-evaluation-submissions-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['ID Number', 'Trainee', 'Diploma', 'Section', 'School year', 'Term', 'Subject', 'Trainer', 'Status', 'Submitted'],
      ...filtered.map((r) => [
        r.studentNumber,
        r.studentName,
        r.programCode,
        r.sectionCode,
        r.academicYearLabel,
        r.termLabel,
        r.subjectCode,
        r.trainerName,
        statusLabel(r.status),
        r.submittedAt ? formatDateTime(r.submittedAt) : '',
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Evaluation Submissions"
        description="Who has submitted the Faculty Evaluation and who has not, by trainee and by class. Answers stay anonymous: this page shows only whether each form was submitted."
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-3">
        <ScopeTabs value={scope} onChange={setScope} rows={all} />
      </div>
      <DiplomaTabs value={diploma} onChange={setDiploma} codes={all.map((r) => r.programCode)} counted={scoped} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trainee, ID Number, subject, trainer or section…"
            aria-label="Search submissions"
          />
        </div>
        <FilterPanel groups={filterGroups} value={filters} onChange={setFilters} />
      </div>

      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} loadingLabel="Loading submissions…">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Completion" value={stats.rate === null ? '—' : `${stats.rate}%`}>
            <ProgressBar value={stats.submitted} total={stats.submitted + stats.pending} className="mt-2" />
            <p className="mt-1.5 text-xs text-ink-500">
              {stats.submitted} of {stats.submitted + stats.pending} owed
            </p>
          </Tile>
          <Tile label="Submitted" value={stats.submitted} tone="success" hint="Forms answered" />
          <Tile
            label="Not yet submitted"
            value={stats.pending}
            tone={stats.pending > 0 ? 'warning' : undefined}
            hint={`${stats.behind} trainee${stats.behind === 1 ? '' : 's'} still owe one`}
          />
          <Tile label="Not open yet" value={stats.notOpen} hint="Grade not posted yet" />
        </div>

        <div className="mb-3">
          <Tabs<Grouping>
            ariaLabel="Group by"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: 'TRAINEE', label: 'By trainee', count: stats.trainees },
              { value: 'CLASS', label: 'By class', count: stats.classes },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <NothingHere narrowed={narrowed} onClear={clearAll} what="submissions" />
        ) : grouping === 'TRAINEE' ? (
          <TraineeTable rows={filtered} onOpen={setOpenTrainee} />
        ) : (
          <ClassTable rows={filtered} onOpen={setOpenClass} />
        )}
      </QueryState>

      <ListModal
        rows={openTrainee ? all.filter((r) => r.studentId === openTrainee) : []}
        primary="subject"
        onClose={() => setOpenTrainee(null)}
      />
      <ListModal
        rows={openClass ? all.filter((r) => r.classScheduleId === openClass) : []}
        primary="trainee"
        onClose={() => setOpenClass(null)}
      />
    </>
  );
}

/* ---- By trainee --------------------------------------------------- */

interface TraineeSummary {
  studentId: string;
  studentName: string;
  studentNumber: string;
  programCode: string;
  sections: string[];
  submitted: number;
  pending: number;
  notOpen: number;
  pendingCodes: string[];
  lastSubmitted: string | null;
}

type TraineeSortKey = 'name' | 'diploma' | 'progress' | 'pending' | 'last';

const owedShare = (s: { submitted: number; pending: number }) =>
  s.submitted + s.pending ? s.submitted / (s.submitted + s.pending) : 2;

const TRAINEE_SORT: Record<TraineeSortKey, SortColumn<TraineeSummary>> = {
  name: { value: (t) => t.studentName },
  diploma: { value: (t) => `${t.programCode} ${t.sections.join(' ')}` },
  progress: { value: owedShare },
  pending: { value: (t) => t.pending, defaultDirection: 'desc' },
  last: { value: (t) => t.lastSubmitted ?? '', defaultDirection: 'desc' },
};

function summarizeTrainees(rows: GuidanceSubmissionRow[]): TraineeSummary[] {
  const map = new Map<string, TraineeSummary>();
  for (const r of rows) {
    let t = map.get(r.studentId);
    if (!t) {
      t = {
        studentId: r.studentId,
        studentName: r.studentName,
        studentNumber: r.studentNumber,
        programCode: r.programCode,
        sections: [],
        submitted: 0,
        pending: 0,
        notOpen: 0,
        pendingCodes: [],
        lastSubmitted: null,
      };
      map.set(r.studentId, t);
    }
    if (!t.sections.includes(r.sectionCode)) t.sections.push(r.sectionCode);
    if (r.status === 'SUBMITTED') {
      t.submitted += 1;
      if (r.submittedAt && (!t.lastSubmitted || r.submittedAt > t.lastSubmitted)) t.lastSubmitted = r.submittedAt;
    } else if (r.status === 'PENDING') {
      t.pending += 1;
      t.pendingCodes.push(r.subjectCode);
    } else t.notOpen += 1;
  }
  return [...map.values()];
}

function Progress({ submitted, pending, notOpen }: { submitted: number; pending: number; notOpen: number }) {
  if (submitted + pending === 0) return <span className="text-xs text-ink-500">Not open yet ({notOpen})</span>;
  return (
    <div className="flex items-center gap-2">
      <ProgressBar value={submitted} total={submitted + pending} className="flex-1" />
      <span className="w-12 text-right text-xs tabular-nums text-ink-700">
        {submitted}/{submitted + pending}
      </span>
    </div>
  );
}

function TraineeTable({ rows, onOpen }: { rows: GuidanceSubmissionRow[]; onOpen: (studentId: string) => void }) {
  const summaries = useMemo(() => summarizeTrainees(rows), [rows]);
  const { sorted, sort, toggle } = useSort<TraineeSummary, TraineeSortKey>(summaries, TRAINEE_SORT, {
    key: 'pending',
    direction: 'desc',
  });
  const head = (key: TraineeSortKey, label: string, className?: string) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onClick={() => toggle(key)} className={className}>
      {label}
    </SortableTh>
  );
  return (
    <Card>
      <TableWrap className="relative">
        <Table className="min-w-[52rem]">
          <thead>
            <tr>
              {head('name', 'Trainee')}
              {head('diploma', 'Diploma · Section')}
              {head('progress', 'Submitted', 'w-56')}
              {head('pending', 'Not yet submitted')}
              {head('last', 'Last submitted')}
              <Th className="w-0">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.studentId} className="cursor-pointer transition-colors hover:bg-surface-2" onClick={() => onOpen(t.studentId)}>
                <Td>
                  <span className="block font-medium text-ink-900">{t.studentName}</span>
                  <span className="text-xs text-ink-500">{t.studentNumber}</span>
                </Td>
                <Td>
                  <span className="block text-ink-900">{t.programCode}</span>
                  <span className="text-xs text-ink-500">{t.sections.join(', ')}</span>
                </Td>
                <Td>
                  <Progress submitted={t.submitted} pending={t.pending} notOpen={t.notOpen} />
                </Td>
                <Td>
                  {t.pending === 0 ? (
                    t.submitted > 0 ? (
                      <Badge tone="success">All submitted</Badge>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      {t.pendingCodes.slice(0, 3).map((code) => (
                        <Badge key={code} tone="warning">
                          {code}
                        </Badge>
                      ))}
                      {t.pendingCodes.length > 3 ? (
                        <span className="text-xs text-ink-500">+{t.pendingCodes.length - 3} more</span>
                      ) : null}
                    </span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs">{t.lastSubmitted ? formatDate(t.lastSubmitted) : '—'}</Td>
                <Td>
                  <span aria-hidden className="text-ink-400">
                    ›
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}

/* ---- By class ----------------------------------------------------- */

interface ClassSummary {
  classScheduleId: string;
  subjectCode: string;
  subjectTitle: string;
  trainerName: string;
  sectionCode: string;
  termLabel: string;
  academicYearLabel: string;
  submitted: number;
  pending: number;
  notOpen: number;
}

type ClassSortKey = 'subject' | 'trainer' | 'section' | 'term' | 'progress' | 'pending';

const CLASS_SORT: Record<ClassSortKey, SortColumn<ClassSummary>> = {
  subject: { value: (c) => c.subjectCode },
  trainer: { value: (c) => c.trainerName },
  section: { value: (c) => c.sectionCode },
  term: { value: (c) => `${c.academicYearLabel} ${c.termLabel}`, defaultDirection: 'desc' },
  progress: { value: owedShare },
  pending: { value: (c) => c.pending, defaultDirection: 'desc' },
};

function ClassTable({ rows, onOpen }: { rows: GuidanceSubmissionRow[]; onOpen: (id: string) => void }) {
  const summaries = useMemo(() => {
    const map = new Map<string, ClassSummary>();
    for (const r of rows) {
      let c = map.get(r.classScheduleId);
      if (!c) {
        c = {
          classScheduleId: r.classScheduleId,
          subjectCode: r.subjectCode,
          subjectTitle: r.subjectTitle,
          trainerName: r.trainerName,
          sectionCode: r.sectionCode,
          termLabel: r.termLabel,
          academicYearLabel: r.academicYearLabel,
          submitted: 0,
          pending: 0,
          notOpen: 0,
        };
        map.set(r.classScheduleId, c);
      }
      if (r.status === 'SUBMITTED') c.submitted += 1;
      else if (r.status === 'PENDING') c.pending += 1;
      else c.notOpen += 1;
    }
    return [...map.values()];
  }, [rows]);
  const { sorted, sort, toggle } = useSort<ClassSummary, ClassSortKey>(summaries, CLASS_SORT, {
    key: 'pending',
    direction: 'desc',
  });
  const head = (key: ClassSortKey, label: string, className?: string) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onClick={() => toggle(key)} className={className}>
      {label}
    </SortableTh>
  );
  return (
    <Card>
      <TableWrap className="relative">
        <Table className="min-w-[56rem]">
          <thead>
            <tr>
              {head('subject', 'Subject')}
              {head('trainer', 'Trainer')}
              {head('section', 'Section')}
              {head('term', 'Term')}
              {head('progress', 'Submitted', 'w-56')}
              {head('pending', 'Not yet submitted')}
              <Th className="w-0">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.classScheduleId}
                className="cursor-pointer transition-colors hover:bg-surface-2"
                onClick={() => onOpen(c.classScheduleId)}
              >
                <Td>
                  <span className="block font-medium text-ink-900">{c.subjectCode}</span>
                  <span className="text-xs text-ink-500">{c.subjectTitle}</span>
                </Td>
                <Td>{c.trainerName}</Td>
                <Td className="whitespace-nowrap">{c.sectionCode}</Td>
                <Td>
                  <span className="block whitespace-nowrap">{c.termLabel}</span>
                  <span className="text-xs text-ink-500">{c.academicYearLabel}</span>
                </Td>
                <Td>
                  <Progress submitted={c.submitted} pending={c.pending} notOpen={c.notOpen} />
                </Td>
                <Td>
                  {c.pending > 0 ? <Badge tone="warning">{c.pending}</Badge> : <span className="text-xs text-ink-500">—</span>}
                </Td>
                <Td>
                  <span aria-hidden className="text-ink-400">
                    ›
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}

/* ---- Drill-down: one trainee's subjects, or one class's trainees ---- */

function ListModal({
  rows,
  primary,
  onClose,
}: {
  rows: GuidanceSubmissionRow[];
  primary: 'subject' | 'trainee';
  onClose: () => void;
}) {
  const first = rows[0];
  const submitted = rows.filter((r) => r.status === 'SUBMITTED').length;
  const owed = rows.filter((r) => r.status !== 'NOT_OPEN').length;
  const order = { PENDING: 0, NOT_OPEN: 1, SUBMITTED: 2 } as const;
  const list = [...rows].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (primary === 'subject' ? a.subjectCode.localeCompare(b.subjectCode) : a.studentName.localeCompare(b.studentName)),
  );
  const title = !first ? '' : primary === 'subject' ? first.studentName : `${first.subjectCode} · ${first.sectionCode}`;
  const description = !first
    ? undefined
    : primary === 'subject'
      ? `${first.studentNumber} · ${first.programCode} · ${first.sectionCode}`
      : `${first.subjectTitle} · ${first.trainerName} · ${first.termLabel}, ${first.academicYearLabel}`;

  return (
    <Modal open={Boolean(first)} onClose={onClose} size="lg" title={title} description={description}>
      {first ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <ProgressBar value={submitted} total={owed} className="flex-1" />
            <span className="text-sm tabular-nums text-ink-700">
              {submitted} of {owed} submitted
            </span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {list.map((r) => (
              <li key={r.enrollmentSubjectId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  {primary === 'subject' ? (
                    <>
                      <p className="text-sm font-medium text-ink-900">
                        {r.subjectCode} <span className="font-normal text-ink-500">· {r.subjectTitle}</span>
                      </p>
                      <p className="text-xs text-ink-500">
                        {r.trainerName} · {r.termLabel}, {r.academicYearLabel}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-ink-900">{r.studentName}</p>
                      <p className="text-xs text-ink-500">{r.studentNumber}</p>
                    </>
                  )}
                </div>
                {r.submittedAt ? <span className="text-xs text-ink-500">{formatDate(r.submittedAt)}</span> : null}
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Modal>
  );
}
