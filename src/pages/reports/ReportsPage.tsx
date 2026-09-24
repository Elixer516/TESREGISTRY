import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { SEMESTER_PERIOD_LABELS } from '@/types';
import type { EnrollmentReport } from '@/types/views';
import { catalogApi, reportsApi } from '@/api';
import { Button, Card, Checkbox, Field, PageHeader, Select } from '@/components/ui';
import { QueryState } from '@/components/states';
import { EnrollmentReportSheet } from './EnrollmentReportSheet';

/**
 * Reports (FR-15.2). The Enrollment report is the first; the academic,
 * retention, completion and summary reports follow on this page.
 *
 * The filters sit outside the sheet and carry `no-print`, so the paper holds
 * the report and nothing else — the sheet itself states what was selected.
 */
export function ReportsPage() {
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

  const report = useQuery({
    queryKey: ['report-enrollment', academicYearId, period, programId],
    queryFn: () =>
      reportsApi.enrollment({
        academicYearId: academicYearId || undefined,
        semesterPeriod: period || undefined,
        programId: programId || undefined,
      }),
  });

  // The open school year is chosen for the registrar until they pick one.
  const activeYearId = years.data?.find((y) => y.isActive)?.id ?? '';

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports"
          description="Enrollment figures for any school year, semester and diploma — on screen, printed, or exported for a spreadsheet."
          actions={
            <>
              <Button
                variant="secondary"
                disabled={!report.data}
                onClick={() => report.data && exportCsv(report.data)}
              >
                Export CSV
              </Button>
              <Button variant="primary" disabled={!report.data} onClick={() => window.print()}>
                Print
              </Button>
            </>
          }
        />

        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="School year" htmlFor="report-year">
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
            <div className="flex items-end pb-1">
              <Checkbox
                label="Include the trainee list"
                description="Leave off to print only the figures."
                checked={includeRoster}
                onChange={(event) => setIncludeRoster(event.target.checked)}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <QueryState
          isLoading={report.isLoading}
          error={report.error}
          onRetry={() => report.refetch()}
          loadingLabel="Counting enrolments…"
        >
          {report.data ? (
            <EnrollmentReportSheet report={report.data} includeRoster={includeRoster} />
          ) : null}
        </QueryState>
      </Card>
    </>
  );
}

/**
 * One CSV holding the three tables in turn, each under its own heading row —
 * opens in Excel as a single sheet a registrar can cut up as they like.
 */
function exportCsv(report: EnrollmentReport) {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = (values: Array<string | number>) => values.map(cell).join(',');
  const years = Array.from({ length: report.yearLevels }, (_, i) => `Year ${i + 1}`);
  const t = report.totals;

  const lines = [
    line(['Enrollment Report']),
    line(['School year', report.schoolYearLabel]),
    line(['Semester', report.periodLabel]),
    line(['Diploma', report.programLabel]),
    line(['Generated', report.generatedAt]),
    '',
    line(['BY DIPLOMA']),
    line(['Code', 'Diploma', ...years, 'Male', 'Female', 'New', 'Continuing', 'Total', 'Units', 'Dropped']),
    ...report.byDiploma.map((r) =>
      line([r.code, r.name, ...r.byYear, r.male, r.female, r.newTrainees, r.continuing, r.trainees, r.units, r.dropped]),
    ),
    line([
      'TOTAL',
      '',
      ...years.map((_, i) => report.byDiploma.reduce((sum, r) => sum + (r.byYear[i] ?? 0), 0)),
      t.male,
      t.female,
      t.newTrainees,
      t.continuing,
      t.trainees,
      t.units,
      t.dropped,
    ]),
    '',
    line(['BY SECTION']),
    line(['Diploma', 'Section', 'Term', 'Male', 'Female', 'Trainees', 'Units']),
    ...report.bySection.map((r) =>
      line([r.programCode, r.sectionCode, r.termLabel, r.male, r.female, r.trainees, r.units]),
    ),
    '',
    line(['TRAINEES']),
    line(['ID Number', 'Name', 'Sex', 'Diploma', 'Section', 'Term', 'Units', 'Type', 'Status', 'Date Enrolled']),
    ...report.roster.map((r) =>
      line([
        r.studentNumber,
        r.name,
        r.sex === 'MALE' ? 'M' : 'F',
        r.programCode,
        r.sectionCode,
        r.termLabel,
        r.units,
        r.isNew ? 'New' : 'Continuing',
        r.status,
        r.enrolledAt.slice(0, 10),
      ]),
    ),
  ];

  // A BOM so Excel reads it as UTF-8 and keeps accented names intact.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `enrollment-report-${report.schoolYearLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
