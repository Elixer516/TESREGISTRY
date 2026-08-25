import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/api';
import type { SectionView, StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Card, PageHeader, Tabs } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker, SectionPicker } from '@/components/pickers';
import { GsaSnapshotSheet } from './GsaSnapshotSheet';

type Mode = 'STUDENT' | 'SECTION';

/**
 * General Schedule and Assessment.
 *
 * A printable slip of what a trainee is currently enrolled in — course load
 * and weekly meeting times for the active term. No fees, no calendar of
 * activities: just enough for a trainee to confirm their own schedule.
 *
 * By section batches the same sheet for every student in a block, for one
 * print run or a "send" that notifies the whole section at once.
 */
export function GsaPage() {
  const [mode, setMode] = useState<Mode>('STUDENT');
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [section, setSection] = useState<SectionView | null>(null);
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const toast = useToast();

  const gsa = useQuery({
    queryKey: ['schedule-assessment', student?.id],
    queryFn: () => documentsApi.scheduleAssessment(student?.id ?? ''),
    enabled: mode === 'STUDENT' && Boolean(student),
  });

  const sectionGsa = useQuery({
    queryKey: ['schedule-assessment-section', section?.id],
    queryFn: () => documentsApi.scheduleAssessmentForSection(section?.id ?? ''),
    enabled: mode === 'SECTION' && Boolean(section),
  });

  const send = useMutation({
    mutationFn: () => documentsApi.sendScheduleAssessmentForSection(section?.id ?? ''),
    onSuccess: (sent) => {
      toast.success(
        `Sent to ${sent} student(s).`,
        'Each one was notified in the portal — no email is sent by this prototype.',
      );
    },
    onError: (caught) => toast.error('Could not send.', errorMessage(caught)),
  });

  return (
    <>
      <PageHeader
        title="General Schedule and Assessment"
        description="Printable weekly schedule and course load, for one trainee or a whole block section."
      />

      <div className="no-print mb-4">
        <Tabs<Mode>
          ariaLabel="GSA mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'STUDENT', label: 'By student' },
            { value: 'SECTION', label: 'By block section' },
          ]}
        />
      </div>

      {mode === 'STUDENT' ? (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Card className="no-print h-fit p-4">
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
                hint="Search by name or student number to generate their schedule and assessment."
                action={
                  <Button variant="primary" onClick={() => setPickerOpen(true)}>
                    Find a student
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
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <Card className="no-print h-fit p-4">
            <PickerButton
              label="Block section"
              value={section ? section.code : null}
              placeholder="Choose a section…"
              onClick={() => setSectionPickerOpen(true)}
              onClear={() => setSection(null)}
            />
          </Card>

          <div className="space-y-4">
            {!section ? (
              <EmptyState
                title="Choose a section"
                hint="Every student currently in the section gets one sheet, in one batch."
                action={
                  <Button variant="primary" onClick={() => setSectionPickerOpen(true)}>
                    Find a section
                  </Button>
                }
              />
            ) : sectionGsa.isLoading ? (
              <LoadingState label="Building the schedule and assessment for the section…" />
            ) : sectionGsa.error ? (
              <ErrorState error={sectionGsa.error} onRetry={() => sectionGsa.refetch()} />
            ) : sectionGsa.data ? (
              sectionGsa.data.length === 0 ? (
                <EmptyState
                  title="No students in this section"
                  hint="Nothing to print or send yet."
                />
              ) : (
                <>
                  <div className="no-print flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      loading={send.isPending}
                      onClick={() => send.mutate()}
                    >
                      Send to section
                    </Button>
                    <Button variant="primary" onClick={() => window.print()}>
                      Print {sectionGsa.data.length} sheet(s)
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {sectionGsa.data.map((row, index) => (
                      <GsaSnapshotSheet
                        key={row.student.id}
                        data={row}
                        pageBreakBefore={index > 0}
                      />
                    ))}
                  </div>
                </>
              )
            ) : null}
          </div>
        </div>
      )}

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />
      <SectionPicker
        open={sectionPickerOpen}
        onClose={() => setSectionPickerOpen(false)}
        onSelect={setSection}
        selectedId={section?.id ?? null}
      />
    </>
  );
}
