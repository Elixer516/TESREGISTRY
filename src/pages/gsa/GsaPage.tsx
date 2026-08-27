import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { StudentView } from '@/types/views';
import { gsaApi } from '@/api';
import { Button, Card, PageHeader } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { StudentPicker } from '@/components/pickers';
import { PickerButton } from '@/components/RecordPicker';
import { GsaSnapshotSheet } from './GsaSnapshotSheet';

/**
 * The General Schedule and Assessment, for one trainee.
 *
 * Their weekly grid, the subjects on it and the units those carry — enough
 * for a trainee to confirm what they are studying and when.
 *
 * The by-section batch mode was removed in V9 along with the notification
 * subsystem it depended on for its "send" action.
 */
export function GsaPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const gsa = useQuery({
    queryKey: ['schedule-assessment', student?.id],
    queryFn: () => gsaApi.forStudent(student?.id ?? ''),
    enabled: Boolean(student),
  });

  return (
    <>
      <PageHeader
        title="General Schedule and Assessment"
        description="A trainee's weekly schedule and course load for their currently open semester, ready to print."
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="no-print h-fit p-4">
          <PickerButton
            label="Trainee"
            value={student ? `${student.lastFirstName} · ${student.studentNumber}` : null}
            placeholder="Choose a trainee…"
            onClick={() => setPickerOpen(true)}
            onClear={() => setStudent(null)}
          />
        </Card>

        <div className="space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a trainee"
              hint="Search by name or student number to generate their schedule and assessment."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a trainee
                </Button>
              }
            />
          ) : gsa.isLoading ? (
            <LoadingState label="Building the schedule and assessment…" />
          ) : gsa.error ? (
            <ErrorState error={gsa.error} onRetry={() => gsa.refetch()} />
          ) : gsa.data ? (
            <>
              <div className="no-print flex justify-end">
                <Button variant="primary" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
              <GsaSnapshotSheet data={gsa.data} />
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
