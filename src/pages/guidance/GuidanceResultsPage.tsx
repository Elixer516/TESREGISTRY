/**
 * The Faculty Evaluation results, which belong to the Guidance Office now.
 * Trainers no longer see them. Each class shows its combined ratings per
 * area, the overall and the comments, never who said what. By trainer rolls
 * a trainer's classes into one line, so the office can spot who needs support.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SEMESTER_PERIOD_LABELS, yearLevelLabel } from '@/types';
import type { FacultyEvaluationResultView } from '@/types/views';
import { guidanceApi } from '@/api';
import { ratingLabel } from '@/lib/faculty-evaluation-form';
import { useSort, type SortColumn } from '@/lib/use-sort';
import { Badge, Button, Card, PageHeader, SortableTh, Table, TableWrap, Tabs, Td, TextInput, Th } from '@/components/ui';
import { QueryState } from '@/components/states';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { EvaluationResultCard } from '@/components/EvaluationResultCard';
import { downloadCsv } from '@/pages/reports/report-parts';
import { facultyEvaluationCsv } from './evaluation-csv';
import { DiplomaTabs, NothingHere, ProgressBar, RatingPill, ScopeTabs, Tile, inScope, type Scope } from './guidance-parts';

type Grouping = 'TRAINER' | 'CLASS';

const RATING_WORDS = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'];

/** Mean of the class overalls, each weighted by how many answered it. */
function weightedOverall(rows: FacultyEvaluationResultView[]): number | null {
  const rated = rows.filter((r) => r.overall !== null && r.respondents > 0);
  const weight = rated.reduce((n, r) => n + r.respondents, 0);
  if (!weight) return null;
  return Math.round((rated.reduce((n, r) => n + (r.overall ?? 0) * r.respondents, 0) / weight) * 100) / 100;
}

export function GuidanceResultsPage() {
  const [scope, setScope] = useState<Scope>('ALL');
  const [diploma, setDiploma] = useState('ALL');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterSelection>({});
  const [grouping, setGrouping] = useState<Grouping>('TRAINER');

  const query = useQuery({ queryKey: ['guidance-results'], queryFn: () => guidanceApi.results() });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const scoped = useMemo(() => inScope(all, scope), [all, scope]);
  const inDiploma = useMemo(
    () => (diploma === 'ALL' ? scoped : scoped.filter((r) => r.programCode === diploma)),
    [scoped, diploma],
  );

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
        chips: uniq(inDiploma.flatMap((r) => r.batches).filter(Boolean))
          .sort()
          .reverse()
          .map((v) => ({ value: v, label: `Batch ${v}`, title: `First enrolled in ${v}` })),
      },
      {
        key: 'trainer',
        label: 'Trainer',
        chips: uniq(inDiploma.map((r) => r.trainerName)).sort().map((v) => ({ value: v, label: v })),
      },
      {
        key: 'rating',
        label: 'Overall rating',
        chips: RATING_WORDS.filter((w) => inDiploma.some((r) => r.overallLabel === w)).map((w) => ({ value: w, label: w })),
      },
    ];
  }, [inDiploma]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inDiploma.filter(
      (r) =>
        (!needle ||
          `${r.trainerName} ${r.subjectCode} ${r.subjectTitle} ${r.sectionCode}`.toLowerCase().includes(needle)) &&
        matchesSelection(filters, (key) =>
          key === 'year'
            ? r.academicYearLabel
            : key === 'semester'
              ? r.semesterPeriod
              : key === 'level'
                ? String(r.yearLevel)
                : key === 'batch'
                  ? r.batches
                  : key === 'trainer'
                    ? r.trainerName
                    : key === 'rating'
                      ? r.overallLabel
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
    const respondents = filtered.reduce((n, r) => n + r.respondents, 0);
    const eligible = filtered.reduce((n, r) => n + r.eligible, 0);
    return {
      classes: filtered.length,
      trainers: new Set(filtered.map((r) => r.facultyId)).size,
      respondents,
      eligible,
      mean: weightedOverall(filtered),
      low: filtered.filter((r) => r.overall !== null && r.overall < 3.5).length,
    };
  }, [filtered]);

  /** By trainer → the trainer's classes, through the same filter. */
  const showTrainer = (name: string) => {
    setFilters((f) => ({ ...f, trainer: [name] }));
    setGrouping('CLASS');
  };

  return (
    <>
      <PageHeader
        title="Evaluation Results"
        description="How trainees rated each trainer, combined per class. Anonymous: no rating or comment can be traced to a trainee. Trainers do not see these results."
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={filtered.length === 0}
            onClick={() => downloadCsv(`faculty-evaluation-results-${new Date().toISOString().slice(0, 10)}.csv`, facultyEvaluationCsv(filtered))}
          >
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
            placeholder="Search trainer, subject or section…"
            aria-label="Search results"
          />
        </div>
        <FilterPanel groups={filterGroups} value={filters} onChange={setFilters} />
      </div>

      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()} loadingLabel="Loading results…">
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            label="Average rating"
            value={stats.mean === null ? '—' : stats.mean.toFixed(2)}
            hint={stats.mean === null ? 'No answers in view' : ratingLabel(stats.mean)}
          />
          <Tile
            label="Classes below “Agree”"
            value={stats.low}
            tone={stats.low > 0 ? 'warning' : undefined}
            hint="Overall under 3.50, worth a look"
          />
          <Tile label="Response rate" value={stats.eligible ? `${Math.round((stats.respondents / stats.eligible) * 100)}%` : '—'}>
            <ProgressBar value={stats.respondents} total={stats.eligible} className="mt-2" />
            <p className="mt-1.5 text-xs text-ink-500">
              {stats.respondents} of {stats.eligible} forms answered
            </p>
          </Tile>
          <Tile label="Trainers rated" value={stats.trainers} hint={`Across ${stats.classes} class${stats.classes === 1 ? '' : 'es'}`} />
        </div>

        <div className="mb-3">
          <Tabs<Grouping>
            ariaLabel="Group by"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: 'TRAINER', label: 'By trainer', count: stats.trainers },
              { value: 'CLASS', label: 'By class', count: stats.classes },
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <NothingHere narrowed={narrowed} onClear={clearAll} what="results" />
        ) : grouping === 'TRAINER' ? (
          <TrainerTable rows={filtered} onOpen={showTrainer} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((r) => (
              <EvaluationResultCard key={r.classScheduleId} result={r} showTrainer />
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}

/* ---- By trainer --------------------------------------------------- */

interface TrainerSummary {
  facultyId: string;
  trainerName: string;
  diplomas: string[];
  classes: number;
  respondents: number;
  eligible: number;
  overall: number | null;
  low: number;
  areas: Array<{ id: string; title: string; average: number | null }>;
}

type TrainerSortKey = 'name' | 'classes' | 'responses' | 'overall' | 'low';

const TRAINER_SORT: Record<TrainerSortKey, SortColumn<TrainerSummary>> = {
  name: { value: (t) => t.trainerName },
  classes: { value: (t) => t.classes, defaultDirection: 'desc' },
  responses: { value: (t) => t.respondents, defaultDirection: 'desc' },
  overall: { value: (t) => t.overall ?? 99 },
  low: { value: (t) => t.low, defaultDirection: 'desc' },
};

function summarizeTrainers(rows: FacultyEvaluationResultView[]): TrainerSummary[] {
  const byTrainer = new Map<string, FacultyEvaluationResultView[]>();
  rows.forEach((r) => byTrainer.set(r.facultyId, [...(byTrainer.get(r.facultyId) ?? []), r]));
  return [...byTrainer.entries()].map(([facultyId, list]) => {
    const areas = (list[0]?.areas ?? []).map((area) => {
      const rated = list
        .map((r) => ({ avg: r.areas.find((a) => a.id === area.id)?.average ?? null, n: r.respondents }))
        .filter((x): x is { avg: number; n: number } => x.avg !== null && x.n > 0);
      const w = rated.reduce((n, x) => n + x.n, 0);
      return {
        id: area.id,
        title: area.title,
        average: w ? Math.round((rated.reduce((n, x) => n + x.avg * x.n, 0) / w) * 100) / 100 : null,
      };
    });
    return {
      facultyId,
      trainerName: list[0].trainerName,
      diplomas: [...new Set(list.map((r) => r.programCode))].sort(),
      classes: list.length,
      respondents: list.reduce((n, r) => n + r.respondents, 0),
      eligible: list.reduce((n, r) => n + r.eligible, 0),
      overall: weightedOverall(list),
      low: list.filter((r) => r.overall !== null && r.overall < 3.5).length,
      areas,
    };
  });
}

function TrainerTable({ rows, onOpen }: { rows: FacultyEvaluationResultView[]; onOpen: (trainerName: string) => void }) {
  const summaries = useMemo(() => summarizeTrainers(rows), [rows]);
  // Lowest first: the trainers who may need support lead the list.
  const { sorted, sort, toggle } = useSort<TrainerSummary, TrainerSortKey>(summaries, TRAINER_SORT, {
    key: 'overall',
    direction: 'asc',
  });
  const head = (key: TrainerSortKey, label: string, className?: string) => (
    <SortableTh active={sort.key === key} direction={sort.direction} onClick={() => toggle(key)} className={className}>
      {label}
    </SortableTh>
  );
  const areaTitles = summaries[0]?.areas ?? [];
  return (
    <Card>
      <TableWrap className="relative">
        <Table className="min-w-[60rem]">
          <thead>
            <tr>
              {head('name', 'Trainer')}
              {head('classes', 'Classes')}
              {head('responses', 'Responses')}
              {areaTitles.map((a) => (
                <Th key={a.id} className="text-center">
                  <span title={a.title}>{a.id}</span>
                </Th>
              ))}
              {head('overall', 'Overall')}
              {head('low', 'Below “Agree”')}
              <Th className="w-0">
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.facultyId}
                className="cursor-pointer transition-colors hover:bg-surface-2"
                onClick={() => onOpen(t.trainerName)}
                title="Show this trainer's classes"
              >
                <Td>
                  <span className="block font-medium text-ink-900">{t.trainerName}</span>
                  <span className="text-xs text-ink-500">{t.diplomas.join(', ')}</span>
                </Td>
                <Td className="tabular-nums">{t.classes}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {t.respondents}
                  <span className="text-xs text-ink-500"> of {t.eligible}</span>
                </Td>
                {t.areas.map((a) => (
                  <Td key={a.id} className="text-center text-xs tabular-nums">
                    {a.average === null ? '—' : a.average.toFixed(2)}
                  </Td>
                ))}
                <Td>{t.overall === null ? '—' : <RatingPill value={t.overall} />}</Td>
                <Td>{t.low > 0 ? <Badge tone="warning">{t.low}</Badge> : <span className="text-xs text-ink-500">—</span>}</Td>
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
      <p className="border-t border-line px-3 py-2 text-xs text-ink-500">
        {areaTitles.map((a) => `${a.id} ${a.title}`).join(' · ')}. Click a trainer to see their classes.
      </p>
    </Card>
  );
}
