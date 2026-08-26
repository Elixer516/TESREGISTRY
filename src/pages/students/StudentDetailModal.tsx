import { useEffect, useState } from 'react';
import { APPLICANT_STANDING_LABELS } from '@/types';
import type { StudentView } from '@/types/views';
import { formatDate } from '@/lib/format';
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
        </dl>
      </section>

      <section>
        <SectionTitle>Contact</SectionTitle>
        <dl className="grid grid-cols-2 gap-4">
          <DescriptionItem label="Email">{student.email || '—'}</DescriptionItem>
          <DescriptionItem label="Contact number">{student.contactNumber || '—'}</DescriptionItem>
          <DescriptionItem label="Address">{student.address || '—'}</DescriptionItem>
        </dl>
      </section>

      <section>
        <SectionTitle>Academic</SectionTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DescriptionItem label="Program">
            {student.programCode} — {student.programName}
          </DescriptionItem>
          <DescriptionItem label="Curriculum">{student.curriculumName ?? 'Not assigned'}</DescriptionItem>
          <DescriptionItem label="Section">{student.sectionCode ?? '—'}</DescriptionItem>
          <DescriptionItem label="Year level">{student.yearLevel}</DescriptionItem>
          <DescriptionItem label="Last school attended">
            {student.secondarySchool || '—'}
          </DescriptionItem>
          <DescriptionItem label="Year last attended">
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
