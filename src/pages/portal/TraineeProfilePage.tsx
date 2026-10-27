import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TraineeDashboard, TraineeProfileInput } from '@/types/views';
import { dashboardApi, mineApi } from '@/api';
import { STUDENT_STATUS_LABELS } from '@/types';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextInput } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { ChangePasswordModal } from './ChangePasswordModal';
import { PortalCard, PortalHeading } from './portal-ui';

/**
 * The trainee's own record. They correct their own name spelling, email,
 * mobile number, address and emergency contact here; their training record
 * (ID Number, diploma, section, standing) stays the Registrar's.
 */
export function TraineeProfilePage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (query.isLoading) return <LoadingState label="Loading your profile…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const payload = query.data;
  const data: TraineeDashboard | null = payload && payload.kind === 'TRAINEE' ? payload : null;
  if (!data) return null;
  const s = data.student;

  return (
    <>
      <PortalHeading
        title="Profile"
        description="Your record. Correct your name, contact details and emergency contact yourself; for anything about your training, visit the Office of the Registrar."
        actions={
          <>
            <Button variant="primary" onClick={() => setEditOpen(true)}>
              Edit my details
            </Button>
            <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Training">
          <Item label="ID Number" value={s.studentNumber} />
          <Item label="Diploma" value={data.programName} />
          <Item label="Curriculum" value={s.curriculumName ?? '—'} />
          <Item label="Year level" value={`Year ${s.yearLevel}`} />
          <Item label="Section" value={data.sectionCode ?? 'Not assigned'} />
          <Item label="Standing" value={STUDENT_STATUS_LABELS[s.status]} />
        </Block>

        <Block title="Personal">
          <Item label="Name" value={`${s.lastName}, ${s.firstName} ${s.middleName}${s.extensionName ? ` ${s.extensionName}` : ''}`} />
          <Item label="Sex" value={s.sex === 'MALE' ? 'Male' : 'Female'} />
          <Item label="Birthdate" value={s.birthDate ? formatDate(s.birthDate) : '—'} />
          <Item label="Civil status" value={s.civilStatus || '—'} />
          <Item label="Nationality" value={s.nationality || '—'} />
        </Block>

        <Block title="Contact">
          <Item label="Email" value={s.email || '—'} />
          <Item label="Mobile" value={s.contactNumber || '—'} />
          <Item label="Address" value={s.address || '—'} />
        </Block>

        <Block title="In case of emergency">
          <Item
            label="Contact person"
            value={
              s.emergencyContactLastName
                ? `${s.emergencyContactFirstName} ${s.emergencyContactLastName}${s.emergencyContactRelationship ? ` (${s.emergencyContactRelationship})` : ''}`
                : '—'
            }
          />
          <Item label="Number" value={s.emergencyContactNumber || '—'} />
        </Block>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <EditDetailsModal open={editOpen} onClose={() => setEditOpen(false)} student={s} />
    </>
  );
}

function EditDetailsModal({
  open,
  onClose,
  student,
}: {
  open: boolean;
  onClose: () => void;
  student: TraineeDashboard['student'];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const fromRecord = (): TraineeProfileInput => ({
    firstName: student.firstName,
    middleName: student.middleName ?? '',
    lastName: student.lastName,
    extensionName: student.extensionName ?? '',
    email: student.email ?? '',
    contactNumber: student.contactNumber ?? '',
    address: student.address ?? '',
    emergencyContactFirstName: student.emergencyContactFirstName ?? '',
    emergencyContactLastName: student.emergencyContactLastName ?? '',
    emergencyContactRelationship: student.emergencyContactRelationship ?? '',
    emergencyContactNumber: student.emergencyContactNumber ?? '',
  });
  const [form, setForm] = useState<TraineeProfileInput>(fromRecord);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setForm(fromRecord());
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (key: keyof TraineeProfileInput, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => mineApi.updateProfile(form),
    onSuccess: () => {
      // The name shows in the header and on every printed form.
      void queryClient.invalidateQueries();
      toast.success('Your details are saved.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const field = (key: keyof TraineeProfileInput, label: string, extra: { required?: boolean; type?: string; hint?: string; wide?: boolean } = {}) => (
    <Field label={label} htmlFor={`me-${key}`} required={extra.required} hint={extra.hint} className={extra.wide ? 'sm:col-span-2' : ''}>
      <TextInput id={`me-${key}`} type={extra.type ?? 'text'} value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit my details"
      description="Your name prints on your Grade Evaluation, COR and transcript exactly as you type it here."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Name</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('firstName', 'First name', { required: true })}
            {field('middleName', 'Middle name')}
            {field('lastName', 'Last name', { required: true })}
            {field('extensionName', 'Extension', { hint: 'Jr., III — leave blank if none.' })}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Contact</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('email', 'Email', { required: true, type: 'email' })}
            {field('contactNumber', 'Mobile number', { required: true, type: 'tel' })}
            {field('address', 'Address', { wide: true })}
          </div>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">In case of emergency</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {field('emergencyContactFirstName', 'First name')}
            {field('emergencyContactLastName', 'Last name')}
            {field('emergencyContactRelationship', 'Relationship')}
            {field('emergencyContactNumber', 'Number', { type: 'tel' })}
          </div>
        </section>
        {error ? <InfoNote tone="danger" title="Could not save">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PortalCard>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">{title}</h3>
      <dl className="space-y-2 text-sm">{children}</dl>
    </PortalCard>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}
