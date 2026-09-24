import type { RetentionReport } from '@/types/views';
import { formatDate } from '@/lib/format';
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
 * Retention in the sense the centre means it: of the trainees who finished a
 * term, the share who went on to the next. "Retention" is said precisely
 * here because the word is overloaded — see the requirements note — and a
 * trainee whose next term has not opened yet is counted as awaiting, not as
 * lost.
 */
export function RetentionReportSheet({ report }: { report: RetentionReport }) {
  const o = report.overall;
  const totalDepartures = report.departures.length;
  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader
        title="Retention and Departures Report"
        subtitle={`School Year ${report.schoolYearLabel} · ${report.programLabel}`}
        generatedAt={report.generatedAt}
      />

      <Figures>
        <Figure
          label="Retention rate"
          value={pct(o.retentionRate)}
          hint={`${o.continued} continued · ${o.departed} left`}
        />
        <Figure label="Awaiting next term" value={o.awaiting} hint="Finished, not yet re-enrolled" />
        <Figure
          label="Departures"
          value={totalDepartures}
          hint={`${report.centreInitiated} by the centre · ${report.traineeInitiated} by the trainee`}
        />
        <Figure
          label="Reason not recorded"
          value={report.unrecorded}
          hint={report.unrecorded > 0 ? 'Record it under the trainee' : 'Every departure has a reason'}
        />
      </Figures>

      <section className="break-inside-avoid">
        <SectionTitle note="Retention rate = continued ÷ (continued + left). Trainees still in the term, or awaiting a next term that has not been taken, are in neither.">
          Term to term
        </SectionTitle>
        {report.terms.length === 0 ? (
          <Empty>No enrolments in this school year.</Empty>
        ) : (
          <TableWrap>
            <Table className="min-w-[48rem] text-xs">
              <thead>
                <tr>
                  <Th>Diploma</Th>
                  <Th>Term</Th>
                  <Th>Next term</Th>
                  <Th className="text-right">Enrolled</Th>
                  <Th className="text-right">In progress</Th>
                  <Th className="text-right">Continued</Th>
                  <Th className="text-right">Awaiting</Th>
                  <Th className="text-right">Left</Th>
                  <Th className="text-right">Finished</Th>
                  <Th className="text-right">Retention</Th>
                </tr>
              </thead>
              <tbody>
                {report.terms.map((row) => (
                  <tr key={row.key}>
                    <Td className="font-semibold text-ink-900">{row.programCode}</Td>
                    <Td className="text-ink-700">{row.termLabel}</Td>
                    <Td className="text-ink-500">{row.nextTermLabel}</Td>
                    <Num value={row.enrolled} />
                    <Num value={row.inProgress} />
                    <Num value={row.continued} />
                    <Num value={row.awaiting} />
                    <Num value={row.departed} />
                    <Num value={row.completedProgramme} />
                    <Num value={pct(row.retentionRate)} strong />
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <section className="break-inside-avoid">
        <SectionTitle note="Failed subjects is a departure the centre initiated; every other reason is the trainee's.">
          Departures by reason
        </SectionTitle>
        <TableWrap>
          <Table className="min-w-[28rem] text-xs">
            <thead>
              <tr>
                <Th>Reason</Th>
                <Th>Initiated by</Th>
                <Th className="text-right">Trainees</Th>
                <Th className="text-right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {report.departuresByReason.map((row) => (
                <tr key={row.reason}>
                  <Td className="text-ink-900">{row.label}</Td>
                  <Td className="text-ink-700">{row.institutionInitiated ? 'Centre' : 'Trainee'}</Td>
                  <Num value={row.count} strong={row.count > 0} />
                  <Num
                    value={
                      totalDepartures - report.unrecorded > 0
                        ? `${Math.round((row.count / (totalDepartures - report.unrecorded)) * 1000) / 10}%`
                        : '—'
                    }
                  />
                </tr>
              ))}
              {report.unrecorded > 0 ? (
                <tr>
                  <Td className="italic text-warning-ink">Not recorded</Td>
                  <Td className="text-ink-500">—</Td>
                  <Num value={report.unrecorded} strong />
                  <Num value="—" />
                </tr>
              ) : null}
            </tbody>
          </Table>
        </TableWrap>
      </section>

      <section>
        <SectionTitle>Trainees who left</SectionTitle>
        {report.departures.length === 0 ? (
          <Empty>Nobody left during this school year.</Empty>
        ) : (
          <TableWrap>
            <Table className="min-w-[40rem] text-xs">
              <thead>
                <tr>
                  <Th>ID Number</Th>
                  <Th>Name</Th>
                  <Th>Diploma</Th>
                  <Th className="text-right">Year</Th>
                  <Th>Reason</Th>
                  <Th>Date</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {report.departures.map((row) => (
                  <tr key={row.studentId}>
                    <Td className="tabular-nums">{row.studentNumber}</Td>
                    <Td className="font-medium text-ink-900">{row.name}</Td>
                    <Td>{row.programCode}</Td>
                    <Num value={row.yearLevel} />
                    <Td>
                      {row.reasonLabel}
                      <span className="ml-1 text-[10px] text-ink-500">
                        ({row.institutionInitiated ? 'centre' : 'trainee'})
                      </span>
                    </Td>
                    <Td className="text-ink-700">{row.departedAt ? formatDate(row.departedAt) : '—'}</Td>
                    <Td className="text-ink-500">{row.note || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </section>

      <ReportSignatures />
    </div>
  );
}

export function retentionCsv(report: RetentionReport): CsvRow[] {
  const o = report.overall;
  return [
    ['Retention and Departures Report'],
    ['School year', report.schoolYearLabel],
    ['Diploma', report.programLabel],
    ['Generated', report.generatedAt],
    ['Retention rate %', o.retentionRate],
    ['Continued', o.continued],
    ['Left', o.departed],
    ['Awaiting next term', o.awaiting],
    [],
    ['TERM TO TERM'],
    ['Diploma', 'Term', 'Next term', 'Enrolled', 'In progress', 'Continued', 'Awaiting', 'Left', 'Finished curriculum', 'Retention %'],
    ...report.terms.map((r) => [
      r.programCode, r.termLabel, r.nextTermLabel, r.enrolled, r.inProgress, r.continued,
      r.awaiting, r.departed, r.completedProgramme, r.retentionRate,
    ]),
    [],
    ['DEPARTURES BY REASON'],
    ['Reason', 'Initiated by', 'Trainees'],
    ...report.departuresByReason.map((r) => [r.label, r.institutionInitiated ? 'Centre' : 'Trainee', r.count]),
    ['Not recorded', '', report.unrecorded],
    [],
    ['TRAINEES WHO LEFT'],
    ['ID Number', 'Name', 'Diploma', 'Year', 'Reason', 'Initiated by', 'Date', 'Note'],
    ...report.departures.map((r) => [
      r.studentNumber, r.name, r.programCode, r.yearLevel, r.reasonLabel,
      r.institutionInitiated ? 'Centre' : 'Trainee', r.departedAt?.slice(0, 10) ?? '', r.note,
    ]),
  ];
}
