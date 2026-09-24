import type { SummaryReport } from '@/types/views';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import {
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
 * One page for management. Every figure comes from the four detailed
 * reports, so a question about any number here is answered by opening the
 * tab it came from.
 */
export function SummaryReportSheet({ report }: { report: SummaryReport }) {
  const e = report.enrollment;
  const a = report.academic;
  const largest = Math.max(1, ...report.byDiploma.map((d) => d.enrolled));

  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader
        title="Statistical Summary"
        subtitle={`School Year ${report.schoolYearLabel} · ${report.programLabel}`}
        generatedAt={report.generatedAt}
      />

      <section className="break-inside-avoid">
        <SectionTitle>Enrollment</SectionTitle>
        <Figures>
          <Figure label="Trainees enrolled" value={e.trainees} hint={`${e.male} male · ${e.female} female`} />
          <Figure label="New trainees" value={e.newTrainees} hint={`${e.continuing} continuing`} />
          <Figure
            label="Applications"
            value={report.applications.received}
            hint={`Feb–Jan cycle · ${report.applications.approved} approved · ${report.applications.pending} pending`}
          />
          <Figure label="Units carried" value={e.units} />
        </Figures>
      </section>

      <section className="break-inside-avoid">
        <SectionTitle>Academic performance</SectionTitle>
        <Figures>
          <Figure label="Pass rate" value={pct(a.passRate)} hint={`${a.passed} of ${a.graded} subjects`} />
          <Figure label="Average GWA" value={a.averageGwa ?? '—'} hint="1.00 is best" />
          <Figure label="INC open" value={a.incomplete} hint={`${a.ungraded} subjects not yet graded`} />
          <Figure
            label="Below the 79% line"
            value={a.forReview + a.recommendedDrop}
            hint={`${a.recommendedDrop} for drop · ${a.forReview} for review`}
          />
        </Figures>
      </section>

      <section className="break-inside-avoid">
        <SectionTitle>Retention, departures and completion</SectionTitle>
        <Figures>
          <Figure
            label="Retention rate"
            value={pct(report.retention.retentionRate)}
            hint={`${report.retention.continued} continued · ${report.retention.awaiting} awaiting`}
          />
          <Figure
            label="Departures"
            value={report.departures.total}
            hint={`${report.departures.centreInitiated} centre · ${report.departures.traineeInitiated} trainee`}
          />
          <Figure label="Completed diploma" value={report.completed} hint="Eligible for graduation" />
          <Figure
            label="Capacity"
            value={report.capacity.classes}
            hint={`classes · ${report.capacity.sections} sections · ${report.capacity.trainers} trainers · ${report.capacity.diplomas} diplomas`}
          />
        </Figures>
      </section>

      <section className="break-inside-avoid">
        <SectionTitle>By diploma</SectionTitle>
        {report.byDiploma.length === 0 ? (
          <p className="text-sm text-ink-500">Nobody is enrolled this school year.</p>
        ) : (
          <>
            {/* Bars first: the proportion at a glance, before the figures. */}
            <div className="mb-3 space-y-1">
              {report.byDiploma.map((d) => (
                <div key={d.programId} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 font-semibold text-ink-900">{d.code}</span>
                  {/* SVG, not a coloured div: browsers drop background
                      colours when printing, and the bars went with them. */}
                  <svg className="h-3 flex-1" aria-hidden preserveAspectRatio="none" viewBox="0 0 100 10">
                    <rect x="0" y="0" width="100" height="10" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="0.3" />
                    <rect x="0" y="0" width={(d.enrolled / largest) * 100} height="10" fill="var(--brand)" />
                  </svg>
                  <span className="w-10 shrink-0 text-right tabular-nums text-ink-700">{d.enrolled}</span>
                </div>
              ))}
            </div>
            <TableWrap>
              <Table className="min-w-[44rem] text-xs">
                <thead>
                  <tr>
                    <Th>Diploma</Th>
                    <Th className="text-right">Enrolled</Th>
                    <Th className="text-right">M</Th>
                    <Th className="text-right">F</Th>
                    <Th className="text-right">Pass rate</Th>
                    <Th className="text-right">Avg GWA</Th>
                    <Th className="text-right">Retention</Th>
                    <Th className="text-right">Left</Th>
                    <Th className="text-right">Completed</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDiploma.map((d) => (
                    <tr key={d.programId}>
                      <Td>
                        <span className="block font-semibold text-ink-900">{d.code}</span>
                        <span className="block text-[11px] text-ink-500">{d.name}</span>
                      </Td>
                      <Num value={d.enrolled} strong />
                      <Num value={d.male} />
                      <Num value={d.female} />
                      <Num value={pct(d.passRate)} />
                      <Num value={d.averageGwa ?? '—'} />
                      <Num value={pct(d.retentionRate)} />
                      <Num value={d.departed} />
                      <Num value={d.completed} />
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}
      </section>

      <ReportSignatures />
    </div>
  );
}

export function summaryCsv(report: SummaryReport): CsvRow[] {
  const e = report.enrollment;
  const a = report.academic;
  return [
    ['Statistical Summary'],
    ['School year', report.schoolYearLabel],
    ['Diploma', report.programLabel],
    ['Generated', report.generatedAt],
    [],
    ['Trainees enrolled', e.trainees],
    ['Male', e.male],
    ['Female', e.female],
    ['New trainees', e.newTrainees],
    ['Continuing', e.continuing],
    ['Units carried', e.units],
    ['Applications received', report.applications.received],
    ['Applications approved', report.applications.approved],
    ['Applications pending', report.applications.pending],
    ['Applications rejected', report.applications.rejected],
    ['Pass rate %', a.passRate],
    ['Average GWA', a.averageGwa],
    ['INC open', a.incomplete],
    ['For review (76-79%)', a.forReview],
    ['Recommended for drop (75% and below)', a.recommendedDrop],
    ['Retention rate %', report.retention.retentionRate],
    ['Departures', report.departures.total],
    ['Departures initiated by the centre', report.departures.centreInitiated],
    ['Departures initiated by the trainee', report.departures.traineeInitiated],
    ['Completed diploma', report.completed],
    ['Published classes', report.capacity.classes],
    ['Sections', report.capacity.sections],
    ['Trainers', report.capacity.trainers],
    ['Diplomas', report.capacity.diplomas],
    [],
    ['BY DIPLOMA'],
    ['Code', 'Diploma', 'Enrolled', 'Male', 'Female', 'Pass rate %', 'Avg GWA', 'Retention %', 'Left', 'Completed'],
    ...report.byDiploma.map((d) => [
      d.code, d.name, d.enrolled, d.male, d.female, d.passRate, d.averageGwa, d.retentionRate, d.departed, d.completed,
    ]),
  ];
}
