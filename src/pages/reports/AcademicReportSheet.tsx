import type { AcademicReport } from '@/types/views';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import {
  Empty,
  Figure,
  Figures,
  Num,
  ReportHeader,
  ReportSignatures,
  SectionTitle,
  pct,
  type CsvRow,
} from './report-parts';

/**
 * How trainees did. Pass rate is over subjects with a final grade; an INC
 * still open and a subject still waiting on its grade are counted beside it,
 * not inside it, so an unfinished term does not read as a failing one.
 */
export function AcademicReportSheet({ report }: { report: AcademicReport }) {
  const t = report.totals;
  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader
        title="Academic Performance Report"
        subtitle={`School Year ${report.schoolYearLabel} · ${report.periodLabel} · ${report.programLabel}`}
        generatedAt={report.generatedAt}
      />

      <Figures>
        <Figure
          label="Pass rate"
          value={pct(t.passRate)}
          hint={`${t.passed} of ${t.graded} graded subjects passed`}
        />
        <Figure
          label="Average GWA"
          value={t.averageGwa ?? '—'}
          hint="Mean of fully graded terms (1.00 is best)"
        />
        <Figure
          label="Average percentage"
          value={t.averagePercentage === null ? '—' : `${t.averagePercentage}%`}
          hint={`${t.incomplete} INC open · ${t.ungraded} not yet graded`}
        />
        <Figure
          label="Below the 79% line"
          value={t.forReview + t.recommendedDrop}
          hint={`${t.recommendedDrop} recommended for drop · ${t.forReview} for review`}
        />
      </Figures>

      {report.byDiploma.length === 0 ? (
        <Empty>No graded work for this selection.</Empty>
      ) : (
        <>
          <section className="break-inside-avoid">
            <SectionTitle>By diploma</SectionTitle>
            <TableWrap>
              <Table className="min-w-[48rem] text-xs">
                <thead>
                  <tr>
                    <Th>Diploma</Th>
                    <Th className="text-right">Trainees</Th>
                    <Th className="text-right">Graded</Th>
                    <Th className="text-right">Passed</Th>
                    <Th className="text-right">Failed</Th>
                    <Th className="text-right">INC</Th>
                    <Th className="text-right">Ungraded</Th>
                    <Th className="text-right">Pass rate</Th>
                    <Th className="text-right">Avg GWA</Th>
                    <Th className="text-right">Avg %</Th>
                    <Th className="text-right">Review</Th>
                    <Th className="text-right">Drop</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...report.byDiploma, { ...t, programId: 'total', code: 'TOTAL', name: '' }].map((row) => (
                    <tr key={row.programId} className={row.programId === 'total' ? 'border-t-2 border-ink-400' : ''}>
                      <Td>
                        <span className="block font-semibold text-ink-900">{row.code}</span>
                        {row.name ? <span className="block text-[11px] text-ink-500">{row.name}</span> : null}
                      </Td>
                      <Num value={row.trainees} strong={row.programId === 'total'} />
                      <Num value={row.graded} strong={row.programId === 'total'} />
                      <Num value={row.passed} strong={row.programId === 'total'} />
                      <Num value={row.failed} strong={row.programId === 'total'} />
                      <Num value={row.incomplete} strong={row.programId === 'total'} />
                      <Num value={row.ungraded} strong={row.programId === 'total'} />
                      <Num value={pct(row.passRate)} strong />
                      <Num value={row.averageGwa ?? '—'} strong={row.programId === 'total'} />
                      <Num
                        value={row.averagePercentage === null ? '—' : `${row.averagePercentage}%`}
                        strong={row.programId === 'total'}
                      />
                      <Num value={row.forReview} strong={row.programId === 'total'} />
                      <Num value={row.recommendedDrop} strong={row.programId === 'total'} />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>

          <section>
            <SectionTitle note="Weakest pass rate first — where trainees struggle most.">
              By subject
            </SectionTitle>
            <TableWrap>
              <Table className="min-w-[48rem] text-xs">
                <thead>
                  <tr>
                    <Th>Diploma</Th>
                    <Th>Subject</Th>
                    <Th>Term</Th>
                    <Th className="text-right">Trainees</Th>
                    <Th className="text-right">Passed</Th>
                    <Th className="text-right">Failed</Th>
                    <Th className="text-right">INC</Th>
                    <Th className="text-right">Pass rate</Th>
                    <Th className="text-right">Avg %</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.bySubject.map((row) => (
                    <tr key={row.key}>
                      <Td>{row.programCode}</Td>
                      <Td>
                        <span className="font-semibold text-ink-900">{row.subjectCode}</span>{' '}
                        <span className="text-ink-500">{row.subjectTitle}</span>
                      </Td>
                      <Td className="text-ink-700">{row.termLabel}</Td>
                      <Num value={row.trainees} />
                      <Num value={row.passed} />
                      <Num value={row.failed} />
                      <Num value={row.incomplete} />
                      <Num value={pct(row.passRate)} strong />
                      <Num value={row.averagePercentage === null ? '—' : `${row.averagePercentage}%`} />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="break-inside-avoid">
              <SectionTitle note="Best term GWA among fully graded terms with no INC.">
                Top performers
              </SectionTitle>
              {report.topPerformers.length === 0 ? (
                <Empty>No term is fully graded yet.</Empty>
              ) : (
                <TableWrap>
                  <Table className="min-w-[24rem] text-xs">
                    <thead>
                      <tr>
                        <Th className="w-8 text-right">#</Th>
                        <Th>Trainee</Th>
                        <Th>Term</Th>
                        <Th className="text-right">GWA</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topPerformers.map((row, index) => (
                        <tr key={`${row.studentId}-${row.termLabel}`}>
                          <Td className="text-right tabular-nums text-ink-500">{index + 1}</Td>
                          <Td>
                            <span className="block font-medium text-ink-900">{row.name}</span>
                            <span className="block text-[11px] text-ink-500">
                              {row.studentNumber} · {row.programCode}
                            </span>
                          </Td>
                          <Td className="text-ink-700">{row.termLabel}</Td>
                          <Num value={row.gwa} strong />
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </section>

            <section className="break-inside-avoid">
              <SectionTitle note="75% and below: recommended for drop. 76–79%: for review. The Registrar decides.">
                Below the centre&rsquo;s line
              </SectionTitle>
              {report.standing.length === 0 ? (
                <Empty>Every graded trainee is at 80% or above.</Empty>
              ) : (
                <TableWrap>
                  <Table className="min-w-[24rem] text-xs">
                    <thead>
                      <tr>
                        <Th>Trainee</Th>
                        <Th className="text-right">Lowest</Th>
                        <Th>Standing</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.standing.map((row) => (
                        <tr key={row.studentId}>
                          <Td>
                            <span className="block font-medium text-ink-900">{row.name}</span>
                            <span className="block text-[11px] text-ink-500">
                              {row.studentNumber} · {row.programCode} · {row.termLabel}
                            </span>
                          </Td>
                          <Num value={row.lowestPercentage === null ? '—' : `${row.lowestPercentage}%`} strong />
                          <Td
                            className={
                              row.recommendation === 'DROP'
                                ? 'font-semibold text-danger-ink'
                                : 'font-semibold text-warning-ink'
                            }
                          >
                            {row.recommendation === 'DROP' ? 'Recommended for drop' : 'For review'}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </section>
          </div>
        </>
      )}

      <ReportSignatures />
    </div>
  );
}

export function academicCsv(report: AcademicReport): CsvRow[] {
  const t = report.totals;
  return [
    ['Academic Performance Report'],
    ['School year', report.schoolYearLabel],
    ['Semester', report.periodLabel],
    ['Diploma', report.programLabel],
    ['Generated', report.generatedAt],
    [],
    ['BY DIPLOMA'],
    ['Code', 'Diploma', 'Trainees', 'Graded', 'Passed', 'Failed', 'INC', 'Ungraded', 'Pass rate %', 'Avg GWA', 'Avg %', 'For review', 'Recommended drop'],
    ...report.byDiploma.map((r) => [
      r.code, r.name, r.trainees, r.graded, r.passed, r.failed, r.incomplete, r.ungraded,
      r.passRate, r.averageGwa, r.averagePercentage, r.forReview, r.recommendedDrop,
    ]),
    ['TOTAL', '', t.trainees, t.graded, t.passed, t.failed, t.incomplete, t.ungraded, t.passRate, t.averageGwa, t.averagePercentage, t.forReview, t.recommendedDrop],
    [],
    ['BY SUBJECT'],
    ['Diploma', 'Subject code', 'Subject', 'Term', 'Trainees', 'Passed', 'Failed', 'INC', 'Pass rate %', 'Avg %'],
    ...report.bySubject.map((r) => [
      r.programCode, r.subjectCode, r.subjectTitle, r.termLabel, r.trainees, r.passed, r.failed,
      r.incomplete, r.passRate, r.averagePercentage,
    ]),
    [],
    ['TOP PERFORMERS'],
    ['Rank', 'ID Number', 'Name', 'Diploma', 'Term', 'GWA'],
    ...report.topPerformers.map((r, i) => [i + 1, r.studentNumber, r.name, r.programCode, r.termLabel, r.gwa]),
    [],
    ['BELOW THE 79% LINE'],
    ['ID Number', 'Name', 'Diploma', 'Term', 'Lowest %', 'Standing'],
    ...report.standing.map((r) => [
      r.studentNumber, r.name, r.programCode, r.termLabel, r.lowestPercentage,
      r.recommendation === 'DROP' ? 'Recommended for drop' : 'For review',
    ]),
  ];
}
