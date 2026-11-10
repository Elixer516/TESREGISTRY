import type { MisReport } from '@/types/views';
import { MIS_DATE_COLUMNS } from '@/lib/mis';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import { Empty, ReportHeader, SectionTitle, type CsvRow } from './report-parts';

/**
 * The printed column plan, measured from the report on the page.
 *
 * Every column is given at least its longest word, so names, places, dates
 * and phone numbers never split mid-word, and the columns with long text (the
 * provider's name, addresses, e-mails) share some extra room so they wrap
 * onto a few lines instead of many. Words are measured once at a reference
 * size; text widths grow in step with type size, so the plan is then scaled
 * to the paper and the type size that makes it fit is the one printed.
 *
 * Headings hyphenate on paper ("Classifi-cation"), so a heading word counts
 * only its first letters. An e-mail address may break anywhere.
 */
const REFERENCE_PX = 10;
const HEADING_SCALE = 0.8; // matches .mis-sheet th in index.css
const HEADING_LETTERS = 6;
const CELL_EXTRA_PX = 3; // padding and border around each cell
const EXTRA_ROOM = 0.12; // share of the width given to the long columns

interface ColumnPlan {
  fontPt: number;
  /** Puts the widths on the tables; returns what takes them off again. */
  apply: () => () => void;
}

function planColumns(widthPx: number): ColumnPlan {
  const canvas = document.createElement('canvas').getContext('2d');
  const tables = [...document.querySelectorAll<HTMLTableElement>('.mis-sheet table')];
  if (!canvas || !tables.length) return { fontPt: 5.5, apply: () => () => undefined };
  const family = getComputedStyle(tables[0]).fontFamily;
  const measure = (text: string, weight: number, scale: number) => {
    canvas.font = `${weight} ${REFERENCE_PX * scale}px ${family}`;
    return canvas.measureText(text).width;
  };

  const plans = tables.map((table) => {
    const heads = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
    const least = heads.map((th) =>
      Math.max(
        ...(th.textContent ?? '')
          .split(/[\s/(]+/)
          .map((word) => measure(word.slice(0, HEADING_LETTERS), 700, HEADING_SCALE)),
      ),
    );
    const longest = least.map(() => 0);
    table.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, c) => {
        const text = td.textContent ?? '';
        // A hyphen breaks before a letter (Institution-|Based), never before a
        // digit, so phone numbers and dates stay whole.
        for (const word of text.split(/[\s/]+|(?<=-)(?=[A-Za-z])/)) {
          least[c] = Math.max(least[c], measure(word.includes('@') ? word.slice(0, 10) : word, 400, 1));
        }
        longest[c] = Math.max(longest[c], measure(text, 400, 1));
      });
    });
    // The extra room goes to whichever columns would otherwise wrap the most.
    const want = longest.map((w, c) => Math.max(0, Math.min(w, 220) - least[c]));
    const wanted = want.reduce((n, w) => n + w, 0) || 1;
    const extra = least.reduce((n, w) => n + w, 0) * EXTRA_ROOM;
    const widths = least.map((w, c) => w + (extra * want[c]) / wanted);
    return { heads, widths, total: widths.reduce((n, w) => n + w, 0) };
  });

  // One type size for the whole report: the most demanding diploma decides.
  const scale = Math.min(...plans.map((plan) => (widthPx - plan.heads.length * CELL_EXTRA_PX) / plan.total));
  const fontPx = Math.max(2.75 / 0.75, Math.min(7 / 0.75, REFERENCE_PX * scale * 0.97));
  const used = fontPx / REFERENCE_PX;

  return {
    fontPt: fontPx * 0.75,
    apply: () => {
      for (const plan of plans) {
        const px = plan.widths.map((w) => w * used + CELL_EXTRA_PX);
        const sum = px.reduce((n, w) => n + w, 0);
        plan.heads.forEach((th, c) => {
          th.style.width = `${((px[c] / sum) * 100).toFixed(3)}%`;
        });
      }
      return () => plans.forEach((plan) => plan.heads.forEach((th) => (th.style.width = '')));
    },
  };
}

/* ---------------- Print settings ---------------- */

export type MisOrientation = 'landscape' | 'portrait';
export const MIS_PAPERS = [
  { value: 'long', label: 'Long bond (8.5 × 13 in)', width: 8.5, height: 13 },
  {
    value: 'short',
    label: 'Short bond / Letter (8.5 × 11 in)',
    width: 8.5,
    height: 11,
  },
  { value: 'a4', label: 'A4 (8.27 × 11.69 in)', width: 8.27, height: 11.69 },
  { value: 'legal', label: 'Legal (8.5 × 14 in)', width: 8.5, height: 14 },
] as const;
export type MisPaper = (typeof MIS_PAPERS)[number]['value'];
export interface MisPrintSettings {
  orientation: MisOrientation;
  paper: MisPaper;
}
/** The centre's default: landscape on long bond. */
export const MIS_PRINT_DEFAULT: MisPrintSettings = {
  orientation: 'landscape',
  paper: 'long',
};

const MARGIN_IN = 0.3;

/**
 * Prints the MIS sheet on the paper and orientation chosen. The page size is
 * set for this one print (and removed after), so the other reports keep
 * theirs; the type is sized so all 39 columns fit across the paper.
 */
export function printMis(settings: MisPrintSettings): void {
  const paper = MIS_PAPERS.find((p) => p.value === settings.paper) ?? MIS_PAPERS[0];
  const [w, h] =
    settings.orientation === 'landscape' ? [paper.height, paper.width] : [paper.width, paper.height];
  const plan = planColumns((w - MARGIN_IN * 2) * 96);
  const font = plan.fontPt.toFixed(2);
  const undoWidths = plan.apply();
  const style = document.createElement('style');
  style.id = 'mis-print-page';
  style.textContent = `
    @page { size: ${w}in ${h}in; margin: ${MARGIN_IN}in; }
    @page mis { size: ${w}in ${h}in; margin: ${MARGIN_IN}in; }
    @media print { .mis-sheet { --mis-font: ${font}pt; } }
  `;
  document.getElementById('mis-print-page')?.remove();
  document.head.appendChild(style);
  const done = () => {
    style.remove();
    undoWidths();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

/**
 * The MIS report on screen: one table per diploma, every column of TESDA's
 * trainee profile sheet. It is wide on purpose — the format is fixed — so it
 * scrolls sideways here and prints landscape.
 */
export function MisReportSheet({ report }: { report: MisReport }) {
  const total = report.sheets.reduce((n, s) => n + s.rows.length, 0);
  const emailColumn = report.columns.findIndex((column) => column.startsWith('E-mail'));
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
        report.sheets.map((sheet) => {
          return (
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
                        <Th key={column} className="whitespace-normal align-middle text-center!">
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
                          <Td key={c} className={c === emailColumn ? 'mis-email' : undefined}>
                            {value}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </section>
          );
        })
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
 * Column widths as the centre's own workbook (DIPLOMA 2026 MIS) has them, in
 * Excel's units (about one "0" each). Every other column is 13.
 */
const EXCEL_WIDTHS: Record<string, number> = {
  'Name of Provider': 32.33,
  'Complete Address of Provider/Training Venue (For Mobile Training)': 24.66,
  'Qualification/Program Title': 27.78,
  'Delivery Mode': 17,
  'First Name': 16.22,
  'Emergency Person': 22.22,
};
const EXCEL_WIDTH = 13;
/** Centred in the centre's workbook; the rest sit as Excel puts them. */
const EXCEL_CENTRED = new Set(['Sex', 'Date of Birth (mm-dd-yyyy)', 'Age', 'Civil Status']);
const HEADER_HEIGHT = 59.25; // the workbook's own row heights, in points
const ROW_HEIGHT = 28.5;
const LINE_HEIGHT = 15; // one line of Calibri 11

/**
 * How many lines a wrapped cell takes in a column this wide. Excel does not
 * resize rows when a file opens, so the rows are made tall enough here and
 * no wrapped text is hidden. Capitals run wider than Excel's "0", hence 0.85.
 */
function linesIn(text: string, width: number, bold = false): number {
  const perLine = Math.max(1, Math.floor(width * (bold ? 0.8 : 0.85)));
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const length = word.length;
    if (used === 0) {
      lines += Math.floor((length - 1) / perLine);
      used = ((length - 1) % perLine) + 1;
    } else if (used + 1 + length <= perLine) {
      used += 1 + length;
    } else {
      lines += 1 + Math.floor((length - 1) / perLine);
      used = ((length - 1) % perLine) + 1;
    }
  }
  return lines;
}

/**
 * The workbook in the centre's format, a sheet per diploma named by its code:
 * the header row bold, wrapped and centred; every cell wrapped, so nothing
 * runs into the next column; the same column widths and row heights; dates as
 * real dates (mm/dd/yyyy) in columns wide enough that Excel never shows "###";
 * ages as numbers. ExcelJS loads only when someone exports.
 */
export async function downloadMisExcel(report: MisReport, fileName: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const book = new ExcelJS.Workbook();
  book.creator = 'RegiStream';
  book.created = new Date();
  const age = report.columns.indexOf('Age');
  const widths = report.columns.map((column) => EXCEL_WIDTHS[column] ?? EXCEL_WIDTH);
  const sheets = report.sheets.length
    ? report.sheets
    : [
        {
          programId: '',
          programCode: 'MIS',
          programName: '',
          rows: [] as string[][],
        },
      ];
  const used = new Set<string>();
  for (const sheet of sheets) {
    let name = sheet.programCode.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet';
    while (used.has(name)) name = `${name.slice(0, 28)} ${used.size}`;
    used.add(name);
    const ws = book.addWorksheet(name, {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });

    report.columns.forEach((column, c) => {
      const col = ws.getColumn(c + 1);
      col.width = widths[c];
      col.font = { name: 'Calibri', size: 11 };
      col.alignment = {
        wrapText: true,
        ...(EXCEL_CENTRED.has(column) ? { horizontal: 'center' as const } : {}),
      };
      if (MIS_DATE_COLUMNS.has(c)) col.numFmt = 'mm/dd/yyyy';
    });

    const header = ws.addRow(report.columns);
    header.font = { name: 'Calibri', size: 11, bold: true };
    header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    header.height = Math.max(
      HEADER_HEIGHT,
      ...report.columns.map((column, c) => linesIn(column, widths[c], true) * LINE_HEIGHT),
    );

    for (const row of sheet.rows) {
      const added = ws.addRow(
        row.map((value, c) => {
          if (MIS_DATE_COLUMNS.has(c)) return value ? toDate(value) : null;
          if (c === age && /^\d+$/.test(value)) return Number(value);
          return value || null;
        }),
      );
      added.height = Math.max(
        ROW_HEIGHT,
        ...row.map((value, c) =>
          MIS_DATE_COLUMNS.has(c) ? LINE_HEIGHT : linesIn(value ?? '', widths[c]) * LINE_HEIGHT,
        ),
      );
    }
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
