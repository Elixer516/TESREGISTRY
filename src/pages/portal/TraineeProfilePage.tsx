import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TraineeDashboard } from '@/types/views';
import { dashboardApi } from '@/api';
import { STUDENT_STATUS_LABELS } from '@/types';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { ChangePasswordModal } from './ChangePasswordModal';
import { PortalCard, PortalHeading } from './portal-ui';

/**
 * The trainee's own record, read-only. Corrections go through the Registrar,
 * who keeps the official copy — the portal shows it, it does not edit it.
 */
export function TraineeProfilePage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardApi.get() });
  const [passwordOpen, setPasswordOpen] = useState(false);

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
        description="Your record as the Registrar holds it. To correct anything, visit the Office of the Registrar."
        actions={
          <Button variant="secondary" onClick={() => setPasswordOpen(true)}>
            Change password
          </Button>
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
    </>
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
