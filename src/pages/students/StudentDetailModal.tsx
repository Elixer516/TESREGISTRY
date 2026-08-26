import { useEffect, useState } from 'react';
import { APPLICANT_STANDING_LABELS } from '@/types';
import type { StudentView } from '@/types/views';
import { formatDate } from '@/lib/format';
import { regionName } from '@/lib/psgc';
import { Badge, DescriptionItem, Modal, Tabs } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StatusBadge';
import { DocumentsPanel } from './DocumentsPanel';

type DetailTab = 'DETAILS' | 'DOCUMENTS';

/**
 * The student preview.
 *
 * Reachable from every row including Pending, which previously offered only
 * Approve and Reject — a registrar should be able to read an application
 * before deciding on it.
 */
export function StudentDetailModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<DetailTab>('DETAILS');

  useEffect(() => {
    if (student) setTab('DETAILS');
  }, [student?.id]);

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={student ? student.fullName : 'Student record'}
      description={
        student
          ? `${student.studentNumber} · ${student.programCode}${
              student.referenceCode ? ` · applied online (${student.referenceCode})` : ''
            }`
          : undefined
      }
      size="xl"
    >
      {student ? (
        <div className="space-y-4">
          <Tabs<DetailTab>
            ariaLabel="Student record section"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'DETAILS', label: 'Details' },
              { value: 'DOCUMENTS', label: 'Documents' },
            ]}
          />

          {tab === 'DETAILS' ? (
            <DetailsTab student={student} />
          ) : (
            <DocumentsPanel student={student} />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function DetailsTab({ student }: { student: StudentView }) {
  return (
    <div className="space-y-5">
      <section>
        <SectionTitle>Standing</SectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <StudentStatusBadge status={student.status} />
          {student.isTransferee ? <Badge tone="brand">Transferee</Badge> : null}
          {student.applicantStanding ? (
            <Badge tone="info">{APPLICANT_STANDING_LABELS[student.applicantStanding]}</Badge>
          ) : (
            <Badge tone="warning">Educational standing not set</Badge>
          )}
        </div>
        {student.rejectionReason ? (
          <p className="mt-2 rounded-md border-l-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {student.rejectionReason}
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle>Personal</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Full name">{student.fullName}</DescriptionItem>
          <DescriptionItem label="Student number">{student.studentNumber}</DescriptionItem>
          <DescriptionItem label="Sex">{student.sex}</DescriptionItem>
          <DescriptionItem label="Date of birth">
            {student.birthDate ? formatDate(student.birthDate) : '—'}
          </DescriptionItem>
          <DescriptionItem label="Place of birth">{student.birthPlace || '—'}</DescriptionItem>
          <DescriptionItem label="Civil status">{student.civilStatus || '—'}</DescriptionItem>
          <DescriptionItem label="Nationality">{student.nationality || '—'}</DescriptionItem>
          <DescriptionItem label="Blood type">{student.bloodType || '—'}</DescriptionItem>
          <DescriptionItem label="Employment status">
            {student.employmentStatus || '—'}
          </DescriptionItem>
          <DescriptionItem label="Disability">
            {student.disability
              ? `${student.disability}${
                  student.disabilitySpecify ? ` — ${student.disabilitySpecify}` : ''
                }`
              : 'None declared'}
          </DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Address</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Street">{student.addressStreet || '—'}</DescriptionItem>
          <DescriptionItem label="Barangay">{student.addressBarangay || '—'}</DescriptionItem>
          <DescriptionItem label="City / Municipality">
            {student.addressCityMunicipality || '—'}
          </DescriptionItem>
          <DescriptionItem label="Province">{student.addressProvince || '—'}</DescriptionItem>
          <DescriptionItem label="Region">
            {student.addressRegion ? regionName(student.addressRegion) : '—'}
          </DescriptionItem>
          <DescriptionItem label="District">{student.addressDistrict || '—'}</DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Contact</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Email">{student.email || '—'}</DescriptionItem>
          <DescriptionItem label="Phone number">{student.contactNumber || '—'}</DescriptionItem>
          <DescriptionItem label="Social media">
            {student.socialMedia
              ? `${student.socialMedia}${
                  student.socialMediaAccount ? ` — ${student.socialMediaAccount}` : ''
                }`
              : '—'}
          </DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Emergency contact</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Name">{student.emergencyContactName || '—'}</DescriptionItem>
          <DescriptionItem label="Relationship">
            {student.emergencyContactRelationship || '—'}
          </DescriptionItem>
          <DescriptionItem label="Phone number">
            {student.emergencyContactNumber || '—'}
          </DescriptionItem>
          <DescriptionItem label="Address">
            {student.emergencyContactAddress || '—'}
          </DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Academic</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Course">
            {student.programCode} — {student.programName}
          </DescriptionItem>
          <DescriptionItem label="Curriculum">{student.curriculumName ?? 'Not assigned'}</DescriptionItem>
          <DescriptionItem label="Section">{student.sectionCode ?? '—'}</DescriptionItem>
          <DescriptionItem label="Year level">{student.yearLevel}</DescriptionItem>
          <DescriptionItem label="Educational attainment">
            {student.highestEducation || '—'}
          </DescriptionItem>
          <DescriptionItem label="Previous school">
            {student.secondarySchool || '—'}
          </DescriptionItem>
          <DescriptionItem label="Year ended">
            {student.secondarySchoolYearAttended || '—'}
          </DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Record</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Applied">{formatDate(student.createdAt)}</DescriptionItem>
          <DescriptionItem label="Approved">
            {student.approvedAt ? formatDate(student.approvedAt) : '—'}
          </DescriptionItem>
          <DescriptionItem label="Reference code">
            {student.referenceCode || 'Encoded by the registrar'}
          </DescriptionItem>
        </dl>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
      {children}
    </h3>
  );
}
