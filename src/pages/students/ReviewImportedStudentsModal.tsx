import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Field, InfoNote, Modal, Select } from '@/components/ui';

function missingFields(student: StudentView): string[] {
  const missing: string[] = [];
  if (!student.email) missing.push('email');
  if (!student.contactNumber) missing.push('contact number');
  if (!student.birthDate) missing.push('birth date');
  if (!student.address) missing.push('address');
  return missing;
}

/**
 * Post-import review.
 *
 * Every imported row is shown individually with what it's missing, so a
 * batch isn't approved blind. Approval itself can be done one at a time or
 * for the whole selection at once — the curriculum/section picked here
 * applies to everyone checked, since a batch normally shares a program.
 */
export function ReviewImportedStudentsModal({
  students,
  onClose,
}: {
  students: StudentView[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [curriculumId, setCurriculumId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const programId = students[0]?.programId;
  const singleProgram = students.every((s) => s.programId === programId);

  useEffect(() => {
    setSelected(new Set(students.map((s) => s.id)));
    setCurriculumId('');
    setSectionId('');
    setError(null);
  }, [students]);

  const curricula = useQuery({
    queryKey: ['curricula', programId],
    queryFn: () => catalogApi.listCurricula(programId),
    enabled: students.length > 0 && singleProgram,
  });
  const sections = useQuery({
    queryKey: ['sections', programId],
    queryFn: () => catalogApi.listSections(programId),
    enabled: students.length > 0 && singleProgram,
  });

  const approveMany = useMutation({
    mutationFn: () => studentsApi.approveMany([...selected], curriculumId, sectionId || null),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(updated.length + ' application(s) approved.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = students.length > 0 && selected.size === students.length;
  const missingByStudent = useMemo(
    () => new Map(students.map((s) => [s.id, missingFields(s)])),
    [students],
  );

  return (
    <Modal
      open={students.length > 0}
      onClose={onClose}
      title="Review imported applications"
      description="Check what's missing before approving. Approve them one at a time from the Students tab, or select several and approve together."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Done for now
          </Button>
          <Button
            variant="primary"
            disabled={selected.size === 0 || !curriculumId}
            loading={approveMany.isPending}
            onClick={() => {
              setError(null);
              approveMany.mutate();
            }}
          >
            Approve {selected.size > 0 ? selected.size + ' selected' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!singleProgram ? (
          <InfoNote tone="warning" title="Multiple programs in this batch">
            Bulk approval needs one shared curriculum, so it's disabled here — approve these
            individually from the Students tab instead.
          </InfoNote>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Curriculum for the selected rows"
              htmlFor="review-curriculum"
              required
              hint="Applied to everyone checked below."
            >
              <Select
                id="review-curriculum"
                value={curriculumId}
                onChange={(event) => setCurriculumId(event.target.value)}
              >
                <option value="">Select a curriculum…</option>
                {(curricula.data ?? []).map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.code} — {curriculum.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Section" htmlFor="review-section" hint="Optional — it can be set later.">
              <Select
                id="review-section"
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
              >
                <option value="">No section yet</option>
                {(sections.data ?? []).map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.code} — Year {section.yearLevel}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

        <div className="rounded-lg border border-line">
          <label className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelected(event.target.checked ? new Set(students.map((s) => s.id)) : new Set())
              }
            />
            Select all ({students.length})
          </label>
          <ul className="max-h-96 divide-y divide-line overflow-y-auto">
            {students.map((student) => {
              const missing = missingByStudent.get(student.id) ?? [];
              return (
                <li key={student.id} className="flex items-start gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.has(student.id)}
                    onChange={() => toggle(student.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-900">{student.fullName}</p>
                    <p className="text-xs text-ink-500">
                      {student.studentNumber} · {student.programCode}
                    </p>
                  </div>
                  {missing.length > 0 ? (
                    <Badge tone="warning">Missing {missing.join(', ')}</Badge>
                  ) : (
                    <Badge tone="success">Complete</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
