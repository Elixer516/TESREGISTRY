import { useMemo, useState } from 'react';
import type { LackingReport, LackingTraineeView } from '@/types/views';
import { yearLevelLabel } from '@/types';
import { Badge, Checkbox, Table, TableWrap, Td, TextInput, Th } from '@/components/ui';
import { FilterPanel, matchesSelection, type FilterGroup, type FilterSelection } from '@/components/FilterPanel';
import { Empty, Figure, Figures, ReportHeader, ReportSignatures, SectionTitle, type CsvRow } from './report-parts';

type Lack = 'REQUIREMENTS' | 'NO_GRADE' | 'INC';

const LACK_LABELS: Record<Lack, string> = {
  REQUIREMENTS: 'Requirements',
  NO_GRADE: 'No grade yet',
  INC: 'INC not completed',
};

const uniq = <T,>(values: T[]) => [...new Set(values)];

/** What one trainee is short of, once the open-term toggle has been applied. */
function shownSubjects(row: LackingTraineeView, includeOpenTerms: boolean) {
  // An overdue grade is shown either way: its term may be open, but it is late.
  return row.subjects.filter((s) => includeOpenTerms || !s.termOpen || s.overdue);
}

function lacksOf(row: LackingTraineeView, includeOpenTerms: boolean): Lack[] {
  const subjects = shownSubjects(row, includeOpenTerms);
  return [
    ...(row.missingRequirements.length ? (['REQUIREMENTS'] as Lack[]) : []),
    ...(subjects.some((s) => s.state === 'NO_GRADE') ? (['NO_GRADE'] as Lack[]) : []),
    ...(subjects.some((s) => s.state === 'INC') ? (['INC'] as Lack[]) : []),
  ];
}

/**
 * Trainees with something outstanding: admission requirements not on file,
 * subjects with no grade yet, and INCs not yet completed. Filters narrow the
 * list on screen and on paper alike; the header says what was chosen.
 *
 * Used by the Registrar's Reports (every diploma) and a head trainer's own
 * diploma, where `showDiploma` is off.
 */
export function LackingReportSheet({
  report,
  showDiploma = true,
  signatures = true,
}: {
  report: LackingReport;
  showDiploma?: boolean;
  signatures?: boolean;
}) {
  const [filters, setFilters] = useState<FilterSelection>({});
  const [search, setSearch] = useState('');
  const [includeOpenTerms, setIncludeOpenTerms] = useState(true);

  const groups = useMemo<FilterGroup[]>(
    () => [
      {
        key: 'lack',
        label: 'What is lacking',
        chips: (Object.keys(LACK_LABELS) as Lack[]).map((v) => ({ value: v, label: LACK_LABELS[v] })),
      },
      ...(showDiploma
        ? [{ key: 'diploma', label: 'Diploma', chips: uniq(report.rows.map((r) => r.programCode)).sort().map((v) => ({ value: v, label: v })) }]
        : []),
      {
        key: 'year',
        label: 'Year level',
        chips: uniq(report.rows.map((r) => r.yearLevel))
          .sort((a, b) => a - b)
          .map((v) => ({ value: String(v), label: yearLevelLabel(v) })),
      },
      {
        key: 'section',
        label: 'Section',
        chips: uniq(report.rows.map((r) => r.sectionCode))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((v) => ({ value: v, label: v })),
      },
      {
        key: 'scholarship',
        label: 'Scholarship',
        chips: uniq(report.rows.map((r) => r.scholarship)).sort().map((v) => ({ value: v, label: v })),
      },
      {
        key: 'batch',
        label: 'Batch',
        chips: uniq(report.rows.map((r) => r.batch).filter(Boolean))
          .sort()
          .reverse()
          .map((v) => ({ value: v, label: `Batch ${v}`, title: `First enrolled in ${v}` })),
      },
    ],
    [report, showDiploma],
  );

  const needle = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      report.rows.filter((r) => {
        const lacks = lacksOf(r, includeOpenTerms);
        if (lacks.length === 0) return false;
        if (needle && !`${r.name} ${r.studentNumber}`.toLowerCase().includes(needle)) return false;
        return matchesSelection(filters, (key) => {
          switch (key) {
            case 'lack': return lacks;
            case 'diploma': return r.programCode;
            case 'year': return String(r.yearLevel);
            case 'section': return r.sectionCode;
            case 'scholarship': return r.scholarship;
            case 'batch': return r.batch;
            default: return null;
          }
        });
      }),
    [report, filters, needle, includeOpenTerms],
  );

  const chosen = Object.entries(filters)
    .filter(([, v]) => v.length)
    .map(([key, v]) => {
      const group = groups.find((g) => g.key === key);
      return `${group?.label ?? key}: ${v.map((x) => group?.chips.find((c) => c.value === x)?.label ?? x).join(', ')}`;
    });
  const subtitle = [report.scopeLabel, ...chosen, includeOpenTerms ? null : 'Subjects not yet due left out'].filter(Boolean).join(' · ');

  const withRequirements = rows.filter((r) => r.missingRequirements.length > 0).length;
  const withNoGrade = rows.filter((r) => shownSubjects(r, includeOpenTerms).some((s) => s.state === 'NO_GRADE')).length;
  const withInc = rows.filter((r) => shownSubjects(r, includeOpenTerms).some((s) => s.state === 'INC')).length;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-3">
        <TextInput
          aria-label="Search trainees"
          placeholder="Search name or student number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[14rem] flex-1"
        />
        <Checkbox
          label="Include subjects not yet due"
          description="Open-term subjects whose deadline has not passed."
          checked={includeOpenTerms}
          onChange={(e) => setIncludeOpenTerms(e.target.checked)}
        />
        <FilterPanel groups={groups} value={filters} onChange={setFilters} />
      </div>

      <div className="print-sheet report-sheet space-y-5">
        <ReportHeader title="Lacking Requirements and Grades" subtitle={subtitle} generatedAt={report.generatedAt} />

        <Figures>
          <Figure label="Trainees listed" value={rows.length} hint={`of ${report.traineesInScope} at the centre`} />
          <Figure label="Lacking requirements" value={withRequirements} hint="Not uploaded or received" />
          <Figure label="Subjects with no grade" value={withNoGrade} hint="Trainees with one or more" />
          <Figure label="INC not completed" value={withInc} hint="Trainees with one or more" />
        </Figures>

        <section>
          <SectionTitle note="Requirements count once uploaded or received on paper. A subject counts until its grade is posted or its INC completed.">
            Trainees with something outstanding
          </SectionTitle>
          {rows.length === 0 ? (
            <Empty>Nothing to see here — no trainee in this selection lacks requirements or grades.</Empty>
          ) : (
            <TableWrap className="relative">
              <Table className="min-w-[56rem] text-xs">
                <thead>
                  <tr>
                    <Th>Trainee</Th>
                    <Th>{showDiploma ? 'Diploma · section' : 'Section'}</Th>
                    <Th>Batch</Th>
                    <Th>Scholarship</Th>
                    <Th>Requirements lacking</Th>
                    <Th>Subjects not graded or not completed</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const subjects = shownSubjects(r, includeOpenTerms);
                    return (
                      <tr key={r.studentId} className="align-top">
                        <Td>
                          <p className="font-medium text-ink-900">{r.name}</p>
                          <p className="text-ink-500">{r.studentNumber}</p>
                        </Td>
                        <Td>
                          {showDiploma ? `${r.programCode} · ` : ''}
                          {r.sectionCode}
                        </Td>
                        <Td>{r.batch || '—'}</Td>
                        <Td>{r.scholarship}</Td>
                        <Td>
                          {r.missingRequirements.length === 0 ? (
                            <span className="text-ink-500">Complete</span>
                          ) : (
                            <ul className="list-disc space-y-0.5 pl-4">
                              {r.missingRequirements.map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          )}
                        </Td>
                        <Td>
                          {subjects.length === 0 ? (
                            <span className="text-ink-500">All graded</span>
                          ) : (
                            <ul className="space-y-1">
                              {subjects.map((s) => (
                                <li key={s.enrollmentSubjectId} className="flex flex-wrap items-center gap-1">
                                  <span className="font-medium text-ink-900">{s.subjectCode}</span>
                                  <Badge tone={s.state === 'INC' || s.overdue ? 'danger' : s.termOpen ? 'neutral' : 'warning'}>
                                    {s.state === 'INC' ? 'INC' : s.overdue ? 'Overdue' : s.termOpen ? 'Term running' : 'No grade'}
                                  </Badge>
                                  <span className="text-ink-500">
                                    {s.termLabel}, {s.academicYearLabel} · {s.trainerName}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </section>

        {signatures ? <ReportSignatures /> : null}
      </div>
    </div>
  );
}

export function lackingCsv(report: LackingReport): CsvRow[] {
  const rows: CsvRow[] = [
    ['Student number', 'Name', 'Diploma', 'Year level', 'Section', 'Batch', 'Scholarship', 'Requirements lacking', 'Subject', 'Subject status', 'Term', 'School year', 'Trainer'],
  ];
  for (const r of report.rows) {
    const base = [r.studentNumber, r.name, r.programCode, r.yearLevel, r.sectionCode, r.batch, r.scholarship, r.missingRequirements.join('; ')];
    if (r.subjects.length === 0) rows.push([...base, '', '', '', '', '']);
    for (const s of r.subjects) {
      rows.push([
        ...base,
        s.subjectCode,
        s.state === 'INC' ? 'INC not completed' : s.overdue ? 'No grade, past the deadline' : s.termOpen ? 'No grade yet (term running)' : 'No grade',
        s.termLabel,
        s.academicYearLabel,
        s.trainerName,
      ]);
    }
  }
  return rows;
}
