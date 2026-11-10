import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SemesterPeriod } from '@/types';
import { SEMESTER_PERIOD_LABELS } from '@/types';
import type { ReportFilters } from '@/types/views';
import { catalogApi, reportsApi } from '@/api';
import { Button, Card, Checkbox, Field, Modal, PageHeader, Select, Tabs } from '@/components/ui';
import { QueryState } from '@/components/states';
import { downloadCsv } from './report-parts';
import { EnrollmentReportSheet, enrollmentCsv } from './EnrollmentReportSheet';
import { AcademicReportSheet, academicCsv } from './AcademicReportSheet';
import { RetentionReportSheet, retentionCsv } from './RetentionReportSheet';
import { CompletionReportSheet, completionCsv } from './CompletionReportSheet';
import { SummaryReportSheet, summaryCsv } from './SummaryReportSheet';
import { LackingReportSheet, lackingCsv } from './LackingReportSheet';
import {
  MIS_PAPERS,
  MIS_PRINT_DEFAULT,
  MisReportSheet,
  downloadMisExcel,
  misCsv,
  printMis,
  type MisPaper,
  type MisPrintSettings,
} from './MisReportSheet';

type ReportKind = 'enrollment' | 'academic' | 'retention' | 'completion' | 'summary' | 'lacking' | 'mis';

const TABS: Array<{ value: ReportKind; label: string }> = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'academic', label: 'Academic performance' },
  { value: 'retention', label: 'Retention & departures' },
  { value: 'completion', label: 'Completion' },
  { value: 'summary', label: 'Summary' },
  { value: 'lacking', label: 'Lacking requirements & grades' },
  { value: 'mis', label: 'MIS' },
];

/** Which filters mean something to each report. */
const USES_SEMESTER: Record<ReportKind, boolean> = {
  enrollment: true,
  academic: true,
  retention: false,
  completion: false,
  summary: false,
  lacking: false,
  mis: true,
};

/** The lacking list is about today's trainees, not one school year. */
const USES_YEAR: Record<ReportKind, boolean> = {
  enrollment: true,
  academic: true,
  retention: true,
  completion: true,
  summary: true,
  lacking: false,
  mis: true,
};

const DESCRIPTIONS: Record<ReportKind, string> = {
  enrollment: 'Who is enrolled — by diploma, year level and section, new and continuing, by sex.',
  academic:
    'How trainees did — pass rates, averages, the weakest subjects, top performers, and the 79% line.',
  retention:
    'Who carried on to the next term, and why trainees left — centre-initiated apart from trainee-initiated.',
  completion:
    'Who has passed every subject of their curriculum and is eligible for graduation, and who is close.',
  summary: 'One page for management: the headline figures of every report, and a line per diploma.',
  lacking:
    'Trainees still at the centre with admission requirements not on file, subjects with no grade yet, or an INC not completed. Filter by diploma, section, scholarship and batch.',
  mis: "Trainees' personal details from registration in TESDA's MIS format — one sheet per diploma, exported to Excel, CSV or PDF.",
};

/** The reports that can pick trainees by the date they enrolled. */
const USES_DATES = (kind: ReportKind) => kind === 'enrollment' || kind === 'mis';

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
  // Enrollment report: who enrolled between two dates.
  const [enrolledFrom, setEnrolledFrom] = useState('');
  const [enrolledTo, setEnrolledTo] = useState('');
  const ranged = USES_DATES(kind) && Boolean(enrolledFrom || enrolledTo);

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
    enrolledFrom: USES_DATES(kind) ? enrolledFrom || undefined : undefined,
    enrolledTo: USES_DATES(kind) ? enrolledTo || undefined : undefined,
  };

  const report = useQuery({
    queryKey: [
      'report',
      kind,
      filters.academicYearId ?? '',
      filters.semesterPeriod ?? '',
      filters.programId ?? '',
      filters.enrolledFrom ?? '',
      filters.enrolledTo ?? '',
    ],
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
        case 'lacking':
          return { kind, data: await reportsApi.lacking(filters) } as const;
        case 'mis':
          return { kind, data: await reportsApi.mis(filters) } as const;
      }
    },
  });

  const activeYearId = years.data?.find((y) => y.isActive)?.id ?? '';
  const current = report.data && report.data.kind === kind ? report.data : null;

  const exportCurrent = () => {
    if (!current) return;
    const year =
      !Array.isArray(current.data) && 'schoolYearLabel' in current.data ? current.data.schoolYearLabel : '';
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
      case 'lacking':
        return downloadCsv('lacking-requirements-and-grades.csv', lackingCsv(current.data));
      case 'mis':
        return downloadCsv(`${misFileName(current.data)}.csv`, misCsv(current.data));
    }
  };

  const [exporting, setExporting] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const exportExcel = async () => {
    if (current?.kind !== 'mis') return;
    setExporting(true);
    try {
      await downloadMisExcel(current.data, `${misFileName(current.data)}.xlsx`);
    } finally {
      setExporting(false);
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
              {kind === 'mis' ? (
                <ExportMenu
                  disabled={current?.kind !== 'mis'}
                  loading={exporting}
                  onExcel={exportExcel}
                  onCsv={exportCurrent}
                />
              ) : (
                <Button variant="secondary" disabled={!current} onClick={exportCurrent}>
                  Export CSV
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!current}
                onClick={() => (kind === 'mis' ? setPrintOpen(true) : window.print())}
              >
                {kind === 'mis' ? 'Print / Save as PDF' : 'Print'}
              </Button>
            </>
          }
        />

        <div className="mb-3">
          <Tabs options={TABS} value={kind} onChange={setKind} ariaLabel="Report" />
          <p className="mt-2 text-sm text-ink-500">{DESCRIPTIONS[kind]}</p>
        </div>

        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            {USES_YEAR[kind] ? (
              <Field
                label={kind === 'completion' ? 'As of school year' : 'School year'}
                htmlFor="report-year"
                className="min-w-[9rem] flex-1"
              >
                <Select
                  id="report-year"
                  value={academicYearId || activeYearId}
                  onChange={(event) => setAcademicYearId(event.target.value)}
                  disabled={ranged}
                  title={ranged ? 'The dates choose the trainees instead.' : undefined}
                >
                  {(years.data ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                      {y.isActive ? ' (active)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {USES_SEMESTER[kind] ? (
              <Field label="Semester" htmlFor="report-period" className="min-w-[9rem] flex-1">
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
            <Field label="Diploma" htmlFor="report-program" className="min-w-[11rem] flex-[1.3]">
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
            {USES_DATES(kind) ? (
              <Field label="Enrolled between" htmlFor="report-from" className="min-w-[18rem] flex-[1.7]">
                {/* One box, two dates. Optional; a range looks across every school year. */}
                <div
                  className="flex items-center rounded-md border border-line bg-surface transition-colors focus-within:border-accent"
                  title="Optional. A date range looks across every school year."
                >
                  <input
                    id="report-from"
                    type="date"
                    aria-label="Enrolled from"
                    value={enrolledFrom}
                    max={enrolledTo || undefined}
                    onChange={(event) => setEnrolledFrom(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink-900 outline-none"
                  />
                  <span className="shrink-0 text-xs text-ink-500">to</span>
                  <input
                    type="date"
                    aria-label="Enrolled to"
                    value={enrolledTo}
                    min={enrolledFrom || undefined}
                    onChange={(event) => setEnrolledTo(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-ink-900 outline-none"
                  />
                  {ranged ? (
                    <button
                      type="button"
                      aria-label="Clear the dates"
                      title="Clear the dates"
                      onClick={() => {
                        setEnrolledFrom('');
                        setEnrolledTo('');
                      }}
                      className="shrink-0 px-2.5 text-base leading-none text-ink-500 hover:text-ink-900"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </Field>
            ) : null}
            {kind === 'enrollment' ? (
              <div className="shrink-0" title="Leave off to print only the figures.">
                <Checkbox
                  label="Include trainee list"
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
          ) : current?.kind === 'lacking' ? (
            <LackingReportSheet report={current.data} />
          ) : current?.kind === 'mis' ? (
            <MisReportSheet report={current.data} />
          ) : null}
        </QueryState>
      </Card>

      <MisPrintModal open={printOpen} onClose={() => setPrintOpen(false)} />
    </>
  );
}

/** One Export button; the MIS report picks Excel or CSV from its menu. */
function ExportMenu({
  disabled,
  loading,
  onExcel,
  onCsv,
}: {
  disabled: boolean;
  loading: boolean;
  onExcel: () => void;
  onCsv: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const pick = (action: () => void) => {
    setOpen(false);
    action();
  };
  const item =
    'flex w-full flex-col items-start px-3 py-2 text-left text-sm text-ink-900 hover:bg-[#1a6fd6] hover:text-white focus:bg-[#1a6fd6] focus:text-white focus:outline-none';

  return (
    <div ref={box} className="relative">
      <Button
        variant="secondary"
        disabled={disabled}
        loading={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Export
        <span aria-hidden className="ml-1.5 text-xs">
          ▾
        </span>
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg"
        >
          <button type="button" role="menuitem" className={item} onClick={() => pick(onExcel)}>
            <span className="font-medium">Excel (.xlsx)</span>
            <span className="text-xs opacity-75">A sheet per diploma</span>
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => pick(onCsv)}>
            <span className="font-medium">CSV (.csv)</span>
            <span className="text-xs opacity-75">Every diploma in one file</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Orientation and paper before the MIS report prints or saves as PDF. */
function MisPrintModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [settings, setSettings] = useState<MisPrintSettings>(MIS_PRINT_DEFAULT);
  // Every print starts from the centre's default: landscape on long bond.
  useEffect(() => {
    if (open) setSettings(MIS_PRINT_DEFAULT);
  }, [open]);

  const print = () => {
    onClose();
    // Let the window close before the print preview takes the screen.
    setTimeout(() => printMis(settings), 150);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Print / Save as PDF"
      description="Choose the paper, then pick your printer or “Save as PDF” in the next window."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={print}>
            Print
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-900">Orientation</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['landscape', 'portrait'] as const).map((value) => (
              <label
                key={value}
                className={
                  'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ' +
                  (settings.orientation === value
                    ? 'border-accent bg-info-soft text-ink-900'
                    : 'border-line text-ink-700')
                }
              >
                <input
                  type="radio"
                  name="mis-orientation"
                  value={value}
                  checked={settings.orientation === value}
                  onChange={() => setSettings((s) => ({ ...s, orientation: value }))}
                />
                <span
                  aria-hidden
                  className={
                    'inline-block border border-current ' + (value === 'landscape' ? 'h-3 w-4' : 'h-4 w-3')
                  }
                />
                {value === 'landscape' ? 'Landscape' : 'Portrait'}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Paper size" htmlFor="mis-paper">
          <Select
            id="mis-paper"
            value={settings.paper}
            onChange={(event) =>
              setSettings((s) => ({
                ...s,
                paper: event.target.value as MisPaper,
              }))
            }
          >
            {MIS_PAPERS.map((paper) => (
              <option key={paper.value} value={paper.value}>
                {paper.label}
              </option>
            ))}
          </Select>
        </Field>
        {settings.orientation === 'portrait' ? (
          <p className="text-xs text-ink-500">
            All 39 columns still fit across, but the type is very small (about 3pt). Landscape reads far more easily.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/** "MIS-2026-2027" or "MIS-DIT-enrolled-09-01-2026-to-09-30-2026". */
function misFileName(report: {
  schoolYearLabel: string;
  dateRangeLabel: string;
  sheets: Array<{ programCode: string }>;
}) {
  const diploma = report.sheets.length === 1 ? `-${report.sheets[0].programCode}` : '';
  const when = report.dateRangeLabel
    ? report.dateRangeLabel.replace(/^Enrolled /, 'enrolled-').replace(/\s+/g, '-')
    : report.schoolYearLabel.replace(/\s+/g, '');
  return `MIS${diploma}-${when}`;
}
