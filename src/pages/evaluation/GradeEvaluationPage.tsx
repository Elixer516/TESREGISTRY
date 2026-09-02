import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StudentView } from '@/types/views';
import { evaluationApi } from '@/api';
import { Button, Card, PageHeader } from '@/components/ui';
import { QueryState } from '@/components/states';
import { StudentPicker } from '@/components/pickers';
import { GradeEvaluationSheet } from './GradeEvaluationSheet';
import { IncResolutionModal, type IncTarget } from './IncResolutionModal';

/**
 * The Grade Evaluation Form, and the only place an INC is resolved.
 *
 * Those two live together on purpose. An unresolved INC forces the GWA to
 * 0.000, so the form is exactly where a registrar notices one — and having to
 * leave the form to fix it, on a screen that no longer exists, was how the
 * completion column could never be filled.
 */
export function GradeEvaluationPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resolving, setResolving] = useState<IncTarget | null>(null);

  const evaluation = useQuery({
    queryKey: ['grade-evaluation', student?.id],
    queryFn: () => evaluationApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const data = evaluation.data;
  const openIncs = data
    ? data.groups.flatMap((group) =>
        group.rows
          .filter((row) => row.grade === 'INC' && !row.completionGrade)
          .map((row) => ({ ...row, semesterLabel: group.label })),
      )
    : [];

  return (
    <>
      <PageHeader
        title="Grade Evaluation"
        description="Every subject a trainee has taken, from First Year 1st Semester to the present, with the grades and prerequisites behind each."
        actions={
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            {student ? 'Change trainee' : 'Find a trainee'}
          </Button>
        }
      />

      {!student ? (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-ink-900">Choose a trainee</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
            Search by name or student number. The evaluation compiles every semester on
            record — it generates whether or not all grades are in.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              Find a trainee
            </Button>
          </div>
        </Card>
      ) : (
        <QueryState
          isLoading={evaluation.isLoading}
          error={evaluation.error}
          isEmpty={Boolean(data && data.groups.length === 0)}
          onRetry={() => evaluation.refetch()}
          emptyTitle="Nothing on record yet"
          emptyHint={`${student.fullName} has no enrollment history, so there is nothing to evaluate.`}
        >
          {data ? (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink-900">
                      {data.student.lastFirstName}
                    </p>
                    <p className="text-sm text-ink-500">
                      {data.student.studentNumber} · {data.student.programName} · Year{' '}
                      {data.student.yearLevel}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {data.groups.length} semester{data.groups.length === 1 ? '' : 's'} on
                      record · {data.totalUnits} units ·{' '}
                      <span className="font-medium text-ink-700">GWA {data.overallGwa}</span>
                    </p>
                  </div>
                  <Button variant="primary" onClick={() => window.print()}>
                    Print form
                  </Button>
                </div>
              </Card>

              {openIncs.length > 0 ? (
                <Card className="border-warning/40 bg-warning-soft p-4">
                  <p className="text-sm font-semibold text-warning-ink">
                    {openIncs.length} unresolved INC — the GWA reads 0.000 until they are
                    settled
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {openIncs.map((row) => (
                      <li
                        key={row.enrollmentSubjectId}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm text-warning-ink"
                      >
                        <span>
                          <span className="font-medium">{row.courseCode}</span> —{' '}
                          {row.courseTitle}{' '}
                          <span className="text-xs opacity-80">({row.semesterLabel})</span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setResolving({
                              enrollmentSubjectId: row.enrollmentSubjectId,
                              subjectCode: row.courseCode,
                              subjectTitle: row.courseTitle,
                            })
                          }
                        >
                          Resolve INC
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              {/* The form itself, always on screen. Printing takes this and
                  leaves the rest of the page behind. */}
              <Card className="p-4 sm:p-6">
                <GradeEvaluationSheet student={student} />
              </Card>
            </div>
          ) : null}
        </QueryState>
      )}

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedId={student?.id}
        onSelect={(picked) => {
          setStudent(picked);
          setPickerOpen(false);
        }}
      />

      <IncResolutionModal
        row={resolving}
        onClose={() => setResolving(null)}
        onResolved={() => {
          setResolving(null);
          evaluation.refetch();
        }}
      />
    </>
  );
}
