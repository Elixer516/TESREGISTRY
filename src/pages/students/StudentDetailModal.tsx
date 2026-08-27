import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApplicantStanding, StudentStatus } from '@/types';
import {
  ALL_APPLICANT_STANDINGS,
  APPLICANT_STANDING_LABELS,
  SETTABLE_STATUSES,
  STUDENT_STATUS_LABELS,
} from '@/types';
import type { StudentView } from '@/types/views';
import { catalogApi, studentsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import {
  BLOOD_TYPES,
  DISABILITY_OPTIONS,
  EDUCATIONAL_ATTAINMENTS,
  EMPLOYMENT_STATUSES,
  REGIONS,
  RELATIONSHIP_OPTIONS,
  SOCIAL_MEDIA_OPTIONS,
  citiesFor,
  districtsFor,
  provincesFor,
  regionName,
} from '@/lib/psgc';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, InfoNote, Modal, Select, Tabs, TextInput } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StatusBadge';
import { DocumentsPanel } from './DocumentsPanel';

type DetailTab = 'DETAILS' | 'DOCUMENTS';

/** Everything the registrar may change, as it is held while editing. */
interface EditState {
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  sex: 'MALE' | 'FEMALE';
  birthDate: string;
  civilStatus: string;
  nationality: string;
  bloodType: string;
  employmentStatus: string;
  disability: string;
  disabilitySpecify: string;
  addressRegion: string;
  addressProvince: string;
  addressCityMunicipality: string;
  addressBarangay: string;
  addressDistrict: string;
  addressStreet: string;
  birthRegion: string;
  birthProvince: string;
  birthCityMunicipality: string;
  email: string;
  contactNumber: string;
  socialMedia: string;
  socialMediaAccount: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactNumber: string;
  emergencyContactAddress: string;
  programId: string;
  highestEducation: string;
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  applicantStanding: ApplicantStanding | '';
  yearLevel: number;
  status: StudentStatus;
}

function toEditState(student: StudentView): EditState {
  return {
    firstName: student.firstName,
    middleName: student.middleName,
    lastName: student.lastName,
    extensionName: student.extensionName,
    sex: student.sex,
    birthDate: student.birthDate,
    civilStatus: student.civilStatus,
    nationality: student.nationality,
    bloodType: student.bloodType,
    employmentStatus: student.employmentStatus,
    disability: student.disability,
    disabilitySpecify: student.disabilitySpecify,
    addressRegion: student.addressRegion,
    addressProvince: student.addressProvince,
    addressCityMunicipality: student.addressCityMunicipality,
    addressBarangay: student.addressBarangay,
    addressDistrict: student.addressDistrict,
    addressStreet: student.addressStreet,
    birthRegion: student.birthRegion,
    birthProvince: student.birthProvince,
    birthCityMunicipality: student.birthCityMunicipality,
    email: student.email,
    contactNumber: student.contactNumber,
    socialMedia: student.socialMedia,
    socialMediaAccount: student.socialMediaAccount,
    emergencyContactName: student.emergencyContactName,
    emergencyContactRelationship: student.emergencyContactRelationship,
    emergencyContactNumber: student.emergencyContactNumber,
    emergencyContactAddress: student.emergencyContactAddress,
    programId: student.programId,
    highestEducation: student.highestEducation,
    secondarySchool: student.secondarySchool,
    secondarySchoolYearAttended: student.secondarySchoolYearAttended,
    applicantStanding: student.applicantStanding ?? '',
    yearLevel: student.yearLevel,
    status: student.status,
  };
}

/**
 * The student record: read it, edit it in place, and act on it.
 *
 * V9 moved Edit off the row and into here. An application arriving from the
 * public form is typed by the applicant, so the registrar's first move is
 * almost always to read it and correct something — which meant closing the
 * preview, finding the row again, and opening a second modal. Now the same
 * fields simply become editable where they are already being read.
 *
 * Approve sits on BOTH tabs on purpose. The decision is usually made while
 * looking at the admission documents, so the button is there too rather than
 * only under Details.
 */
export function StudentDetailModal({
  student: opened,
  onClose,
  onApprove,
}: {
  student: StudentView | null;
  onClose: () => void;
  onApprove?: (student: StudentView) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('DETAILS');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
    enabled: editing,
  });

  /*
   * Read the record fresh rather than trusting the row that was clicked.
   *
   * The row is a snapshot from the list query. Saving an edit here would
   * otherwise leave the modal showing the values the registrar just replaced,
   * which reads as the save having failed.
   */
  const fetched = useQuery({
    queryKey: ['student', opened?.id],
    queryFn: () => studentsApi.get(opened?.id ?? ''),
    enabled: Boolean(opened),
  });
  const student = fetched.data ?? opened;

  // Reset only when a DIFFERENT record is opened; a refetch of the same one
  // must not throw away an edit in progress.
  useEffect(() => {
    if (opened) {
      setTab('DETAILS');
      setEditing(false);
      setError(null);
    }
  }, [opened?.id]);

  // Re-seed the form whenever the record changes underneath and nothing is
  // being edited — which is what makes a saved change appear immediately.
  useEffect(() => {
    if (student && !editing) setForm(toEditState(student));
  }, [student, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!student || !form) throw new Error('Nothing to save.');
      const { status, applicantStanding, ...rest } = form;
      await studentsApi.update(student.id, {
        ...rest,
        applicantStanding: applicantStanding || null,
      });
      if (status !== student.status) await studentsApi.setStatus(student.id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', student?.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-documents'] });
      toast.success('Record updated.');
      setEditing(false);
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const set = <K extends keyof EditState>(key: K, value: EditState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const isPending = student?.status === 'PENDING';

  return (
    <Modal
      open={opened !== null}
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
      footer={
        student ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setForm(toEditState(student));
                      setEditing(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
                    Save changes
                  </Button>
                </>
              ) : (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
            {isPending && onApprove && !editing ? (
              <Button variant="primary" onClick={() => onApprove(student)}>
                Approve application
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {student && form ? (
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

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

          {tab === 'DETAILS' ? (
            <DetailsTab
              student={student}
              form={form}
              set={set}
              editing={editing}
              programs={programs.data ?? []}
            />
          ) : (
            <DocumentsPanel student={student} />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* One field, read-only or editable                                    */
/* ------------------------------------------------------------------ */

function Row({
  label,
  value,
  editing,
  children,
}: {
  label: string;
  value: string;
  editing: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">
        {editing && children ? children : value || '—'}
      </dd>
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

function DetailsTab({
  student,
  form,
  set,
  editing,
  programs,
}: {
  student: StudentView;
  form: EditState;
  set: <K extends keyof EditState>(key: K, value: EditState[K]) => void;
  editing: boolean;
  programs: Array<{ id: string; code: string; name: string }>;
}) {
  const provinces = useMemo(() => provincesFor(form.addressRegion), [form.addressRegion]);
  const cities = useMemo(
    () => citiesFor(form.addressRegion, form.addressProvince),
    [form.addressRegion, form.addressProvince],
  );
  const districts = useMemo(
    () => districtsFor(form.addressCityMunicipality),
    [form.addressCityMunicipality],
  );

  const grid = 'grid grid-cols-2 gap-4 sm:grid-cols-3';

  return (
    <div className="space-y-5">
      {editing ? (
        <InfoNote tone="info" title="Editing this record">
          Every field below can be changed except the student number and reference code —
          those identify the trainee on documents already issued.
          {student.status === 'PENDING' ? null : (
            <> The Diploma is fixed once an application is approved, since approval is what
            assigns the curriculum and section.</>
          )}
        </InfoNote>
      ) : null}

      <section>
        <SectionTitle>Standing</SectionTitle>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StudentStatusBadge status={student.status} />
          {student.isTransferee ? <Badge tone="brand">Transferee</Badge> : null}
        </div>
        <dl className={grid}>
          <Row label="Status" value={STUDENT_STATUS_LABELS[student.status]} editing={editing}>
            <Select
              value={form.status}
              onChange={(e) => set('status', e.target.value as StudentStatus)}
              disabled={student.status === 'PENDING'}
            >
              {student.status === 'PENDING' ? (
                <option value="PENDING">Pending — use Approve or Reject</option>
              ) : null}
              {SETTABLE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STUDENT_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Row>
          <Row
            label="Educational standing"
            value={
              student.applicantStanding
                ? APPLICANT_STANDING_LABELS[student.applicantStanding]
                : 'Not recorded'
            }
            editing={editing}
          >
            <Select
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
          </Row>
          <Row label="Year level" value={String(student.yearLevel)} editing={editing}>
            <Select
              value={form.yearLevel}
              onChange={(e) => set('yearLevel', Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  Year {n}
                </option>
              ))}
            </Select>
          </Row>
        </dl>
        {student.rejectionReason ? (
          <p className="mt-2 rounded-md border-l-2 border-danger bg-danger-soft px-3 py-2 text-sm text-danger-ink">
            {student.rejectionReason}
          </p>
        ) : null}
      </section>

      <section>
        <SectionTitle>Personal</SectionTitle>
        <dl className={grid}>
          <Row label="First name" value={student.firstName} editing={editing}>
            <TextInput value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Row>
          <Row label="Middle name" value={student.middleName} editing={editing}>
            <TextInput value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
          </Row>
          <Row label="Last name" value={student.lastName} editing={editing}>
            <TextInput value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
          </Row>
          <Row label="Suffix" value={student.extensionName} editing={editing}>
            <TextInput
              value={form.extensionName}
              onChange={(e) => set('extensionName', e.target.value)}
            />
          </Row>
          <Row label="Student number" value={student.studentNumber} editing={false} />
          <Row label="Sex" value={student.sex === 'MALE' ? 'Male' : 'Female'} editing={editing}>
            <Select
              value={form.sex}
              onChange={(e) => set('sex', e.target.value as 'MALE' | 'FEMALE')}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </Row>
          <Row
            label="Date of birth"
            value={student.birthDate ? formatDate(student.birthDate) : ''}
            editing={editing}
          >
            <TextInput
              type="date"
              value={form.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
            />
          </Row>
          <Row label="Civil status" value={student.civilStatus} editing={editing}>
            <Select value={form.civilStatus} onChange={(e) => set('civilStatus', e.target.value)}>
              <option>Single</option>
              <option>Married</option>
              <option>Widowed</option>
              <option>Separated</option>
            </Select>
          </Row>
          <Row label="Nationality" value={student.nationality} editing={editing}>
            <TextInput
              value={form.nationality}
              onChange={(e) => set('nationality', e.target.value)}
            />
          </Row>
          <Row label="Blood type" value={student.bloodType} editing={editing}>
            <Select value={form.bloodType} onChange={(e) => set('bloodType', e.target.value)}>
              <option value="">Unknown</option>
              {BLOOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Employment status" value={student.employmentStatus} editing={editing}>
            <Select
              value={form.employmentStatus}
              onChange={(e) => set('employmentStatus', e.target.value)}
            >
              <option value="">Not recorded</option>
              {EMPLOYMENT_STATUSES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Row>
          <Row
            label="Disability"
            value={
              student.disability
                ? `${student.disability}${
                    student.disabilitySpecify ? ` — ${student.disabilitySpecify}` : ''
                  }`
                : 'None declared'
            }
            editing={editing}
          >
            <Select value={form.disability} onChange={(e) => set('disability', e.target.value)}>
              <option value="">None declared</option>
              {DISABILITY_OPTIONS.filter((d) => d !== 'None').map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Row>
          {editing ? (
            <Row label="Disability detail" value={student.disabilitySpecify} editing>
              <TextInput
                value={form.disabilitySpecify}
                onChange={(e) => set('disabilitySpecify', e.target.value)}
                disabled={!form.disability}
              />
            </Row>
          ) : null}
        </dl>
      </section>

      <section>
        <SectionTitle>Birthplace</SectionTitle>
        <dl className={grid}>
          <Row
            label="Region"
            value={student.birthRegion ? regionName(student.birthRegion) : ''}
            editing={editing}
          >
            <Select
              value={form.birthRegion}
              onChange={(e) => {
                set('birthRegion', e.target.value);
                set('birthProvince', '');
                set('birthCityMunicipality', '');
              }}
            >
              <option value="">Select…</option>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Province" value={student.birthProvince} editing={editing}>
            <TextInput
              value={form.birthProvince}
              onChange={(e) => set('birthProvince', e.target.value)}
            />
          </Row>
          <Row label="City / Municipality" value={student.birthCityMunicipality} editing={editing}>
            <TextInput
              value={form.birthCityMunicipality}
              onChange={(e) => set('birthCityMunicipality', e.target.value)}
            />
          </Row>
        </dl>
      </section>

      <section>
        <SectionTitle>Address</SectionTitle>
        <dl className={grid}>
          <Row label="Street" value={student.addressStreet} editing={editing}>
            <TextInput
              value={form.addressStreet}
              onChange={(e) => set('addressStreet', e.target.value)}
            />
          </Row>
          <Row label="Barangay" value={student.addressBarangay} editing={editing}>
            <TextInput
              value={form.addressBarangay}
              onChange={(e) => set('addressBarangay', e.target.value)}
            />
          </Row>
          <Row
            label="Region"
            value={student.addressRegion ? regionName(student.addressRegion) : ''}
            editing={editing}
          >
            <Select
              value={form.addressRegion}
              onChange={(e) => {
                set('addressRegion', e.target.value);
                set('addressProvince', '');
                set('addressCityMunicipality', '');
                set('addressDistrict', '');
              }}
            >
              <option value="">Select…</option>
              {REGIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Province" value={student.addressProvince} editing={editing}>
            {provinces.length > 0 ? (
              <Select
                value={form.addressProvince}
                onChange={(e) => {
                  set('addressProvince', e.target.value);
                  set('addressCityMunicipality', '');
                }}
              >
                <option value="">Select…</option>
                {provinces.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={form.addressProvince}
                onChange={(e) => set('addressProvince', e.target.value)}
              />
            )}
          </Row>
          <Row
            label="City / Municipality"
            value={student.addressCityMunicipality}
            editing={editing}
          >
            {cities.length > 0 ? (
              <Select
                value={form.addressCityMunicipality}
                onChange={(e) => {
                  set('addressCityMunicipality', e.target.value);
                  set('addressDistrict', '');
                }}
              >
                <option value="">Select…</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={form.addressCityMunicipality}
                onChange={(e) => set('addressCityMunicipality', e.target.value)}
              />
            )}
          </Row>
          <Row label="District" value={student.addressDistrict} editing={editing}>
            {districts.length > 0 ? (
              <Select
                value={form.addressDistrict}
                onChange={(e) => set('addressDistrict', e.target.value)}
              >
                <option value="">Select…</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput
                value={form.addressDistrict}
                onChange={(e) => set('addressDistrict', e.target.value)}
              />
            )}
          </Row>
        </dl>
      </section>

      <section>
        <SectionTitle>Contact</SectionTitle>
        <dl className={grid}>
          <Row label="Email" value={student.email} editing={editing}>
            <TextInput
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </Row>
          <Row label="Phone number" value={student.contactNumber} editing={editing}>
            <TextInput
              value={form.contactNumber}
              onChange={(e) => set('contactNumber', e.target.value)}
            />
          </Row>
          <Row
            label="Social media"
            value={
              student.socialMedia
                ? `${student.socialMedia}${
                    student.socialMediaAccount ? ` — ${student.socialMediaAccount}` : ''
                  }`
                : ''
            }
            editing={editing}
          >
            <Select value={form.socialMedia} onChange={(e) => set('socialMedia', e.target.value)}>
              <option value="">None</option>
              {SOCIAL_MEDIA_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Row>
          {editing ? (
            <Row label="Social media account" value={student.socialMediaAccount} editing>
              <TextInput
                value={form.socialMediaAccount}
                onChange={(e) => set('socialMediaAccount', e.target.value)}
                disabled={!form.socialMedia}
              />
            </Row>
          ) : null}
        </dl>
      </section>

      <section>
        <SectionTitle>Emergency contact</SectionTitle>
        <dl className={grid}>
          <Row label="Name" value={student.emergencyContactName} editing={editing}>
            <TextInput
              value={form.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
            />
          </Row>
          <Row
            label="Relationship"
            value={student.emergencyContactRelationship}
            editing={editing}
          >
            <Select
              value={form.emergencyContactRelationship}
              onChange={(e) => set('emergencyContactRelationship', e.target.value)}
            >
              <option value="">Not recorded</option>
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Phone number" value={student.emergencyContactNumber} editing={editing}>
            <TextInput
              value={form.emergencyContactNumber}
              onChange={(e) => set('emergencyContactNumber', e.target.value)}
            />
          </Row>
          <Row label="Address" value={student.emergencyContactAddress} editing={editing}>
            <TextInput
              value={form.emergencyContactAddress}
              onChange={(e) => set('emergencyContactAddress', e.target.value)}
            />
          </Row>
        </dl>
      </section>

      <section>
        <SectionTitle>Academic</SectionTitle>
        <dl className={grid}>
          <Row
            label="Diploma"
            value={`${student.programCode} — ${student.programName}`}
            editing={editing && student.status === 'PENDING'}
          >
            <Select value={form.programId} onChange={(e) => set('programId', e.target.value)}>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Curriculum" value={student.curriculumName ?? 'Not assigned'} editing={false} />
          <Row label="Section" value={student.sectionCode ?? ''} editing={false} />
          <Row label="Educational attainment" value={student.highestEducation} editing={editing}>
            <Select
              value={form.highestEducation}
              onChange={(e) => set('highestEducation', e.target.value)}
            >
              <option value="">Not recorded</option>
              {EDUCATIONAL_ATTAINMENTS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Previous school" value={student.secondarySchool} editing={editing}>
            <TextInput
              value={form.secondarySchool}
              onChange={(e) => set('secondarySchool', e.target.value)}
            />
          </Row>
          <Row
            label="Year ended"
            value={student.secondarySchoolYearAttended}
            editing={editing}
          >
            <TextInput
              value={form.secondarySchoolYearAttended}
              onChange={(e) => set('secondarySchoolYearAttended', e.target.value)}
            />
          </Row>
        </dl>
      </section>

      <section>
        <SectionTitle>Record</SectionTitle>
        <dl className={grid}>
          <Row label="Applied" value={formatDate(student.createdAt)} editing={false} />
          <Row
            label="Approved"
            value={student.approvedAt ? formatDate(student.approvedAt) : ''}
            editing={false}
          />
          <Row
            label="Reference code"
            value={student.referenceCode || 'Encoded by the registrar'}
            editing={false}
          />
        </dl>
      </section>
    </div>
  );
}
