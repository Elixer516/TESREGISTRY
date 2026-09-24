/**
 * The Grade Evaluation Form, on screen and on paper.
 *
 * Rendered straight onto the page rather than behind a "Generate form"
 * button. There was nothing to generate — the evaluation is derived from
 * enrolments that already exist, so the click only stood between the
 * registrar and the thing they came to look at.
 *
 * It keeps the `print-sheet` marker, which is what the print stylesheet
 * isolates: printing this page puts this form on the paper and nothing else,
 * no sidebar, no page header, no INC panel.
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
import type { StudentView } from '@/types/views';
import { evaluationApi } from '@/api';
import { formatDateTime, signatureName } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { INSTITUTION, SIGNATORIES } from '@/config/institution';
import { GRADE_POINTS } from '@/server/services/grade-rules';
import type { GradePoint } from '@/server/services/grade-rules';
import { ALL_GRADE_MARKERS, GRADE_MARKER_LABELS } from '@/types';
import { InfoNote, Table, TableWrap, Td, Th } from '@/components/ui';
import { QueryState } from '@/components/states';
import korphilLogo from '@/assets/korphil-logo.png';

export function GradeEvaluationSheet({ student }: { student: StudentView | null }) {
  const { user } = useAuth();
  const form = useQuery({
    queryKey: ['grade-evaluation', student?.id],
    queryFn: () => evaluationApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const data = form.data;
  // Every date line carries the day the form was generated for printing, so
  // nobody has to write it in by hand.
  const signedOn = data ? formatSignDate(data.generatedAt) : '';
  // Processed by is whoever is signed in and printing it — the Registrar
  // themselves, or the trainee on their own portal, in which case the
  // centre's registrar still processes it.
  const processor =
    user && user.role !== 'TRAINEE'
      ? { name: signatureName(user), title: user.position }
      : { name: SIGNATORIES.registrarName, title: SIGNATORIES.registrarTitle };

  return (
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
          <div className="print-sheet gef-sheet space-y-4">
            {/* ---- Title block ---- */}
            <div className="flex items-start gap-3 border-b border-line pb-3">
              <img
                src={korphilLogo}
                alt=""
                aria-hidden
                className="h-12 w-12 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-xs font-semibold uppercase text-ink-700">
                  {INSTITUTION.agency}
                </p>
                <p className="text-xs text-ink-500">{INSTITUTION.centre}</p>
                <p className="mt-1 text-base font-bold tracking-wide text-ink-900">
                  DIPLOMA GRADE EVALUATION
                </p>
              </div>
              <div className="shrink-0 text-right text-[11px] text-ink-500">
                <p className="font-mono font-semibold text-ink-700">
                  REF#: {data.referenceNumber}
                </p>
                <p>Run date: {formatDateTime(data.generatedAt)}</p>
              </div>
            </div>

            {/* ---- Trainee block, in the centre's own four fields ---- */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Ruled label="Name" value={data.student.lastFirstName} />
              <Ruled label="Section" value={data.sectionLabel} />
              <Ruled label="Diploma" value={data.student.programName} />
              <Ruled label="Batch" value={data.batchLabel} />
            </dl>

            {data.ungradedCount > 0 ? (
              <InfoNote tone="warning" title="This evaluation is not complete">
                {data.ungradedCount} subject{data.ungradedCount === 1 ? '' : 's'} still
                {data.ungradedCount === 1 ? ' has' : ' have'} no grade — the trainer has not
                submitted, or the Registrar has not approved, the grading sheet.
              </InfoNote>
            ) : null}

            {/* The rule most often mistaken for a bug, said once and up front:
                a 0.000 below is a withheld average, not a computed one. */}
            {data.groups.some((g) => g.hasUnresolvedInc) ? (
              <InfoNote tone="warning" title="Weighted averages are withheld">
                This trainee has an unresolved INC. While any INC stands, the semester
                and general weighted averages are reported as <strong>0.000</strong>{' '}
                rather than calculated — an average that left out unfinished work would
                overstate their standing. Both compute normally once the INC is resolved.
              </InfoNote>
            ) : null}

            {/* ---- One block per semester ---- */}
            {data.groups.map((group) => (
              <section key={group.semesterId}>
                <TableWrap>
                  <Table className="gef-terms min-w-[60rem] text-xs">
                    <thead>
                      <tr>
                        <Th className="w-24">Subject Code</Th>
                        <Th>Description</Th>
                        <Th className="w-14 text-right">Units</Th>
                        <Th className="w-28">Trainer</Th>
                        <Th className="w-40">Pre Req Subjects</Th>
                        <Th className="w-20 text-right">Percentage</Th>
                        <Th className="w-20 text-right">Grades</Th>
                        <Th className="w-24">Remarks</Th>
                        <Th className="w-24 text-right">Completion of Grade</Th>
                        <Th className="w-24">Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* The centre prints the term and its coverage as a band
                          across the table rather than as a heading above it. */}
                      <tr>
                        <Td colSpan={10} className="bg-surface-2 font-semibold text-ink-900">
                          {group.label} {group.academicYearLabel} {group.coverage}
                          {/* The registrar's view of the trainee's
                              confirmation. Screen only — the paper form
                              is the centre's, and carries no such line. */}
                          {group.gradesViewedAt ? (
                            <span className="no-print ml-2 font-normal text-success-ink">
                              · Viewed by trainee {formatDateTime(group.gradesViewedAt)}
                            </span>
                          ) : group.gradesViewPending ? (
                            <span className="no-print ml-2 font-normal text-warning-ink">
                              · Trainee has not confirmed viewing these grades
                            </span>
                          ) : null}
                        </Td>
                      </tr>

                      {group.rows.map((row) => (
                        <tr key={row.enrollmentSubjectId}>
                          <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                          <Td>{row.courseTitle}</Td>
                          <Td className="text-right tabular-nums">
                            {row.units.toFixed(1)}
                          </Td>
                          <Td className="text-ink-700">{row.trainerName}</Td>
                          <Td className="text-ink-500">{row.prerequisites}</Td>
                          {/* The percentage is what the trainer entered; the
                              grade beside it is its transmutation. */}
                          <Td className="text-right tabular-nums text-ink-700">
                            {row.percentage}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {row.grade ? (
                              <span
                                className={
                                  row.isPassed === false
                                    ? 'font-semibold text-danger-ink'
                                    : 'font-medium text-ink-900'
                                }
                                title={
                                  row.excludedFromGwa
                                    ? 'Counted toward units; excluded from the weighted average'
                                    : undefined
                                }
                              >
                                {row.grade}
                                {row.excludedFromGwa ? '*' : ''}
                              </span>
                            ) : null}
                          </Td>
                          <Td className="uppercase text-ink-700">{row.remarks}</Td>
                          <Td className="text-right tabular-nums text-ink-700">
                            {row.completionGrade ?? ''}
                          </Td>
                          <Td className="uppercase text-ink-700">{row.status}</Td>
                        </tr>
                      ))}

                      {/* A term still running has no average to report; what
                          the centre prints there instead is its unit load. */}
                      {/* Every term reports its unit load; a finished one
                          also reports its average. A term still running has
                          no average worth printing. */}
                      <tr>
                        <Td colSpan={2} className="text-right font-semibold text-ink-900">
                          TOTAL UNITS {group.inProgress ? 'ENROLLED' : 'EARNED'}
                        </Td>
                        <Td className="text-right font-bold tabular-nums text-ink-900">
                          {group.totalUnits.toFixed(1)}
                        </Td>
                        <Td colSpan={3} className="text-right font-semibold text-ink-900">
                          {group.inProgress ? '' : 'GENERAL WEIGHTED AVERAGE'}
                        </Td>
                        <Td className="text-right font-bold tabular-nums text-ink-900">
                          {group.inProgress ? '' : group.gwa}
                        </Td>
                        <Td colSpan={3} className="text-[10px] text-warning-ink">
                          {!group.inProgress && group.hasUnresolvedInc
                            ? 'Withheld — unresolved INC'
                            : ''}
                        </Td>
                      </tr>
                      {group.rows.some((r) => r.excludedFromGwa) ? (
                        <tr>
                          <Td colSpan={10} className="text-[10px] text-ink-500">
                            NSTP and PE count toward the units above, but their
                            grades are excluded from the weighted average.
                          </Td>
                        </tr>
                      ) : null}
                    </tbody>
                  </Table>
                </TableWrap>
              </section>
            ))}

            {/* ---- Grading system, as the centre prints it ---- */}
            <div className="break-inside-avoid border-t border-line pt-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-ink-700">
                Grading System
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <GradeLegend points={GRADE_POINTS.slice(0, 5)} />
                <GradeLegend points={GRADE_POINTS.slice(5)} />
                <div>
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="text-left text-ink-500">
                        <th className="border border-line px-1 py-0.5">Rating</th>
                        <th className="border border-line px-1 py-0.5">Equivalent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ALL_GRADE_MARKERS.filter((m) => m !== 'NG').map((marker) => (
                        <tr key={marker}>
                          <td className="border border-line px-1 py-0.5 font-medium text-ink-900">
                            {marker}
                          </td>
                          <td className="border border-line px-1 py-0.5 text-ink-700">
                            {GRADE_MARKER_LABELS[marker]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-[10px] text-ink-500">
                    <span className="font-semibold text-ink-700">Remarks: </span>
                    1.00–3.00 / 75–100% PASSED · 5.00 / below 60% FAILED
                  </p>
                </div>
              </div>
            </div>

            {/* ---- Signatures ---- */}
            <div className="grid gap-6 break-inside-avoid pt-2 text-[11px] sm:grid-cols-3">
              <SignLine
                caption="Processed by"
                name={processor.name}
                title={processor.title}
                date={signedOn}
              />
              <SignLine
                caption="Received by"
                name={data.student.lastFirstName}
                title="Trainee"
                date={signedOn}
              />
              <SignLine
                caption="Approved by"
                name={SIGNATORIES.approverName}
                title={SIGNATORIES.approverTitle}
                date={signedOn}
              />
            </div>

            <p className="text-right text-[10px] italic text-ink-500">
              Basis: TC No. 021 s. 2023
            </p>

            <p className="border-t border-line pt-2 text-[10px] leading-relaxed text-ink-500">
              <span className="font-semibold text-ink-700">Disclaimer: </span>
              This form is generated from the records held by the Office of the Registrar of{' '}
              {INSTITUTION.centre} and reflects them as they stand on the run date above. It is
              provided for the trainee's information and does not substitute, modify or amend
              any part of the official record. The records of the Office of the Registrar
              prevail over any entry here and remain the sole basis for evaluating credentials,
              subjects or credits, academic performance and eligibility for graduation.
            </p>
          </div>
      ) : null}
    </QueryState>
  );
}

/** A labelled field written on a rule, the way the paper form is laid out. */
function Ruled({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {label}:
      </dt>
      <dd className="min-w-0 flex-1 border-b border-ink-400 text-sm font-medium text-ink-900">
        {value}
      </dd>
    </div>
  );
}

/** One half of the grading-system legend. */
function GradeLegend({ points }: { points: readonly GradePoint[] }) {
  return (
    <table className="w-full border-collapse text-[10px]">
      <thead>
        <tr className="text-left text-ink-500">
          <th className="border border-line px-1 py-0.5">Rating</th>
          <th className="border border-line px-1 py-0.5">Numerical</th>
          <th className="border border-line px-1 py-0.5">Equivalent</th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.value}>
            <td className="border border-line px-1 py-0.5 tabular-nums font-medium text-ink-900">
              {point.value}
            </td>
            <td className="border border-line px-1 py-0.5 tabular-nums text-ink-700">
              {point.percentage}
            </td>
            <td className="border border-line px-1 py-0.5 text-ink-700">
              {point.descriptor}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A signature rule, with the date line the centre's form carries. */
function SignLine({
  caption,
  name,
  title,
  date,
}: {
  caption: string;
  name: string;
  title?: string;
  date: string;
}) {
  return (
    <div>
      <p className="text-ink-500">{caption}:</p>
      <p className="mt-5 border-t border-ink-900 pt-1 font-semibold uppercase text-ink-900">
        {name}
      </p>
      {title ? <p className="text-ink-500">{title}</p> : null}
      <p className="mt-2 font-medium text-ink-900">{date}</p>
      <p className="border-t border-ink-400 pt-0.5 text-ink-500">Date</p>
    </div>
  );
}

/** "September 24, 2026" — written out, as a date on a signed form is. */
function formatSignDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
