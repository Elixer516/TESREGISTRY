import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogApi, enrollmentDocumentsApi, studentsApi } from '@/api';
import type { ApplicantStanding, StudentStatus } from '@/types';
import {
  ALL_APPLICANT_STANDINGS,
  APPLICANT_STANDING_LABELS,
  SETTABLE_STATUSES,
  STUDENT_STATUS_LABELS,
} from '@/types';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { connectDrive, isConnected, renameDriveItem } from '@/lib/google-drive';
import { isDriveConfigured } from '@/config/google-drive';
import {
  BLOOD_TYPES,
  DISABILITY_OPTIONS,
  EMPLOYMENT_STATUSES,
  RELATIONSHIP_OPTIONS,
  SOCIAL_MEDIA_OPTIONS,
} from '@/lib/psgc';
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
    extensionName: '',
    email: '',
    contactNumber: '',
    address: '',
    birthDate: '',
    civilStatus: '',
    nationality: '',
    highestEducation: '',
    classification: '',
    scholarshipType: '',
    birthPlace: '',
    learnerId: '',
    applicantStanding: '' as ApplicantStanding | '',
    bloodType: '',
    employmentStatus: '',
    disability: '',
    disabilitySpecify: '',
    socialMedia: '',
    socialMediaAccount: '',
    emergencyContactLastName: '',
    emergencyContactFirstName: '',
    emergencyContactMiddleName: '',
    emergencyContactRelationship: '',
    emergencyContactNumber: '',
    emergencyContactAddress: '',
    secondarySchool: '',
    secondarySchoolYearAttended: '',
    basisOfAdmission: '',
    dateAdmitted: '',
    nstpSerialNo: '',
    specialOrderNo: '',
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
      extensionName: student.extensionName,
      email: student.email,
      contactNumber: student.contactNumber,
      address: student.address,
      birthDate: student.birthDate,
      civilStatus: student.civilStatus,
      nationality: student.nationality,
      highestEducation: student.highestEducation,
      classification: student.classification,
      scholarshipType: student.scholarshipType,
      birthPlace: student.birthPlace,
      learnerId: student.learnerId,
      applicantStanding: student.applicantStanding ?? '',
      bloodType: student.bloodType,
      employmentStatus: student.employmentStatus,
      disability: student.disability,
      disabilitySpecify: student.disabilitySpecify,
      socialMedia: student.socialMedia,
      socialMediaAccount: student.socialMediaAccount,
      emergencyContactLastName: student.emergencyContactLastName,
      emergencyContactFirstName: student.emergencyContactFirstName,
      emergencyContactMiddleName: student.emergencyContactMiddleName,
      emergencyContactRelationship: student.emergencyContactRelationship,
      emergencyContactNumber: student.emergencyContactNumber,
      emergencyContactAddress: student.emergencyContactAddress,
      secondarySchool: student.secondarySchool,
      secondarySchoolYearAttended: student.secondarySchoolYearAttended,
      basisOfAdmission: student.basisOfAdmission,
      dateAdmitted: student.dateAdmitted,
      nstpSerialNo: student.nstpSerialNo,
      specialOrderNo: student.specialOrderNo ?? '',
      yearLevel: student.yearLevel,
      sectionId: student.sectionId ?? '',
    });
    setStatus(student.status);
    setError(null);
  }, [student]);

  /**
   * Saving may also have to reach Google Drive.
   *
   * The applicant's folder is named after them, and so is every file inside
   * it, so correcting a misspelled surname without renaming both leaves the
   * record spelling their name two different ways. The local record is
   * updated first; if Drive is then unreachable the edit still stands and the
   * registrar is told what was not renamed.
   */
  const save = useMutation({
    mutationFn: async () => {
      const id = student?.id ?? '';
      const nameChanged =
        student !== null &&
        (form.firstName.trim() !== student.firstName ||
          form.middleName.trim() !== student.middleName ||
          form.lastName.trim() !== student.lastName ||
          form.extensionName.trim() !== student.extensionName);

      await studentsApi.update(id, {
        ...form,
        sectionId: form.sectionId || null,
        // '' means "not recorded", which the store keeps as null.
        applicantStanding: form.applicantStanding || null,
      });
      if (student && status !== student.status) {
        await studentsApi.setStatus(id, status);
      }

      if (!nameChanged) return { driveNote: null as string | null };

      const plan = await enrollmentDocumentsApi.planRename(id);
      const hasDriveWork = Boolean(plan.folderId) || plan.files.length > 0;
      if (!hasDriveWork || !isDriveConfigured()) return { driveNote: null };

      try {
        if (!isConnected()) await connectDrive();
        if (plan.folderId) await renameDriveItem(plan.folderId, plan.folderName);
        for (const file of plan.files) {
          await renameDriveItem(file.driveFileId, file.fileName);
        }
        return {
          driveNote: null,
          renamed: plan.files.length,
          folderName: plan.folderName,
        };
      } catch (caught) {
        return {
          driveNote: `The record was saved, but Google Drive was not renamed: ${errorMessage(caught)}`,
        };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-documents'] });
      if (result.driveNote) {
        toast.error('Saved, but not fully renamed.', result.driveNote);
      } else if ('folderName' in result && result.folderName) {
        toast.success(
          'Student record updated.',
          `Drive folder renamed to “${result.folderName}”.`,
        );
      } else {
        toast.success('Student record updated.');
      }
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
        <Field label="Extension name" htmlFor="e-ext" hint="Jr., III, etc. — optional.">
          <TextInput id="e-ext" value={form.extensionName} onChange={(e) => set('extensionName', e.target.value)} />
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
        <Field label="Civil status" htmlFor="e-cs">
          <TextInput id="e-cs" value={form.civilStatus} onChange={(e) => set('civilStatus', e.target.value)} />
        </Field>
        <Field label="Nationality" htmlFor="e-nat">
          <TextInput id="e-nat" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
        </Field>
        <Field label="Highest educational attainment" htmlFor="e-hed">
          <TextInput id="e-hed" value={form.highestEducation} onChange={(e) => set('highestEducation', e.target.value)} />
        </Field>
        <Field label="Classification" htmlFor="e-cls" hint="TESDA classification of clients.">
          <TextInput id="e-cls" value={form.classification} onChange={(e) => set('classification', e.target.value)} />
        </Field>
        <Field label="Scholarship type" htmlFor="e-sch">
          <TextInput id="e-sch" value={form.scholarshipType} onChange={(e) => set('scholarshipType', e.target.value)} />
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
        <Field label="Blood type" htmlFor="e-blood">
          <Select id="e-blood" value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
            <option value="">Unknown</option>
            {BLOOD_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Employment status" htmlFor="e-emp">
          <Select
            id="e-emp"
            value={form.employmentStatus}
            onChange={(e) => set('employmentStatus', e.target.value)}
          >
            <option value="">Not recorded</option>
            {EMPLOYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Disability" htmlFor="e-dis">
          <Select
            id="e-dis"
            value={form.disability}
            onChange={(e) => {
              set('disability', e.target.value);
              if (!e.target.value || e.target.value === 'None') set('disabilitySpecify', '');
            }}
          >
            <option value="">None declared</option>
            {DISABILITY_OPTIONS.filter((value) => value !== 'None').map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Disability detail" htmlFor="e-dis-spec">
          <TextInput
            id="e-dis-spec"
            value={form.disabilitySpecify}
            onChange={(e) => set('disabilitySpecify', e.target.value)}
            disabled={!form.disability || form.disability === 'None'}
          />
        </Field>
        <Field label="Social media" htmlFor="e-sm">
          <Select
            id="e-sm"
            value={form.socialMedia}
            onChange={(e) => {
              set('socialMedia', e.target.value);
              if (!e.target.value) set('socialMediaAccount', '');
            }}
          >
            <option value="">None</option>
            {SOCIAL_MEDIA_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Social media account" htmlFor="e-sm-acc">
          <TextInput
            id="e-sm-acc"
            value={form.socialMediaAccount}
            onChange={(e) => set('socialMediaAccount', e.target.value)}
            disabled={!form.socialMedia}
          />
        </Field>
        <Field label="Address" htmlFor="e-ad" className="sm:col-span-2" hint="Documents will not generate without this.">
          <TextArea id="e-ad" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>
      </div>

      <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Emergency contact
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Last Name" htmlFor="e-em-last">
          <TextInput
            id="e-em-last"
            value={form.emergencyContactLastName}
            onChange={(e) => set('emergencyContactLastName', e.target.value)}
          />
        </Field>
        <Field label="First Name" htmlFor="e-em-first">
          <TextInput
            id="e-em-first"
            value={form.emergencyContactFirstName}
            onChange={(e) => set('emergencyContactFirstName', e.target.value)}
          />
        </Field>
        <Field label="Middle Name" htmlFor="e-em-middle">
          <TextInput
            id="e-em-middle"
            value={form.emergencyContactMiddleName}
            onChange={(e) => set('emergencyContactMiddleName', e.target.value)}
          />
        </Field>
        <Field label="Relationship" htmlFor="e-em-rel">
          <Select
            id="e-em-rel"
            value={form.emergencyContactRelationship}
            onChange={(e) => set('emergencyContactRelationship', e.target.value)}
          >
            <option value="">Not recorded</option>
            {RELATIONSHIP_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone number" htmlFor="e-em-phone">
          <TextInput
            id="e-em-phone"
            value={form.emergencyContactNumber}
            onChange={(e) => set('emergencyContactNumber', e.target.value)}
          />
        </Field>
        <Field label="Address" htmlFor="e-em-addr">
          <TextInput
            id="e-em-addr"
            value={form.emergencyContactAddress}
            onChange={(e) => set('emergencyContactAddress', e.target.value)}
          />
        </Field>
      </div>

      <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-500">
        Transcript details
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Educational standing"
          htmlFor="e-standing"
          className="sm:col-span-2"
          hint="What they had finished before applying. This decides which admission documents apply to them."
        >
          <Select
            id="e-standing"
            value={form.applicantStanding}
            onChange={(e) => set('applicantStanding', e.target.value as ApplicantStanding | '')}
          >
            <option value="">Not recorded</option>
            {ALL_APPLICANT_STANDINGS.map((value) => (
              <option key={value} value={value}>
                {APPLICANT_STANDING_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Learner's ID" htmlFor="e-lid" hint="Government learner ID, distinct from the student number.">
          <TextInput id="e-lid" value={form.learnerId} onChange={(e) => set('learnerId', e.target.value)} />
        </Field>
        <Field label="Place of birth" htmlFor="e-bp">
          <TextInput id="e-bp" value={form.birthPlace} onChange={(e) => set('birthPlace', e.target.value)} />
        </Field>
        <Field label="Secondary school" htmlFor="e-ss">
          <TextInput id="e-ss" value={form.secondarySchool} onChange={(e) => set('secondarySchool', e.target.value)} />
        </Field>
        <Field label="Last attended" htmlFor="e-ssy" hint="Year, e.g. 2022.">
          <TextInput id="e-ssy" value={form.secondarySchoolYearAttended} onChange={(e) => set('secondarySchoolYearAttended', e.target.value)} />
        </Field>
        <Field label="Basis of admission" htmlFor="e-boa" hint='e.g. "Form 137", "Honorable Dismissal from X".'>
          <TextInput id="e-boa" value={form.basisOfAdmission} onChange={(e) => set('basisOfAdmission', e.target.value)} />
        </Field>
        <Field label="Date admitted" htmlFor="e-da">
          <TextInput id="e-da" type="date" value={form.dateAdmitted} onChange={(e) => set('dateAdmitted', e.target.value)} />
        </Field>
        <Field label="NSTP serial no." htmlFor="e-nstp">
          <TextInput id="e-nstp" value={form.nstpSerialNo} onChange={(e) => set('nstpSerialNo', e.target.value)} />
        </Field>
        <Field
          label="Special Order No."
          htmlFor="e-so"
          hint={status === 'GRADUATED' ? 'Shown on the transcript once issued.' : 'Only meaningful once the student has graduated.'}
        >
          <TextInput id="e-so" value={form.specialOrderNo} onChange={(e) => set('specialOrderNo', e.target.value)} />
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
