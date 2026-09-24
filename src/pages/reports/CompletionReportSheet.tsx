import type { CompletionReport, CompletionRow } from '@/types/views';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import {
  Empty,
  Figure,
  Figures,
  Num,
  ReportHeader,
  ReportSignatures,
  SectionTitle,
  type CsvRow,
} from './report-parts';

/**
 * Completion is measured against each trainee's own curriculum: every
 * required subject passed or credited. It is a list of who is eligible for
 * graduation, not a graduation — marking a trainee Graduated stays with the
 * Registrar, the same as a drop does.
 */
export function CompletionReportSheet({ report }: { report: CompletionReport }) {
  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader
        title="Completion Report"
        subtitle={`${report.programLabel} · as of School Year ${report.schoolYearLabel}`}
        generatedAt={report.generatedAt}
      />

      <Figures>
        <Figure
          label="Completed"
          value={report.completed.length}
          hint="Every curriculum subject passed"
        />
        <Figure
          label="Nearing completion"
          value={report.nearing.length}
          hint="Final year, work still to pass"
        />
        <Figure label="In progress" value={report.inProgress} hint="Earlier year levels" />
        <Figure
          label="Graduated"
          value={report.completed.filter((r) => r.studentStatus === 'Graduated').length}
          hint="Already marked by the Registrar"
        />
      </Figures>

      <section>
        <SectionTitle note="Eligible for graduation. Marking a trainee Graduated is done from the Students list.">
          Completed their diploma
        </SectionTitle>
        {report.completed.length === 0 ? (
          <Empty>No trainee has completed every subject of their curriculum yet.</Empty>
        ) : (
          <CompletionTable rows={report.completed} finished />
        )}
      </section>

      <section>
        <SectionTitle note="In their final year, fewest subjects remaining first.">
          Nearing completion
        </SectionTitle>
        {report.nearing.length === 0 ? (
          <Empty>No trainee is in their final year with work outstanding.</Empty>
        ) : (
          <CompletionTable rows={report.nearing} />
        )}
      </section>

      <ReportSignatures />
    </div>
  );
}

function CompletionTable({ rows, finished }: { rows: CompletionRow[]; finished?: boolean }) {
  return (
    <TableWrap>
      <Table className="min-w-[48rem] text-xs">
        <thead>
          <tr>
            <Th>ID Number</Th>
            <Th>Name</Th>
            <Th>Diploma</Th>
            <Th>Batch</Th>
            <Th className="text-right">Subjects</Th>
            <Th className="text-right">Units</Th>
            <Th className="text-right">GWA</Th>
            <Th>{finished ? 'Finished in' : 'Still to pass'}</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <Td className="tabular-nums">{row.studentNumber}</Td>
              <Td className="font-medium text-ink-900">{row.name}</Td>
              <Td>{row.programCode}</Td>
              <Td>{row.curriculumYear}</Td>
              <Num value={`${row.subjectsPassed}/${row.subjectsRequired}`} />
              <Num value={`${row.unitsEarned}/${row.unitsRequired}`} />
              <Num value={row.gwa} strong />
              <Td className="text-ink-700">
                {finished
                  ? (row.finishedIn ?? '—')
                  : `${row.remaining.length}: ${row.remaining.slice(0, 6).join(', ')}${row.remaining.length > 6 ? '…' : ''}`}
              </Td>
              <Td>{row.studentStatus}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  );
}

export function completionCsv(report: CompletionReport): CsvRow[] {
  const line = (r: CompletionRow): CsvRow => [
    r.studentNumber, r.name, r.programCode, r.curriculumYear, r.yearLevel,
    r.subjectsPassed, r.subjectsRequired, r.unitsEarned, r.unitsRequired, r.gwa,
    r.finishedIn ?? '', r.remaining.join('; '), r.studentStatus,
  ];
  const header: CsvRow = [
    'ID Number', 'Name', 'Diploma', 'Batch', 'Year', 'Subjects passed', 'Subjects required',
    'Units earned', 'Units required', 'GWA', 'Finished in', 'Still to pass', 'Status',
  ];
  return [
    ['Completion Report'],
    ['Diploma', report.programLabel],
    ['As of school year', report.schoolYearLabel],
    ['Generated', report.generatedAt],
    [],
    ['COMPLETED'],
    header,
    ...report.completed.map(line),
    [],
    ['NEARING COMPLETION'],
    header,
    ...report.nearing.map(line),
    [],
    ['In progress (earlier year levels)', report.inProgress],
  ];
}
