import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import {
  Button,
  Card,
  CardHeader,
  InfoNote,
  PageHeader,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker } from '@/components/pickers';

/**
 * General Scholastic Average.
 *
 * Unit-weighted across every graded subject. An unresolved INC pins it to
 * 0.000 — the same rule the transcript uses, for the same reason.
 */
export function GsaPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const gsa = useQuery({
    queryKey: ['gsa', student?.id],
    queryFn: () => documentsApi.gsa(student?.id ?? ''),
    enabled: Boolean(student),
  });

  return (
    <>
      <PageHeader
        title="General Scholastic Average"
        description="Unit-weighted average across every graded subject on record."
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-4">
          <PickerButton
            label="Student"
            value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
            placeholder="Choose a student…"
            onClick={() => setPickerOpen(true)}
            onClear={() => setStudent(null)}
          />
        </Card>

        <div className="space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a student"
              hint="Search by name or student number to compute their average."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a student
                </Button>
              }
            />
          ) : gsa.isLoading ? (
            <LoadingState label="Computing the average…" />
          ) : gsa.error ? (
            <ErrorState error={gsa.error} onRetry={() => gsa.refetch()} />
          ) : gsa.data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile
                  label="GSA"
                  value={gsa.data.gwa}
                  hint={gsa.data.hasUnresolvedInc ? 'Held at 0.000 by an unresolved INC' : 'Unit-weighted'}
                />
                <StatTile label="Total units" value={gsa.data.totalUnits} hint="Units on record" />
                <StatTile
                  label="Units counted"
                  value={gsa.data.countedUnits}
                  hint="Units that carried a numeric grade"
                />
              </div>

              {gsa.data.note ? <InfoNote tone="warning">{gsa.data.note}</InfoNote> : null}

              <Card>
                <CardHeader title="Per term" description="Each term computed on its own rows." />
                {gsa.data.perTerm.length === 0 ? (
                  <p className="p-4 text-sm text-ink-500">
                    No enrollments on record for this student yet.
                  </p>
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <Th>Term</Th>
                          <Th className="text-right">Units</Th>
                          <Th className="text-right">GWA</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {gsa.data.perTerm.map((term) => (
                          <tr key={term.label}>
                            <Td>{term.label}</Td>
                            <Td className="text-right tabular-nums">{term.units}</Td>
                            <Td className="text-right tabular-nums font-medium text-ink-900">
                              {term.gwa}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Enrolled subjects"
                  description="Course code, term and units for every subject counted into this average."
                />
                {gsa.data.subjects.length === 0 ? (
                  <p className="p-4 text-sm text-ink-500">
                    This student has no enrolled subjects yet.
                  </p>
                ) : (
                  <TableWrap>
                    <Table className="min-w-[42rem]">
                      <thead>
                        <tr>
                          <Th>Course code</Th>
                          <Th>Descriptive title</Th>
                          <Th>Semester</Th>
                          <Th>Schedule</Th>
                          <Th className="text-right">Units</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {gsa.data.subjects.map((row, index) => (
                          <tr key={row.courseCode + '-' + index}>
                            <Td className="font-medium text-ink-900">{row.courseCode}</Td>
                            <Td>{row.courseTitle}</Td>
                            <Td className="text-xs">{row.periodLabel}</Td>
                            <Td className="text-xs text-ink-500">
                              {row.scheduleLabel ?? 'No class attached'}
                            </Td>
                            <Td className="text-right tabular-nums">{row.units}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />
    </>
  );
}
