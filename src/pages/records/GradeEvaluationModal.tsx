/**
 * The Grade Evaluation Form, on screen and on paper.
 *
 * Everything from First Year, First Semester to the present, grouped by
 * semester, with the prerequisite each subject required. It generates whether
 * or not every grading sheet is in — an incomplete evaluation is often the
 * thing the registrar actually needs — and says plainly how many subjects are
 * still unrated rather than leaving blanks to be misread.
 */

import { useQuery } from '@tanstack/react-query';
import { recordsApi } from '@/api';
import { formatDateTime } from '@/lib/format';
import { INSTITUTION } from '@/config/institution';
import type { StudentView } from '@/types/views';
import {
  Badge,
  Button,
  DescriptionItem,
  InfoNote,
  Modal,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { QueryState } from '@/components/states';

export function GradeEvaluationModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const form = useQuery({
    queryKey: ['grade-evaluation', student?.id],
    queryFn: () => recordsApi.gradeEvaluation(student?.id ?? ''),
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
            {/* Only shows on paper — the modal header already says this on screen. */}
            <div className="hidden print:block">
              <p className="text-center text-sm font-semibold">{INSTITUTION.agency}</p>
              <p className="text-center text-xs">{INSTITUTION.centre}</p>
              <p className="mt-2 text-center text-base font-semibold">
                GRADE EVALUATION FORM
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-surface-2 p-4 sm:grid-cols-4">
              <DescriptionItem label="Trainee">{data.student.fullName}</DescriptionItem>
              <DescriptionItem label="Student No.">{data.student.studentNumber}</DescriptionItem>
              <DescriptionItem label="Course">
                {data.student.programCode} — {data.student.programName}
              </DescriptionItem>
              <DescriptionItem label="Year level">{data.student.yearLevel}</DescriptionItem>
            </dl>

            {data.ungradedCount > 0 ? (
              <InfoNote tone="warning" title="This evaluation is not complete">
                {data.ungradedCount} subject{data.ungradedCount === 1 ? '' : 's'} still
                {data.ungradedCount === 1 ? ' has' : ' have'} no grade — the trainer has not
                submitted, or the Registrar has not approved, the grading sheet. Those rows are
                blank below.
              </InfoNote>
            ) : null}

            {data.hasUnresolvedInc ? (
              <InfoNote tone="warning" title="Unresolved INC">
                A general weighted average of 0.000 on a semester below means an INC is still
                outstanding for it — not that the average is zero.
              </InfoNote>
            ) : null}

            {data.groups.map((group) => {
              // A semester where nothing is graded yet would otherwise read
              // "GWA 0.000", which looks like a failing average rather than
              // an absent one.
              const noneGraded = group.rows.every((row) => row.grade === null);
              return (
              <section key={group.semesterId}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink-900">
                    {group.label}
                    <span className="ml-2 text-xs font-normal text-ink-500">
                      {group.academicYearLabel}
                    </span>
                  </h3>
                  <span className="text-xs text-ink-500">
                    {group.totalUnits} units ·{' '}
                    {noneGraded ? 'not yet graded' : `GWA ${group.gwa}`}
                  </span>
                </div>
                <TableWrap>
                  <Table className="min-w-[46rem]">
                    <thead>
                      <tr>
                        <Th>Course Code</Th>
                        <Th>Course Title</Th>
                        <Th className="text-right">Units</Th>
                        <Th className="text-right">Grade</Th>
                        <Th className="text-right">Completion</Th>
                        <Th>Pre-requisite</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.courseCode}>
                          <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                          <Td>
                            <span className="block">{row.courseTitle}</span>
                            <span className="block text-[11px] text-ink-500">{row.remarks}</span>
                          </Td>
                          <Td className="text-right tabular-nums">{row.units}</Td>
                          <Td className="text-right tabular-nums">
                            {row.grade ? (
                              row.isPassed === false ? (
                                <span className="font-semibold text-danger-ink">{row.grade}</span>
                              ) : (
                                row.grade
                              )
                            ) : (
                              <span className="text-ink-400">—</span>
                            )}
                          </Td>
                          <Td className="text-right tabular-nums">
                            {row.completionGrade ?? <span className="text-ink-400">—</span>}
                          </Td>
                          <Td className="text-xs text-ink-500">{row.prerequisites || '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </section>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
              <div className="text-sm">
                <p className="font-medium text-ink-900">
                  {data.totalUnits} units earned · Overall GWA {data.overallGwa}
                </p>
                <p className="text-xs text-ink-500">
                  Generated {formatDateTime(data.generatedAt)}. This form reflects the record as
                  it stands and changes as grades are approved.
                </p>
              </div>
              {data.ungradedCount === 0 ? (
                <Badge tone="success">Complete</Badge>
              ) : (
                <Badge tone="warning">{data.ungradedCount} ungraded</Badge>
              )}
            </div>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
