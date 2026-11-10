import type { MisReport } from '@/types/views';
import { MIS_DATE_COLUMNS } from '@/lib/mis';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import { Empty, ReportHeader, SectionTitle, type CsvRow } from './report-parts';

/**
 * The MIS report on screen: one table per diploma, every column of TESDA's
 * trainee profile sheet. It is wide on purpose — the format is fixed — so it
 * scrolls sideways here and prints landscape.
 */
export function MisReportSheet({ report }: { report: MisReport }) {
  const total = report.sheets.reduce((n, s) => n + s.rows.length, 0);
  return (
    <div className="print-sheet report-sheet mis-sheet space-y-5">
      <ReportHeader
        title="MIS — Trainee Profiles"
        subtitle={`${report.dateRangeLabel || `School Year ${report.schoolYearLabel}`} · ${report.periodLabel} · ${report.programLabel}`}
        generatedAt={report.generatedAt}
      />
      {total === 0 ? (
        <Empty>No trainee is enrolled in what you chose.</Empty>
      ) : (
        report.sheets.map((sheet) => (
          <section key={sheet.programId}>
            <SectionTitle note={`${sheet.rows.length} trainee${sheet.rows.length === 1 ? '' : 's'}`}>
              {sheet.programCode} — {sheet.programName}
            </SectionTitle>
            <TableWrap className="scroll-x">
              <Table className="min-w-[4200px] text-xs">
                <thead>
                  <tr>
                    <Th>#</Th>
                    {report.columns.map((column) => (
                      <Th key={column} className="whitespace-normal align-bottom">
                        {column}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.map((row, i) => (
                    <tr key={i}>
                      <Td className="text-ink-500">{i + 1}</Td>
                      {row.map((value, c) => (
                        <Td key={c}>{value}</Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </section>
        ))
      )}
    </div>
  );
}

/** One CSV: the header once, then every diploma's trainees. */
export function misCsv(report: MisReport): CsvRow[] {
  return [report.columns, ...report.sheets.flatMap((sheet) => sheet.rows)];
}

/** "06-09-2008" → a real date, so Excel sorts and filters it as one. */
function toDate(value: string): Date | string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2]))) : value;
}

/**
 * The workbook in the centre's format: a sheet per diploma named by its code,
 * the header row in bold, dates as dates (mm-dd-yyyy) and ages as numbers.
 * ExcelJS loads only when someone exports, so it costs the app nothing else.
 */
export async function downloadMisExcel(report: MisReport, fileName: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'RegiStream';
  book.created = new Date();
  const age = report.columns.indexOf('Age');
  const sheets = report.sheets.length
    ? report.sheets
    : [{ programId: '', programCode: 'MIS', programName: '', rows: [] as string[][] }];
  const used = new Set<string>();
  for (const sheet of sheets) {
    let name = sheet.programCode.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet';
    while (used.has(name)) name = `${name.slice(0, 28)} ${used.size}`;
    used.add(name);
    const ws = book.addWorksheet(name);
    ws.addRow(report.columns);
    ws.getRow(1).font = { name: 'Calibri', size: 11, bold: true };
    for (const row of sheet.rows) {
      ws.addRow(
        row.map((value, c) => {
          if (MIS_DATE_COLUMNS.has(c)) return value ? toDate(value) : null;
          if (c === age && /^\d+$/.test(value)) return Number(value);
          return value || null;
        }),
      );
    }
    report.columns.forEach((column, c) => {
      const col = ws.getColumn(c + 1);
      col.width = Math.min(40, Math.max(12, column.length * 0.6, ...sheet.rows.map((r) => (r[c] ?? '').length + 2)));
      if (MIS_DATE_COLUMNS.has(c)) col.numFmt = 'mm-dd-yyyy';
    });
  }
  const buffer = await book.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
