import type { FacultyEvaluationResultView } from '@/types/views';
import type { CsvRow } from '@/pages/reports/report-parts';

/** The Guidance Office's results as CSV: one row per class. Combined figures only. */
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
