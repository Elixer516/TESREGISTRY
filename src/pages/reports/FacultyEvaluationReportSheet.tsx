import type { FacultyEvaluationResultView } from '@/types/views';
import { ratingLabel } from '@/lib/faculty-evaluation-form';
import { Table, TableWrap, Td, Th } from '@/components/ui';
import { EvaluationResultCard } from '@/components/EvaluationResultCard';
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
 * Faculty evaluation results, held by the Registrar until the Guidance
 * office takes the surveys over. A summary line per trainer, then each class
 * in full. Combined figures and comments only — never who said what.
 */
export function FacultyEvaluationReportSheet({
  results,
  subtitle,
}: {
  results: FacultyEvaluationResultView[];
  subtitle: string;
}) {
  const responses = results.reduce((sum, r) => sum + r.respondents, 0);
  const eligible = results.reduce((sum, r) => sum + r.eligible, 0);
  const rated = results.filter((r) => r.overall !== null);
  const mean = rated.length ? rated.reduce((sum, r) => sum + (r.overall ?? 0), 0) / rated.length : null;

  const byTrainer = new Map<string, { name: string; classes: number; responses: number; total: number }>();
  for (const r of results) {
    const row = byTrainer.get(r.facultyId) ?? { name: r.trainerName, classes: 0, responses: 0, total: 0 };
    row.classes += 1;
    row.responses += r.respondents;
    row.total += (r.overall ?? 0) * r.respondents;
    byTrainer.set(r.facultyId, row);
  }
  const trainers = [...byTrainer.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="print-sheet report-sheet space-y-5">
      <ReportHeader title="Faculty Evaluation Report" subtitle={subtitle} generatedAt={new Date().toISOString()} />

      <Figures>
        <Figure label="Classes evaluated" value={results.length} />
        <Figure label="Responses" value={responses} hint={`of ${eligible} trainees who could answer`} />
        <Figure label="Response rate" value={eligible ? `${Math.round((responses / eligible) * 100)}%` : '—'} />
        <Figure
          label="Average rating"
          value={mean !== null ? mean.toFixed(2) : '—'}
          hint={mean !== null ? ratingLabel(mean) : 'No answers yet'}
        />
      </Figures>

      {results.length === 0 ? (
        <Empty>No faculty evaluations for this selection.</Empty>
      ) : (
        <>
          <section className="break-inside-avoid">
            <SectionTitle note="Weighted by the number of answers each class received. 5 = Strongly Agree.">
              By trainer
            </SectionTitle>
            <TableWrap>
              <Table className="min-w-[32rem] text-sm">
                <thead>
                  <tr>
                    <Th>Trainer</Th>
                    <Th className="text-right">Classes</Th>
                    <Th className="text-right">Responses</Th>
                    <Th className="text-right">Average</Th>
                    <Th>Rating</Th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((t) => {
                    const avg = t.responses ? t.total / t.responses : null;
                    return (
                      <tr key={t.name}>
                        <Td className="font-medium text-ink-900">{t.name}</Td>
                        <Num value={t.classes} />
                        <Num value={t.responses} />
                        <Num value={avg !== null ? avg.toFixed(2) : '—'} strong />
                        <Td className="text-ink-700">{avg !== null ? ratingLabel(avg) : '—'}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </section>

          <section>
            <SectionTitle>By class</SectionTitle>
            <div className="grid gap-3 lg:grid-cols-2">
              {results.map((r) => (
                <EvaluationResultCard key={r.classScheduleId} result={r} showTrainer />
              ))}
            </div>
          </section>
        </>
      )}

      <ReportSignatures />
    </div>
  );
}

export function facultyEvaluationCsv(results: FacultyEvaluationResultView[]): CsvRow[] {
  const areaTitles = results[0]?.areas.map((a) => `${a.id}. ${a.title}`) ?? [];
  return [
    ['Faculty Evaluation Report'],
    [],
    ['Trainer', 'Diploma', 'Subject code', 'Subject', 'Section', 'School year', 'Term', 'Responses', 'Could answer', ...areaTitles, 'Overall', 'Rating'],
    ...results.map((r) => [
      r.trainerName, r.programCode, r.subjectCode, r.subjectTitle, r.sectionCode, r.academicYearLabel, r.termLabel,
      r.respondents, r.eligible, ...r.areas.map((a) => a.average), r.overall, r.overallLabel,
    ]),
    [],
    ['COMMENTS'],
    ['Trainer', 'Subject code', 'Question', 'Comment'],
    ...results.flatMap((r) =>
      r.comments.flatMap((c) => c.answers.map((answer) => [r.trainerName, r.subjectCode, c.question, answer])),
    ),
  ];
}
