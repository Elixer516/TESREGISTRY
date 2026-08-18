import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, studentsApi } from '@/api';
import type { StudentStatus } from '@/types';
import { SETTABLE_STATUSES, STUDENT_STATUS_LABELS } from '@/types';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, TextArea, TextInput } from '@/components/ui';

export function EditStudentModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    studentNumber: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    contactNumber: '',
    address: '',
    birthDate: '',
    yearLevel: 1,
    sectionId: '',
  });
  const [status, setStatus] = useState<StudentStatus>('ACTIVE');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const sections = useQuery({
    queryKey: ['sections', student?.programId],
    queryFn: () => catalogApi.listSections(student?.programId),
    enabled: Boolean(student),
  });

  useEffect(() => {
    if (!student) return;
    setForm({
      studentNumber: student.studentNumber,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      email: student.email,
      contactNumber: student.contactNumber,
      address: student.address,
      birthDate: student.birthDate,
      yearLevel: student.yearLevel,
      sectionId: student.sectionId ?? '',
    });
    setStatus(student.status);
    setError(null);
  }, [student]);

  const save = useMutation({
    mutationFn: async () => {
      const id = student?.id ?? '';
      await studentsApi.update(id, {
        ...form,
        sectionId: form.sectionId || null,
      });
      if (student && status !== student.status) {
        await studentsApi.setStatus(id, status);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Student record updated.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={student ? 'Edit ' + student.fullName : 'Edit student'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student number" htmlFor="e-sn" required>
          <TextInput id="e-sn" value={form.studentNumber} onChange={(e) => set('studentNumber', e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="e-status" hint="Pending and Rejected belong to the approve and reject actions.">
          <Select id="e-status" value={status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
            {SETTABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STUDENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First name" htmlFor="e-fn" required>
          <TextInput id="e-fn" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Middle name" htmlFor="e-mn">
          <TextInput id="e-mn" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="e-ln" required>
          <TextInput id="e-ln" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="e-em">
          <TextInput id="e-em" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Contact number" htmlFor="e-cn">
          <TextInput id="e-cn" value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="e-bd" hint="Documents will not generate without this.">
          <TextInput id="e-bd" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </Field>
        <Field label="Year level" htmlFor="e-yl">
          <TextInput
            id="e-yl"
            type="number"
            min={1}
            max={6}
            value={form.yearLevel}
            onChange={(e) => set('yearLevel', Number(e.target.value))}
          />
        </Field>
        <Field label="Section" htmlFor="e-sec">
          <Select id="e-sec" value={form.sectionId} onChange={(e) => set('sectionId', e.target.value)}>
            <option value="">No section</option>
            {(sections.data ?? []).map((section) => (
              <option key={section.id} value={section.id}>
                {section.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Address" htmlFor="e-ad" className="sm:col-span-2" hint="Documents will not generate without this.">
          <TextArea id="e-ad" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </div>

      {student?.curriculumName ? (
        <p className="mt-3 text-xs text-ink-500">
          Curriculum: <span className="font-medium text-ink-700">{student.curriculumName}</span>
        </p>
      ) : null}

      {error ? (
        <div className="mt-4">
          <InfoNote tone="danger">{error}</InfoNote>
        </div>
      ) : null}
    </Modal>
  );
}
