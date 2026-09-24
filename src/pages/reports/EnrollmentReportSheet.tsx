import type { EnrollmentReport } from '@/types/views';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import {
  Figure,
  Num,
  ReportHeader,
  ReportSignatures,
  type CsvRow,
} from './report-parts';

const YEAR_HEADINGS = ['1st Yr', '2nd Yr', '3rd Yr', '4th Yr', '5th Yr'];

/**
 * The Enrollment report as a document: the centre's header, the figures, and
 * a signature block — printable on its own, the same way the Grade
 * Evaluation and the enrolment list are.
 *
 * Three levels, each answering a question the one above cannot: the totals
 * (how many), by diploma (where), by section (in which class), and the
 * trainee list (who). The list can be left off the printout when only the
 * figures are wanted.
 */
export function EnrollmentReportSheet({
  report,
  includeRoster,
}: {
  report: EnrollmentReport;
  includeRoster: boolean;
}) {
  const t = report.totals;
  const years = YEAR_HEADINGS.slice(0, report.yearLevels);

  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader
        title="Enrollment Report"
        subtitle={`School Year ${report.schoolYearLabel} · ${report.periodLabel} · ${report.programLabel}`}
        generatedAt={report.generatedAt}
      />

      {/* ---- Totals ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="Trainees enrolled" value={t.trainees} hint={`${t.male} male · ${t.female} female`} />
        <Figure label="New trainees" value={t.newTrainees} hint="First enrolled this school year" />
        <Figure label="Continuing" value={t.continuing} hint="Enrolled in an earlier school year" />
        <Figure
          label="Units carried"
          value={t.units}
          hint={t.dropped > 0 ? `${t.dropped} dropped enrolment(s) not counted` : 'No dropped enrolments'}
        />
      </div>

      {report.byDiploma.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-500">
          Nobody is enrolled for this selection.
        </p>
      ) : (
        <>
          {/* ---- By diploma ---- */}
          <section className="break-inside-avoid">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-700">
              Enrollment by diploma
            </h3>
            <TableWrap>
              <Table className="min-w-[48rem] text-xs">
                <thead>
                  <tr>
                    <Th>Diploma</Th>
                    {years.map((y) => (
                      <Th key={y} className="text-right">
                        {y}
                      </Th>
                    ))}
                    <Th className="text-right">Male</Th>
                    <Th className="text-right">Female</Th>
                    <Th className="text-right">New</Th>
                    <Th className="text-right">Cont.</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Share</Th>
                    <Th className="text-right">Units</Th>
                    <Th className="text-right">Dropped</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDiploma.map((row) => (
                    <tr key={row.programId}>
                      <Td>
                        <span className="block font-semibold text-ink-900">{row.code}</span>
                        <span className="block text-[11px] text-ink-500">{row.name}</span>
                      </Td>
                      {row.byYear.map((count, index) => (
                        <Num key={index} value={count} />
                      ))}
                      <Num value={row.male} />
                      <Num value={row.female} />
                      <Num value={row.newTrainees} />
                      <Num value={row.continuing} />
                      <Num value={row.trainees} strong />
                      <Td className="text-right tabular-nums text-ink-700">
                        {t.trainees ? `${((row.trainees / t.trainees) * 100).toFixed(1)}%` : '—'}
                      </Td>
                      <Num value={row.units} />
                      <Num value={row.dropped} />
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink-400">
                    <Td className="font-bold text-ink-900">TOTAL</Td>
                    {years.map((_, index) => (
                      <Num
                        key={index}
                        strong
                        value={report.byDiploma.reduce((sum, r) => sum + (r.byYear[index] ?? 0), 0)}
                      />
                    ))}
                    <Num value={t.male} strong />
                    <Num value={t.female} strong />
                    <Num value={t.newTrainees} strong />
                    <Num value={t.continuing} strong />
                    <Num value={t.trainees} strong />
                    <Td className="text-right font-bold tabular-nums text-ink-900">100%</Td>
                    <Num value={t.units} strong />
                    <Num value={t.dropped} strong />
                  </tr>
                </tbody>
              </Table>
            </TableWrap>
            <p className="mt-1 text-[10px] text-ink-500">
              A trainee counts once per diploma, at the highest year level held in the period.
              Dropped enrolments are listed separately and are not in any other figure.
            </p>
          </section>

          {/* ---- By section ---- */}
          <section className="break-inside-avoid">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-700">
              Enrollment by section
            </h3>
            <TableWrap>
              <Table className="min-w-[36rem] text-xs">
                <thead>
                  <tr>
                    <Th>Section</Th>
                    <Th>Term</Th>
                    <Th className="text-right">Male</Th>
                    <Th className="text-right">Female</Th>
                    <Th className="text-right">Trainees</Th>
                    <Th className="text-right">Units</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySection.map((row) => (
                    <tr key={row.key}>
                      <Td className="font-medium text-ink-900">{row.sectionCode}</Td>
                      <Td className="text-ink-700">{row.termLabel}</Td>
                      <Num value={row.male} />
                      <Num value={row.female} />
                      <Num value={row.trainees} strong />
                      <Num value={row.units} />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>

          {/* ---- Who ---- */}
          {includeRoster ? (
            <section>
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-700">
                Trainees enrolled ({report.roster.length} enrolment
                {report.roster.length === 1 ? '' : 's'})
              </h3>
              <TableWrap>
                <Table className="min-w-[48rem] text-xs">
                  <thead>
                    <tr>
                      <Th className="w-8 text-right">No.</Th>
                      <Th>ID Number</Th>
                      <Th>Name</Th>
                      <Th>Sex</Th>
                      <Th>Section</Th>
                      <Th>Term</Th>
                      <Th className="text-right">Units</Th>
                      <Th>Type</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.roster.map((row, index) => (
                      <tr key={row.enrollmentId}>
                        <Td className="text-right tabular-nums text-ink-500">{index + 1}</Td>
                        <Td className="tabular-nums">{row.studentNumber}</Td>
                        <Td className="font-medium text-ink-900">{row.name}</Td>
                        <Td>{row.sex === 'MALE' ? 'M' : 'F'}</Td>
                        <Td>{row.sectionCode}</Td>
                        <Td className="text-ink-700">{row.termLabel}</Td>
                        <Td className="text-right tabular-nums">{row.units}</Td>
                        <Td>{row.isNew ? 'New' : 'Continuing'}</Td>
                        <Td className={row.status === 'DROPPED' ? 'font-semibold text-danger-ink' : ''}>
                          {row.status}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </section>
          ) : null}
        </>
      )}

      <ReportSignatures />
    </div>
  );
}

export function enrollmentCsv(report: EnrollmentReport): CsvRow[] {
  const years = Array.from({ length: report.yearLevels }, (_, i) => `Year ${i + 1}`);
  const t = report.totals;
  return [
    ['Enrollment Report'],
    ['School year', report.schoolYearLabel],
    ['Semester', report.periodLabel],
    ['Diploma', report.programLabel],
    ['Generated', report.generatedAt],
    [],
    ['BY DIPLOMA'],
    ['Code', 'Diploma', ...years, 'Male', 'Female', 'New', 'Continuing', 'Total', 'Units', 'Dropped'],
    ...report.byDiploma.map((r) => [
      r.code, r.name, ...r.byYear, r.male, r.female, r.newTrainees, r.continuing, r.trainees, r.units, r.dropped,
    ]),
    [
      'TOTAL',
      '',
      ...years.map((_, i) => report.byDiploma.reduce((sum, r) => sum + (r.byYear[i] ?? 0), 0)),
      t.male, t.female, t.newTrainees, t.continuing, t.trainees, t.units, t.dropped,
    ],
    [],
    ['BY SECTION'],
    ['Diploma', 'Section', 'Term', 'Male', 'Female', 'Trainees', 'Units'],
    ...report.bySection.map((r) => [r.programCode, r.sectionCode, r.termLabel, r.male, r.female, r.trainees, r.units]),
    [],
    ['TRAINEES'],
    ['ID Number', 'Name', 'Sex', 'Diploma', 'Section', 'Term', 'Units', 'Type', 'Status', 'Date Enrolled'],
    ...report.roster.map((r) => [
      r.studentNumber, r.name, r.sex === 'MALE' ? 'M' : 'F', r.programCode, r.sectionCode, r.termLabel,
      r.units, r.isNew ? 'New' : 'Continuing', r.status, r.enrolledAt.slice(0, 10),
    ]),
  ];
}
