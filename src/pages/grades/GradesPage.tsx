import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api';
import type { ClassScheduleView, StudentView } from '@/types/views';
import { Card, InfoNote, PageHeader, Tabs } from '@/components/ui';
import { PickerButton } from '@/components/RecordPicker';
import { ClassPicker, StudentPicker } from '@/components/pickers';
import { SchoolYearTermFilter } from '@/components/SchoolYearTermFilter';
import { ClassRosterPanel } from './ClassRosterPanel';
import { StudentGradePanel } from './StudentGradePanel';

type Workflow = 'CLASS' | 'STUDENT';

/**
 * Grade encoding.
 *
 * Two ways in — a whole class roster, or one student's subjects — over one set
 * of rules. The term must be active, and a trainer may only touch classes they
 * are assigned to; both are enforced by the service, not by this page.
 */
export function GradesPage() {
  const [workflow, setWorkflow] = useState<Workflow>('CLASS');
  const [semesterId, setSemesterId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ClassScheduleView | null>(null);
  const [student, setStudent] = useState<StudentView | null>(null);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  const activeTerm = useQuery({
    queryKey: ['active-semester'],
    queryFn: () => catalogApi.getActiveSemester(),
  });

  useEffect(() => {
    if (!semesterId && activeTerm.data) setSemesterId(activeTerm.data.id);
  }, [activeTerm.data, semesterId]);

  // Changing the term invalidates a class chosen from the previous one.
  useEffect(() => {
    setSchedule(null);
  }, [semesterId]);

  const isActiveTerm = Boolean(
    activeTerm.data && semesterId && activeTerm.data.id === semesterId,
  );

  return (
    <>
      <PageHeader
        title="Grades"
        description="Grades run 1.00 to 5.00 with 3.00 as the passing cutoff, or INC. Anything else is rejected."
      />

      <div className="mb-4">
        <Tabs<Workflow>
          ariaLabel="Grade encoding workflow"
          value={workflow}
          onChange={setWorkflow}
          options={[
            { value: 'CLASS', label: 'By class' },
            { value: 'STUDENT', label: 'By student' },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit p-4">
          <div className="space-y-4">
            <SchoolYearTermFilter
              semesterId={semesterId}
              onChange={setSemesterId}
              className="space-y-3"
            />

            {workflow === 'CLASS' ? (
              <PickerButton
                label="Class"
                value={
                  schedule
                    ? schedule.subjectCode + ' · ' + schedule.sectionCode + ' · ' + schedule.dayPattern
                    : null
                }
                placeholder="Choose a class…"
                onClick={() => setClassPickerOpen(true)}
                onClear={() => setSchedule(null)}
                disabled={!semesterId}
              />
            ) : (
              <PickerButton
                label="Student"
                value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
                placeholder="Choose a student…"
                onClick={() => setStudentPickerOpen(true)}
                onClear={() => setStudent(null)}
              />
            )}

            {!isActiveTerm && semesterId ? (
              <InfoNote tone="warning" title="Not the active term">
                Grades can only be encoded for the active term. This term is read-only; the
                Registrar can change which term is active under School Years and Terms.
              </InfoNote>
            ) : null}
          </div>
        </Card>

        <div>
          {workflow === 'CLASS' ? (
            <ClassRosterPanel
              schedule={schedule}
              onPickClass={() => setClassPickerOpen(true)}
            />
          ) : (
            <StudentGradePanel
              student={student}
              semesterId={semesterId}
              onPickStudent={() => setStudentPickerOpen(true)}
            />
          )}
        </div>
      </div>

      {semesterId ? (
        <ClassPicker
          open={classPickerOpen}
          onClose={() => setClassPickerOpen(false)}
          onSelect={setSchedule}
          semesterId={semesterId}
          selectedId={schedule?.id ?? null}
        />
      ) : null}

      <StudentPicker
        open={studentPickerOpen}
        onClose={() => setStudentPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
        statuses={['APPROVED', 'ACTIVE', 'INACTIVE', 'GRADUATED']}
        title="Find a student"
        description="Only subjects the student is actually enrolled in for the chosen term can be graded."
      />
    </>
  );
}
