import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { SEMESTER_PERIOD_LABELS } from '@/types';
import type { ReportFilters } from '@/types/views';
import { catalogApi, reportsApi } from '@/api';
import { Button, Card, Checkbox, Field, PageHeader, Select, Tabs } from '@/components/ui';
import { QueryState } from '@/components/states';
import { downloadCsv } from './report-parts';
import { EnrollmentReportSheet, enrollmentCsv } from './EnrollmentReportSheet';
import { AcademicReportSheet, academicCsv } from './AcademicReportSheet';
import { RetentionReportSheet, retentionCsv } from './RetentionReportSheet';
import { CompletionReportSheet, completionCsv } from './CompletionReportSheet';
import { SummaryReportSheet, summaryCsv } from './SummaryReportSheet';

type ReportKind = 'enrollment' | 'academic' | 'retention' | 'completion' | 'summary';

const TABS: Array<{ value: ReportKind; label: string }> = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'academic', label: 'Academic performance' },
  { value: 'retention', label: 'Retention & departures' },
  { value: 'completion', label: 'Completion' },
  { value: 'summary', label: 'Summary' },
];

/** Which filters mean something to each report. */
const USES_SEMESTER: Record<ReportKind, boolean> = {
  enrollment: true,
  academic: true,
  retention: false,
  completion: false,
  summary: false,
};

const DESCRIPTIONS: Record<ReportKind, string> = {
  enrollment: 'Who is enrolled — by diploma, year level and section, new and continuing, by sex.',
  academic: 'How trainees did — pass rates, averages, the weakest subjects, top performers, and the 79% line.',
  retention: 'Who carried on to the next term, and why trainees left — centre-initiated apart from trainee-initiated.',
  completion: 'Who has passed every subject of their curriculum and is eligible for graduation, and who is close.',
  summary: 'One page for management: the headline figures of every report, and a line per diploma.',
};

/**
 * Reports (FR-15.2): five reports behind one set of filters. Each prints on
 * its own and exports to CSV. The filters and tabs carry `no-print`, so the
 * paper holds the report alone — the report states what was selected.
 */
export function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('enrollment');
  const [academicYearId, setAcademicYearId] = useState('');
  const [period, setPeriod] = useState<SemesterPeriod | ''>('');
  const [programId, setProgramId] = useState('');
  const [includeRoster, setIncludeRoster] = useState(true);

  const years = useQuery({
    queryKey: ['academic-years'],
    queryFn: () => catalogApi.listAcademicYears(),
  });
  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const filters: ReportFilters = {
    academicYearId: academicYearId || undefined,
    semesterPeriod: USES_SEMESTER[kind] ? period || undefined : undefined,
    programId: programId || undefined,
  };

  const report = useQuery({
    queryKey: ['report', kind, filters.academicYearId ?? '', filters.semesterPeriod ?? '', filters.programId ?? ''],
    queryFn: async () => {
      switch (kind) {
        case 'enrollment':
          return { kind, data: await reportsApi.enrollment(filters) } as const;
        case 'academic':
          return { kind, data: await reportsApi.academic(filters) } as const;
        case 'retention':
          return { kind, data: await reportsApi.retention(filters) } as const;
        case 'completion':
          return { kind, data: await reportsApi.completion(filters) } as const;
        case 'summary':
          return { kind, data: await reportsApi.summary(filters) } as const;
      }
    },
  });

  const activeYearId = years.data?.find((y) => y.isActive)?.id ?? '';
  const current = report.data && report.data.kind === kind ? report.data : null;

  const exportCurrent = () => {
    if (!current) return;
    const year = 'schoolYearLabel' in current.data ? current.data.schoolYearLabel : '';
    const name = `${kind}-report-${year}.csv`;
    switch (current.kind) {
      case 'enrollment':
        return downloadCsv(name, enrollmentCsv(current.data));
      case 'academic':
        return downloadCsv(name, academicCsv(current.data));
      case 'retention':
        return downloadCsv(name, retentionCsv(current.data));
      case 'completion':
        return downloadCsv(name, completionCsv(current.data));
      case 'summary':
        return downloadCsv(name, summaryCsv(current.data));
    }
  };

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports"
          description="Enrollment, academic, retention, completion and summary reports for any school year and diploma — on screen, printed, or exported for a spreadsheet."
          actions={
            <>
              <Button variant="secondary" disabled={!current} onClick={exportCurrent}>
                Export CSV
              </Button>
              <Button variant="primary" disabled={!current} onClick={() => window.print()}>
                Print
              </Button>
            </>
          }
        />

        <div className="mb-3">
          <Tabs options={TABS} value={kind} onChange={setKind} ariaLabel="Report" />
          <p className="mt-2 text-sm text-ink-500">{DESCRIPTIONS[kind]}</p>
        </div>

        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label={kind === 'completion' ? 'As of school year' : 'School year'}
              htmlFor="report-year"
            >
              <Select
                id="report-year"
                value={academicYearId || activeYearId}
                onChange={(event) => setAcademicYearId(event.target.value)}
              >
                {(years.data ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isActive ? ' (active)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {USES_SEMESTER[kind] ? (
              <Field label="Semester" htmlFor="report-period">
                <Select
                  id="report-period"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value as SemesterPeriod | '')}
                >
                  <option value="">All semesters</option>
                  {(Object.keys(SEMESTER_PERIOD_LABELS) as SemesterPeriod[]).map((p) => (
                    <option key={p} value={p}>
                      {SEMESTER_PERIOD_LABELS[p]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Diploma" htmlFor="report-program">
              <Select
                id="report-program"
                value={programId}
                onChange={(event) => setProgramId(event.target.value)}
              >
                <option value="">All diplomas</option>
                {(programs.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === 'enrollment' ? (
              <div className="flex items-end pb-1">
                <Checkbox
                  label="Include the trainee list"
                  description="Leave off to print only the figures."
                  checked={includeRoster}
                  onChange={(event) => setIncludeRoster(event.target.checked)}
                />
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <QueryState
          isLoading={report.isLoading || (!current && report.isFetching)}
          error={report.error}
          onRetry={() => report.refetch()}
          loadingLabel="Compiling the report…"
        >
          {current?.kind === 'enrollment' ? (
            <EnrollmentReportSheet report={current.data} includeRoster={includeRoster} />
          ) : current?.kind === 'academic' ? (
            <AcademicReportSheet report={current.data} />
          ) : current?.kind === 'retention' ? (
            <RetentionReportSheet report={current.data} />
          ) : current?.kind === 'completion' ? (
            <CompletionReportSheet report={current.data} />
          ) : current?.kind === 'summary' ? (
            <SummaryReportSheet report={current.data} />
          ) : null}
        </QueryState>
      </Card>
    </>
  );
}
