import { useQuery } from '@tanstack/react-query';
import type { GradeEvaluationRow, StudentView } from '@/types/views';
import { evaluationApi } from '@/api';
import { Badge, Modal, Table, TableWrap, Td, Th } from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * One trainee's grades, all of them, in one place.
 *
 * The review queue is organised by class, which is right for the job it does
 * — a trainer submits a class, and the registrar rules on a class. But it
 * answers "how is this class doing?" and never "how is this trainee doing?",
 * and a registrar looking at a name on a roster frequently wants the second.
 *
 * This aggregates what already exists rather than storing anything new: the
 * same evaluation the Grade Evaluation Form is built from, grouped by school
 * year and semester, with the status derived by the same rules the
 * prerequisite check uses. So a subject that reads Passed here is a subject
 * that will satisfy a prerequisite there, by construction rather than by
 * two lists agreeing with each other.
 */
export function StudentGradingSheetModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const evaluation = useQuery({
    queryKey: ['grade-evaluation', student?.id],
    queryFn: () => evaluationApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const data = evaluation.data;

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title="Student grading sheet"
      description={
        student ? `${student.fullName} · ${student.studentNumber} · ${student.programCode}` : undefined
      }
      size="xl"
    >
      <QueryState
        isLoading={evaluation.isLoading}
        error={evaluation.error}
        isEmpty={Boolean(data && data.groups.length === 0)}
        onRetry={() => evaluation.refetch()}
        loadingLabel="Gathering this trainee's grades…"
        emptyTitle="Nothing on record yet"
        emptyHint="Grades appear here once this trainee is enrolled and a grading sheet is approved."
      >
        {data ? (
          <div className="space-y-5">
            {data.groups.map((group) => (
              <div key={group.semesterId}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-ink-900">{group.label}</h3>
                  <span className="text-xs text-ink-500">{group.academicYearLabel}</span>
                  <span className="ml-auto text-[11px] text-ink-500">
                    {group.totalUnits} units
                    {group.hasUnresolvedInc ? ' · GWA held by an unresolved INC' : ` · GWA ${group.gwa}`}
                  </span>
                </div>
                <TableWrap>
                  <Table className="min-w-[34rem]">
                    <thead>
                      <tr>
                        <Th>Subject Code</Th>
                        <Th>Subject</Th>
                        <Th>Prerequisite</Th>
                        <Th className="text-right">Units</Th>
                        <Th className="text-right">Grade</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.enrollmentSubjectId}>
                          <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                          <Td className="text-ink-700">{row.courseTitle}</Td>
                          <Td className="text-xs text-ink-500">{row.prerequisites || '—'}</Td>
                          <Td className="text-right tabular-nums">{row.units}</Td>
                          <Td className="text-right tabular-nums font-medium text-ink-900">
                            {row.grade ?? '—'}
                            {row.completionGrade ? (
                              <span className="ml-1 text-xs font-normal text-ink-500">
                                &rarr; {row.completionGrade}
                              </span>
                            ) : null}
                          </Td>
                          <Td>
                            <Badge tone={statusOf(row).tone}>{statusOf(row).label}</Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </div>
            ))}

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-sm">
              <span className="text-ink-500">
                {data.groups.length} semester{data.groups.length === 1 ? '' : 's'} ·{' '}
                {data.totalUnits} units
                {data.ungradedCount > 0 ? ` · ${data.ungradedCount} not yet graded` : ''}
              </span>
              <span className="font-semibold text-ink-900">
                {data.hasUnresolvedInc ? 'GWA held by an unresolved INC' : `Overall GWA ${data.overallGwa}`}
              </span>
            </div>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}

/**
 * The status as the rest of the system decides it, not a second opinion.
 *
 * An unresolved INC reads as a warning rather than a plain neutral because it
 * is the one status that actively blocks something: the trainee cannot take
 * anything that depends on it, and cannot move to the next semester while it
 * stands. A resolved INC reads as a pass, because that is what its completion
 * grade made it.
 */
function statusOf(row: GradeEvaluationRow): {
  label: string;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
} {
  if (row.grade === null) return { label: 'Not Yet Graded', tone: 'neutral' };
  if (row.grade === 'INC') {
    return row.completionGrade
      ? { label: 'INC — Resolved', tone: 'success' }
      : { label: 'INC — Unresolved', tone: 'warning' };
  }
  return row.isPassed
    ? { label: 'Passed', tone: 'success' }
    : { label: 'Failed', tone: 'danger' };
}
