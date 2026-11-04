/**
 * The Guidance Office portal.
 *
 * Submissions: who has answered the Faculty Evaluation, by trainee and by
 * class, so the office can follow up with whoever is behind.
 * Responses: each trainee's own answers, item by item. Only the Guidance
 * Office reaches these; the server refuses every other role, and each
 * response opened is written to the audit trail.
 *
 * Both views share one read and one set of filters, so switching between
 * them keeps the same term, diploma and section in view.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type { GuidanceSubmissionRow } from '@/types/views';
import { guidanceApi } from '@/api';
import { classNames, formatDate, formatDateTime } from '@/lib/format';
import { ratingLabel } from '@/lib/faculty-evaluation-form';
import { useSort, type SortColumn } from '@/lib/use-sort';
import {
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  SortableTh,
  Table,
  TableWrap,
  Tabs,
  Td,
  TextInput,
  Th,
} from '@/components/ui';
import { EmptyState, QueryState } from '@/components/states';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { downloadCsv } from '@/pages/reports/report-parts';
import { ResponseModal } from './ResponseModal';
import { ProgressBar, RatingPill, StatusBadge } from './guidance-parts';

type Scope = 'CURRENT' | 'PAST' | 'ALL';
type Grouping = 'TRAINEE' | 'CLASS';

const STATUS_CHIPS = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'NOT_OPEN', label: 'Not open yet', title: 'The grade is not posted, so the form has not opened' },
];

const RATING_CHIPS = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'].map((label) => ({
  value: label,
  label,
}));

export function GuidancePage({ view }: { view: 'submissions' | 'responses' }) {
  const [scope, setScope] = useState<Scope>('ALL');
  const [diploma, setDiploma] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterSelection>({});
  const [grouping, setGrouping] = useState<Grouping>('TRAINEE');
  const [openResponse, setOpenResponse] = useState<string | null>(null);
  const [openTrainee, setOpenTrainee] = useState<string | null>(null);
  const [openClass, setOpenClass] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['guidance-submissions'], queryFn: () => guidanceApi.submissions() });
  const all = useMemo(() => query.data ?? [], [query.data]);

  // The Responses view lists answers only; nothing to read in an unanswered row.
  const base = useMemo(() => (view === 'responses' ? all.filter((r) => r.status === 'SUBMITTED') : all), [all, view]);

  const inScope = useMemo(
    () =>
      base.filter((r) => (scope === 'CURRENT' ? r.semesterIsActive : scope === 'PAST' ? !r.semesterIsActive : true)),
    [base, scope],
  );

  const diplomaTabs = useMemo(() => {
    const counts = new Map<string, number>();
    inScope.forEach((r) => counts.set(r.programCode, (counts.get(r.programCode) ?? 0) + 1));
    const codes = [...new Set(base.map((r) => r.programCode))].sort();
    return [
      { value: 'ALL', label: 'All', count: inScope.length },
      ...codes.map((code) => ({ value: code, label: code, count: counts.get(code) ?? 0 })),
    ];
  }, [base, inScope]);

  const inDiploma = useMemo(
    () => (diploma === 'ALL' ? inScope : inScope.filter((r) => r.programCode === diploma)),
    [inScope, diploma],
  );

  // Chips come from the rows in view, so a choice never leads to nothing.
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const uniq = <T,>(values: T[]) => [...new Set(values)];
    const groups: FilterGroup[] = [
      {
        key: 'year',
        label: 'School year',
        chips: uniq(inDiploma.map((r) => r.academicYearLabel))
          .sort()
          .reverse()
          .map((v) => ({ value: v, label: v })),
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
        chips: uniq(inDiploma.map((r) => r.trainerName))
          .sort()
          .map((v) => ({ value: v, label: v })),
      },
    ];
    if (view === 'submissions') {
      groups.push({ key: 'status', label: 'Status', chips: STATUS_CHIPS });
    } else {
      groups.push({
        key: 'rating',
        label: 'Overall rating',
        chips: RATING_CHIPS.filter((c) => inDiploma.some((r) => r.overall !== null && ratingLabel(r.overall) === c.value)),
      });
    }
    return groups;
  }, [inDiploma, view]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inDiploma.filter(
      (r) =>
        (!needle ||
          `${r.studentName} ${r.studentNumber} ${r.subjectCode} ${r.subjectTitle} ${r.trainerName} ${r.sectionCode}`
            .toLowerCase()
            .includes(needle)) &&
        matchesSelection(filters, (key) => {
          switch (key) {
            case 'year':
              return r.academicYearLabel;
            case 'semester':
              return r.semesterPeriod;
            case 'level':
              return String(r.yearLevel);
            case 'batch':
              return r.batch;
            case 'trainer':
              return r.trainerName;
            case 'status':
              return r.status;
            case 'rating':
              return r.overall === null ? null : ratingLabel(r.overall);
            default:
              return null;
          }
        }),
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
    const notOpen = filtered.filter((r) => r.status === 'NOT_OPEN').length;
    const owed = submitted + pending;
    const ratings = filtered.map((r) => r.overall).filter((v): v is number => v !== null);
    return {
      submitted,
      pending,
      notOpen,
      rate: owed ? Math.round((submitted / owed) * 100) : null,
      trainees: new Set(filtered.map((r) => r.studentId)).size,
      behind: new Set(filtered.filter((r) => r.status === 'PENDING').map((r) => r.studentId)).size,
      mean: ratings.length ? Math.round((ratings.reduce((x, y) => x + y, 0) / ratings.length) * 100) / 100 : null,
      low: ratings.filter((v) => v < 3.5).length,
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
        STATUS_CHIPS.find((s) => s.value === r.status)?.label ?? r.status,
        r.submittedAt ? formatDateTime(r.submittedAt) : '',
      ]),
    ]);
  }

  return (
    <>
      <PageHeader
        title={view === 'submissions' ? 'Evaluation Submissions' : 'Evaluation Responses'}
        description={
          view === 'submissions'
            ? 'Who has answered the Faculty Evaluation, by trainee and by class. Follow up with trainees who still owe one.'
            : 'Each trainee’s own answers. Only the Guidance Office can open these; trainers and the Registrar see combined results only.'
        }
        actions={
          view === 'submissions' ? (
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs<Scope>
          ariaLabel="Term"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'CURRENT', label: 'Current term', count: base.filter((r) => r.semesterIsActive).length },
            { value: 'PAST', label: 'Past terms', count: base.filter((r) => !r.semesterIsActive).length },
            { value: 'ALL', label: 'All', count: base.length },
          ]}
        />
        {view === 'responses' ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
            <span aria-hidden>🔒</span> Confidential: every response you open is recorded in the audit log.
          </span>
        ) : null}
      </div>

      {/* The diplomas on one row of their own, spread across it evenly. */}
      <div
        role="tablist"
        aria-label="Diploma"
        className="mb-3 flex gap-0.5 overflow-x-auto rounded-lg border border-line bg-surface-2 p-1"
      >
        {diplomaTabs.map((option) => {
          const selected = option.value === diploma;
          return (
            <button
              key={option.value}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setDiploma(option.value)}
              className={classNames(
                'flex flex-1 items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-1 py-1.5 text-xs font-semibold transition-colors',
                selected ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900',
              )}
            >
              {option.label}
              <span
                className={classNames(
                  'rounded-full px-1 py-0.5 text-[10px] leading-none',
                  selected ? 'bg-brand-soft text-brand-text' : 'bg-surface-3 text-ink-500',
                )}
              >
                {option.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trainee, ID Number, subject, trainer or section…"
            aria-label="Search evaluations"
          />
        </div>
        <FilterPanel groups={filterGroups} value={filters} onChange={setFilters} />
      </div>

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        loadingLabel="Loading evaluations…"
      >
        {view === 'submissions' ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Completion" value={stats.rate === null ? '—' : `${stats.rate}%`}>
                <ProgressBar value={stats.submitted} total={stats.submitted + stats.pending} className="mt-2" />
                <p className="mt-1.5 text-xs text-ink-500">
                  {stats.submitted} of {stats.submitted + stats.pending} owed
                </p>
              </Tile>
              <Tile label="Submitted" value={stats.submitted} tone="success" hint="Answered evaluations" />
              <Tile
                label="Pending"
                value={stats.pending}
                tone={stats.pending > 0 ? 'warning' : undefined}
                hint={`${stats.behind} trainee${stats.behind === 1 ? '' : 's'} still owe one`}
              />
              <Tile label="Not open yet" value={stats.notOpen} hint="Grade not posted yet" />
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Tabs<Grouping>
                ariaLabel="Group by"
                value={grouping}
                onChange={setGrouping}
                options={[
                  { value: 'TRAINEE', label: 'By trainee', count: stats.trainees },
                  { value: 'CLASS', label: 'By class', count: new Set(filtered.map((r) => r.classScheduleId)).size },
                ]}
              />
            </div>

            {filtered.length === 0 ? (
              <NothingHere narrowed={narrowed} onClear={clearAll} />
            ) : grouping === 'TRAINEE' ? (
              <TraineeTable rows={filtered} onOpen={setOpenTrainee} />
            ) : (
              <ClassTable rows={filtered} onOpen={setOpenClass} />
            )}
          </>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Responses" value={filtered.length} hint={`From ${stats.trainees} trainee${stats.trainees === 1 ? '' : 's'}`} />
              <Tile
                label="Average rating"
                value={stats.mean === null ? '—' : stats.mean.toFixed(2)}
                hint={stats.mean === null ? 'No answers in view' : ratingLabel(stats.mean)}
              />
              <Tile
                label="Below “Agree”"
                value={stats.low}
                tone={stats.low > 0 ? 'warning' : undefined}
                hint="Overall under 3.50, worth a look"
              />
              <Tile
                label="Trainers rated"
                value={new Set(filtered.map((r) => r.facultyId)).size}
                hint="In the rows shown"
              />
            </div>
            {filtered.length === 0 ? (
              <NothingHere narrowed={narrowed} onClear={clearAll} />
            ) : (
              <ResponsesTable rows={filtered} onOpen={setOpenResponse} />
            )}
          </>
        )}
      </QueryState>

      <TraineeModal
        rows={openTrainee ? all.filter((r) => r.studentId === openTrainee) : []}
        onClose={() => setOpenTrainee(null)}
        onOpenResponse={setOpenResponse}
      />
      <ClassModal
        rows={openClass ? all.filter((r) => r.classScheduleId === openClass) : []}
        onClose={() => setOpenClass(null)}
        onOpenResponse={setOpenResponse}
      />
      <ResponseModal enrollmentSubjectId={openResponse} onClose={() => setOpenResponse(null)} />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Pieces                                                            */
/* ---------------------------------------------------------------- */

function Tile({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'success' | 'warning';
  children?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={classNames(
          'mt-1.5 text-2xl font-semibold tabular-nums',
          tone === 'success' ? 'text-success-ink' : tone === 'warning' ? 'text-warning-ink' : 'text-ink-900',
        )}
      >
        {value}
      </p>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  );
}

function NothingHere({ narrowed, onClear }: { narrowed: boolean; onClear: () => void }) {
  return (
    <EmptyState
      title="Nothing to see here"
      hint={
        narrowed
          ? 'No evaluations match this search or filter. Try another, or clear them.'
          : 'No evaluations in this term and diploma. Try Past terms or All.'
      }
      action={
        narrowed ? (
          <Button size="sm" variant="secondary" onClick={onClear}>
            Clear search and filters
          </Button>
        ) : undefined
      }
    />
  );
}

/* ---- By trainee --------------------------------------------------- */

interface TraineeSummary {
  studentId: string;
  studentName: string;
  studentNumber: string;
  programCode: string;
  sections: string;
  submitted: number;
  pending: number;
  notOpen: number;
  pendingCodes: string[];
  lastSubmitted: string | null;
}

type TraineeSortKey = 'name' | 'diploma' | 'progress' | 'pending' | 'last';

const TRAINEE_SORT: Record<TraineeSortKey, SortColumn<TraineeSummary>> = {
  name: { value: (t) => t.studentName },
  diploma: { value: (t) => `${t.programCode} ${t.sections}` },
  progress: { value: (t) => (t.submitted + t.pending ? t.submitted / (t.submitted + t.pending) : 2) },
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
        sections: '',
        submitted: 0,
        pending: 0,
        notOpen: 0,
        pendingCodes: [],
        lastSubmitted: null,
      };
      map.set(r.studentId, t);
    }
    if (!t.sections.split(', ').includes(r.sectionCode)) t.sections = t.sections ? `${t.sections}, ${r.sectionCode}` : r.sectionCode;
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

function TraineeTable({ rows, onOpen }: { rows: GuidanceSubmissionRow[]; onOpen: (studentId: string) => void }) {
  const summaries = useMemo(() => summarizeTrainees(rows), [rows]);
  const { sorted, sort, toggle } = useSort<TraineeSummary, TraineeSortKey>(summaries, TRAINEE_SORT, { key: 'pending', direction: 'desc' });
  const head = (key: TraineeSortKey, label: string, className?: string) => (
    <SortableTh
      active={sort.key === key}
      direction={sort.direction}
      onClick={() => toggle(key)}
      className={className}
    >
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
              {head('pending', 'Still owes')}
              {head('last', 'Last submitted')}
              <Th className="w-0">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.studentId}
                className="cursor-pointer transition-colors hover:bg-surface-2"
                onClick={() => onOpen(t.studentId)}
              >
                <Td>
                  <span className="block font-medium text-ink-900">{t.studentName}</span>
                  <span className="text-xs text-ink-500">{t.studentNumber}</span>
                </Td>
                <Td>
                  <span className="block text-ink-900">{t.programCode}</span>
                  <span className="text-xs text-ink-500">{t.sections}</span>
                </Td>
                <Td>
                  {t.submitted + t.pending > 0 ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={t.submitted} total={t.submitted + t.pending} className="flex-1" />
                      <span className="w-12 text-right text-xs tabular-nums text-ink-700">
                        {t.submitted}/{t.submitted + t.pending}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-500">Not open yet ({t.notOpen})</span>
                  )}
                </Td>
                <Td>
                  {t.pending === 0 ? (
                    t.submitted > 0 ? (
                      <Badge tone="success">All done</Badge>
                    ) : (
                      <span className="text-xs text-ink-500">—</span>
                    )
                  ) : (
                    <span className="flex flex-wrap gap-1">
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
                  <span aria-hidden className="text-ink-400">›</span>
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
  progress: { value: (c) => (c.submitted + c.pending ? c.submitted / (c.submitted + c.pending) : 2) },
  pending: { value: (c) => c.pending, defaultDirection: 'desc' },
};

function ClassTable({ rows, onOpen }: { rows: GuidanceSubmissionRow[]; onOpen: (id: string) => void }) {
  const summaries = useMemo(() => {
    const map = new Map<string, ClassSummary>();
    for (const r of rows) {
      const c =
        map.get(r.classScheduleId) ??
        map
          .set(r.classScheduleId, {
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
          })
          .get(r.classScheduleId)!;
      if (r.status === 'SUBMITTED') c.submitted += 1;
      else if (r.status === 'PENDING') c.pending += 1;
      else c.notOpen += 1;
    }
    return [...map.values()];
  }, [rows]);
  const { sorted, sort, toggle } = useSort<ClassSummary, ClassSortKey>(summaries, CLASS_SORT, { key: 'pending', direction: 'desc' });
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
              {head('progress', 'Responses', 'w-56')}
              {head('pending', 'Pending')}
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
                  {c.submitted + c.pending > 0 ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={c.submitted} total={c.submitted + c.pending} className="flex-1" />
                      <span className="w-12 text-right text-xs tabular-nums text-ink-700">
                        {c.submitted}/{c.submitted + c.pending}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-ink-500">Not open yet ({c.notOpen})</span>
                  )}
                </Td>
                <Td>
                  {c.pending > 0 ? <Badge tone="warning">{c.pending}</Badge> : <span className="text-xs text-ink-500">—</span>}
                </Td>
                <Td>
                  <span aria-hidden className="text-ink-400">›</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}

/* ---- Responses ---------------------------------------------------- */

type ResponseSortKey = 'trainee' | 'subject' | 'trainer' | 'section' | 'overall' | 'submitted';

const RESPONSE_SORT: Record<ResponseSortKey, SortColumn<GuidanceSubmissionRow>> = {
  trainee: { value: (r) => r.studentName },
  subject: { value: (r) => r.subjectCode },
  trainer: { value: (r) => r.trainerName },
  section: { value: (r) => r.sectionCode },
  overall: { value: (r) => r.overall ?? 0 },
  submitted: { value: (r) => r.submittedAt ?? '', defaultDirection: 'desc' },
};

function ResponsesTable({ rows, onOpen }: { rows: GuidanceSubmissionRow[]; onOpen: (id: string) => void }) {
  const { sorted, sort, toggle } = useSort<GuidanceSubmissionRow, ResponseSortKey>(rows, RESPONSE_SORT, { key: 'submitted', direction: 'desc' });
  const head = (key: ResponseSortKey, label: string) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onClick={() => toggle(key)}>
      {label}
    </SortableTh>
  );
  return (
    <Card>
      <TableWrap className="relative">
        <Table className="min-w-[58rem]">
          <thead>
            <tr>
              {head('trainee', 'Trainee')}
              {head('subject', 'Subject')}
              {head('trainer', 'Trainer')}
              {head('section', 'Section · Term')}
              {head('overall', 'Overall')}
              {head('submitted', 'Submitted')}
              <Th className="w-0">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.enrollmentSubjectId}
                className="cursor-pointer transition-colors hover:bg-surface-2"
                onClick={() => onOpen(r.enrollmentSubjectId)}
              >
                <Td>
                  <span className="block font-medium text-ink-900">{r.studentName}</span>
                  <span className="text-xs text-ink-500">{r.studentNumber}</span>
                </Td>
                <Td>
                  <span className="block text-ink-900">{r.subjectCode}</span>
                  <span className="text-xs text-ink-500">{r.subjectTitle}</span>
                </Td>
                <Td>{r.trainerName}</Td>
                <Td>
                  <span className="block whitespace-nowrap">{r.sectionCode}</span>
                  <span className="text-xs text-ink-500">
                    {r.termLabel} · {r.academicYearLabel}
                  </span>
                </Td>
                <Td>{r.overall === null ? '—' : <RatingPill value={r.overall} />}</Td>
                <Td className="whitespace-nowrap text-xs">{formatDateTime(r.submittedAt)}</Td>
                <Td>
                  <Button size="sm" variant="secondary" onClick={() => onOpen(r.enrollmentSubjectId)}>
                    View answers
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </Card>
  );
}

/* ---- Drill-downs -------------------------------------------------- */

function SubjectsList({
  rows,
  primary,
  onOpenResponse,
}: {
  rows: GuidanceSubmissionRow[];
  primary: 'subject' | 'trainee';
  onOpenResponse: (id: string) => void;
}) {
  const order = { PENDING: 0, NOT_OPEN: 1, SUBMITTED: 2 } as const;
  const list = [...rows].sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      (primary === 'subject' ? a.subjectCode.localeCompare(b.subjectCode) : a.studentName.localeCompare(b.studentName)),
  );
  return (
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
          {r.overall !== null ? <RatingPill value={r.overall} /> : null}
          <StatusBadge status={r.status} />
          {r.status === 'SUBMITTED' ? (
            <Button size="sm" variant="secondary" onClick={() => onOpenResponse(r.enrollmentSubjectId)}>
              View answers
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TraineeModal({
  rows,
  onClose,
  onOpenResponse,
}: {
  rows: GuidanceSubmissionRow[];
  onClose: () => void;
  onOpenResponse: (id: string) => void;
}) {
  const first = rows[0];
  const submitted = rows.filter((r) => r.status === 'SUBMITTED').length;
  const owed = rows.filter((r) => r.status !== 'NOT_OPEN').length;
  return (
    <Modal
      open={Boolean(first)}
      onClose={onClose}
      size="lg"
      title={first ? first.studentName : ''}
      description={first ? `${first.studentNumber} · ${first.programCode} · ${first.sectionCode}` : undefined}
    >
      {first ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <ProgressBar value={submitted} total={owed} className="flex-1" />
            <span className="text-sm tabular-nums text-ink-700">
              {submitted} of {owed} submitted
            </span>
          </div>
          <SubjectsList rows={rows} primary="subject" onOpenResponse={onOpenResponse} />
        </>
      ) : null}
    </Modal>
  );
}

function ClassModal({
  rows,
  onClose,
  onOpenResponse,
}: {
  rows: GuidanceSubmissionRow[];
  onClose: () => void;
  onOpenResponse: (id: string) => void;
}) {
  const first = rows[0];
  const submitted = rows.filter((r) => r.status === 'SUBMITTED').length;
  const owed = rows.filter((r) => r.status !== 'NOT_OPEN').length;
  return (
    <Modal
      open={Boolean(first)}
      onClose={onClose}
      size="lg"
      title={first ? `${first.subjectCode} · ${first.sectionCode}` : ''}
      description={
        first ? `${first.subjectTitle} · ${first.trainerName} · ${first.termLabel}, ${first.academicYearLabel}` : undefined
      }
    >
      {first ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <ProgressBar value={submitted} total={owed} className="flex-1" />
            <span className="text-sm tabular-nums text-ink-700">
              {submitted} of {owed} submitted
            </span>
          </div>
          <SubjectsList rows={rows} primary="trainee" onOpenResponse={onOpenResponse} />
        </>
      ) : null}
    </Modal>
  );
}
