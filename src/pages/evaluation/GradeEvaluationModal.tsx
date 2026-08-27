/**
 * The Grade Evaluation Form, on screen and on paper.
 *
 * Laid out after the centre's reference form: a title block with a reference
 * number and run date, a trainee block, then one table per semester with a
 * units summary beneath it, and the grading-system note and disclaimer at the
 * foot. The reference is the centre's own — KorPhil's logo and wording, not
 * the sample's.
 *
 * Everything from First Year, First Semester to the present, with the
 * prerequisite each subject required. It generates whether or not every
 * grading sheet is in — an incomplete evaluation is often the thing the
 * registrar actually needs — and says plainly how many subjects are still
 * ungraded rather than leaving blanks to be misread.
 */

import { useQuery } from '@tanstack/react-query';
import type { GradeEvaluationUnits } from '@/types/views';
import type { StudentView } from '@/types/views';
import { evaluationApi } from '@/api';
import { formatDateTime } from '@/lib/format';
import { INSTITUTION } from '@/config/institution';
import { Badge, Button, InfoNote, Modal, Table, TableWrap, Td, Th } from '@/components/ui';
import { QueryState } from '@/components/states';
import korphilLogo from '@/assets/korphil-logo.png';

export function GradeEvaluationModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const form = useQuery({
    queryKey: ['grade-evaluation', student?.id],
    queryFn: () => evaluationApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const data = form.data;

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title="Grade Evaluation Form"
      description={student ? `${student.fullName} · ${student.studentNumber}` : undefined}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled={!data} onClick={() => window.print()}>
            Print
          </Button>
        </>
      }
    >
      <QueryState
        isLoading={form.isLoading}
        error={form.error}
        isEmpty={Boolean(data && data.groups.length === 0)}
        onRetry={() => form.refetch()}
        loadingLabel="Compiling the evaluation…"
        emptyTitle="No enrollments on record"
        emptyHint="A Grade Evaluation Form is built from enrolled subjects. Enroll this trainee first."
      >
        {data ? (
          <div className="print-sheet space-y-4">
            {/* ---- Title block ---- */}
            <div className="flex items-start gap-3 border-b border-line pb-3">
              <img
                src={korphilLogo}
                alt=""
                aria-hidden
                className="h-12 w-12 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase text-ink-700">
                  {INSTITUTION.agency}
                </p>
                <p className="text-xs text-ink-500">{INSTITUTION.centre}</p>
                <p className="mt-1 text-base font-bold tracking-wide text-ink-900">
                  GRADE EVALUATION FORM
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-ink-500">
                <p className="font-mono font-semibold text-ink-700">
                  REF#: {data.referenceNumber}
                </p>
                <p>Run date: {formatDateTime(data.generatedAt)}</p>
              </div>
            </div>

            {/* ---- Trainee block ---- */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line bg-surface-2 p-3 text-sm sm:grid-cols-3">
              <Item label="Trainee's name" value={data.student.lastFirstName} wide />
              <Item label="Student no." value={data.student.studentNumber} />
              <Item
                label="Diploma / Year"
                value={`${data.student.programCode} / Year ${data.student.yearLevel}`}
              />
              <Item label="Sex" value={data.student.sex === 'MALE' ? 'Male' : 'Female'} />
              <Item label="Nationality" value={data.student.nationality || '—'} />
              <Item
                label="School year"
                value={data.groups[0]?.academicYearLabel ?? '—'}
              />
            </dl>

            {data.ungradedCount > 0 ? (
              <InfoNote tone="warning" title="This evaluation is not complete">
                {data.ungradedCount} subject{data.ungradedCount === 1 ? '' : 's'} still
                {data.ungradedCount === 1 ? ' has' : ' have'} no grade — the trainer has not
                submitted, or the Registrar has not approved, the grading sheet.
              </InfoNote>
            ) : null}

            {/* ---- One block per semester ---- */}
            {data.groups.map((group) => (
              <section key={group.semesterId} className="break-inside-avoid">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">
                    {group.label}
                    <span className="ml-2 text-xs font-normal text-ink-500">
                      {group.academicYearLabel}
                    </span>
                  </h3>
                  {group.hasUnresolvedInc ? (
                    <Badge tone="warning">Unresolved INC</Badge>
                  ) : null}
                </div>

                <TableWrap>
                  <Table className="min-w-[46rem]">
                    <thead>
                      <tr>
                        <Th>Subjects</Th>
                        <Th>Sections</Th>
                        <Th className="text-right">Grades</Th>
                        <Th className="text-right">Units</Th>
                        <Th className="text-right">Completion</Th>
                        <Th>Pre-requisite</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.enrollmentSubjectId}>
                          <Td>
                            <span className="block font-medium text-ink-900">
                              {row.courseCode}
                            </span>
                            <span className="block text-[11px] text-ink-500">
                              {row.courseTitle}
                            </span>
                          </Td>
                          <Td className="text-xs text-ink-500">{row.sectionCode}</Td>
                          <Td className="text-right tabular-nums">
                            {row.grade ? (
                              row.isPassed === false ? (
                                <span className="font-semibold text-danger-ink">{row.grade}</span>
                              ) : (
                                <span className="font-medium text-ink-900">{row.grade}</span>
                              )
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </Td>
                          <Td className="text-right tabular-nums">{row.units}</Td>
                          {/* Blank unless the grade is INC — filled once resolved. */}
                          <Td className="text-right tabular-nums text-ink-500">
                            {row.completionGrade ?? ''}
                          </Td>
                          <Td className="text-xs text-ink-500">{row.prerequisites || '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>

                <UnitsSummary units={group.units} average={group.gwa} label="Semester ave." />
              </section>
            ))}

            {/* ---- Overall ---- */}
            <div className="rounded-lg border-2 border-line bg-surface-2 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-700">
                Overall
              </p>
              <UnitsSummary
                units={data.units}
                average={data.overallGwa}
                label="General weighted average"
              />
            </div>

            {/* ---- Footnotes ---- */}
            <div className="space-y-2 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-500">
              <p>
                <span className="font-semibold text-ink-700">Grading system: </span>
                1.00 is the highest grade and 3.00 the passing mark, equivalent to 75%. A grade
                below 3.00 on the scale is a failure and earns no credit. INC means the
                requirements were not completed; the resolving grade appears under Completion
                once it is settled, and the average reads 0.000 until then.
              </p>
              <p>
                <span className="font-semibold text-ink-700">Disclaimer: </span>
                This form is generated from the records held by the Office of the Registrar of{' '}
                {INSTITUTION.centre} and reflects them as they stand on the run date above. It is
                provided for the trainee's information and does not substitute, modify or amend
                any part of the official record. The records of the Office of the Registrar
                prevail over any entry here and remain the sole basis for evaluating credentials,
                subjects or credits, academic performance and eligibility for graduation.
              </p>
            </div>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}

function Item({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-1' : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

/** The sample form's four buckets, plus the average they produce. */
function UnitsSummary({
  units,
  average,
  label,
}: {
  units: GradeEvaluationUnits;
  average: string;
  label: string;
}) {
  const cells: Array<[string, string | number]> = [
    ['Enrolled', units.enrolled],
    ['Considered', units.considered],
    ['Passed', units.passed],
    ['No credit', units.noCredit],
    [label, average],
  ];
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-xs">
      {cells.map(([name, value]) => (
        <div key={name} className="flex items-baseline gap-1.5">
          <dt className="uppercase tracking-wide text-ink-500">{name}</dt>
          <dd className="font-semibold tabular-nums text-ink-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
