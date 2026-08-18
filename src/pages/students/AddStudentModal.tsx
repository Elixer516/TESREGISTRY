import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, studentsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Checkbox, Field, Modal, Select, TextArea, TextInput } from '@/components/ui';

const EMPTY = {
  studentNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  contactNumber: '',
  address: '',
  birthDate: '',
  sex: 'MALE' as 'MALE' | 'FEMALE',
  programId: '',
  yearLevel: 1,
  isTransferee: false,
};

/** New applications always start as PENDING — approval is a separate decision. */
export function AddStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    const first = programs.data?.[0];
    if (first && !form.programId) setForm((current) => ({ ...current, programId: first.id }));
  }, [programs.data, form.programId]);

  const create = useMutation({
    mutationFn: () => studentsApi.create(form),
    onSuccess: (student) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        'Application recorded for ' + student.fullName + '.',
        'It is pending until you approve it and assign a curriculum.',
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a student"
      description="The record is created as a pending application."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={create.isPending}
            onClick={() => {
              setError(null);
              create.mutate();
            }}
          >
            Save application
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student number" htmlFor="sn" required hint="Must be unique across the centre.">
          <TextInput
            id="sn"
            value={form.studentNumber}
            onChange={(event) => set('studentNumber', event.target.value)}
          />
        </Field>
        <Field label="Program" htmlFor="program" required>
          <Select
            id="program"
            value={form.programId}
            onChange={(event) => set('programId', event.target.value)}
          >
            {(programs.data ?? []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.code} — {program.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="First name" htmlFor="fn" required>
          <TextInput id="fn" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
        </Field>
        <Field label="Middle name" htmlFor="mn">
          <TextInput id="mn" value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
        </Field>
        <Field label="Last name" htmlFor="ln" required>
          <TextInput id="ln" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="em">
          <TextInput id="em" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Contact number" htmlFor="cn">
          <TextInput id="cn" value={form.contactNumber} onChange={(e) => set('contactNumber', e.target.value)} />
        </Field>
        <Field label="Date of birth" htmlFor="bd" hint="Needed later for documents.">
          <TextInput id="bd" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
        </Field>
        <Field label="Sex" htmlFor="sx">
          <Select id="sx" value={form.sex} onChange={(e) => set('sex', e.target.value as 'MALE' | 'FEMALE')}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </Field>
        <Field label="Year level" htmlFor="yl">
          <TextInput
            id="yl"
            type="number"
            min={1}
            max={6}
            value={form.yearLevel}
            onChange={(e) => set('yearLevel', Number(e.target.value))}
          />
        </Field>
        <Field label="Address" htmlFor="ad" className="sm:col-span-2" hint="Needed later for documents.">
          <TextArea id="ad" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            label="Transferee"
            description="Credited subjects from a previous school are entered separately under Transcript Upload."
            checked={form.isTransferee}
            onChange={(e) => set('isTransferee', e.target.checked)}
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
