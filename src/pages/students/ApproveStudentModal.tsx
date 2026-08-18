import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select } from '@/components/ui';

/**
 * Approval assigns the curriculum. It is required, not optional: enrollment
 * reads the curriculum to decide which subjects a student may take, so an
 * approved student without one is a dead end.
 */
export function ApproveStudentModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const [curriculumId, setCurriculumId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const curricula = useQuery({
    queryKey: ['curricula', student?.programId],
    queryFn: () => catalogApi.listCurricula(student?.programId),
    enabled: Boolean(student),
  });

  const sections = useQuery({
    queryKey: ['sections', student?.programId],
    queryFn: () => catalogApi.listSections(student?.programId),
    enabled: Boolean(student),
  });

  useEffect(() => {
    if (student) {
      setCurriculumId('');
      setSectionId('');
      setError(null);
    }
  }, [student]);

  const approve = useMutation({
    mutationFn: () => studentsApi.approve(student?.id ?? '', curriculumId, sectionId || null),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(updated.fullName + ' approved.', 'Curriculum ' + (updated.curriculumName ?? '') + ' assigned.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={student ? 'Approve ' + student.fullName : 'Approve application'}
      description="Approval moves the application to Approved and assigns a curriculum."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!curriculumId}
            loading={approve.isPending}
            onClick={() => {
              setError(null);
              approve.mutate();
            }}
          >
            Approve and assign
          </Button>
        </>
      }
    >
      {student ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Student number</dt>
              <dd className="font-medium text-ink-900">{student.studentNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Program</dt>
              <dd className="font-medium text-ink-900">
                {student.programCode} — {student.programName}
              </dd>
            </div>
          </dl>

          <Field
            label="Curriculum"
            htmlFor="curriculum"
            required
            hint="Required. Enrollment reads this to decide which subjects the student may take."
          >
            <Select
              id="curriculum"
              value={curriculumId}
              onChange={(event) => setCurriculumId(event.target.value)}
            >
              <option value="">Select a curriculum…</option>
              {(curricula.data ?? []).map((curriculum) => (
                <option key={curriculum.id} value={curriculum.id}>
                  {curriculum.code} — {curriculum.name} ({curriculum.subjectCount} subjects)
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Section" htmlFor="section" hint="Optional — it can be set later.">
            <Select
              id="section"
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value)}
            >
              <option value="">No section yet</option>
              {(sections.data ?? []).map((section) => (
                <option key={section.id} value={section.id}>
                  {section.code} — Year {section.yearLevel} ({section.studentCount}/{section.capacity})
                </option>
              ))}
            </Select>
          </Field>

          {curricula.data && curricula.data.length === 0 ? (
            <InfoNote tone="warning" title="No curriculum exists for this program">
              The Training Department needs to create one under Academic Catalog before this
              application can be approved.
            </InfoNote>
          ) : null}

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      ) : null}
    </Modal>
  );
}
