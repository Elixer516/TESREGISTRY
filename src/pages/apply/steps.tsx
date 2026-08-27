/**
 * The individual steps of the enrollment wizard.
 *
 * Each is a pure function of the form state plus a setter — no data fetching,
 * no submission logic. That keeps `ApplyPage` responsible for flow and these
 * responsible only for fields.
 */

import type { Program } from '@/types';
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
} from '@/lib/psgc';
import { Field, InfoNote, Select, TextInput } from '@/components/ui';
import { FileDropZone } from './FileDropZone';
import type { ApplyFormState } from './form-state';

export type Setter = <K extends keyof ApplyFormState>(
  key: K,
  value: ApplyFormState[K],
) => void;

interface StepProps {
  form: ApplyFormState;
  set: Setter;
}

/**
 * A place field that becomes a dropdown when we have the list and a text box
 * when we do not — the dataset is complete for Davao Region and thinner
 * elsewhere, and an empty dropdown would be a dead end.
 */
function PlaceField({
  label,
  id,
  options,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  id: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  if (options.length === 0) {
    return (
      <Field label={label} htmlFor={id} required={required}>
        <TextInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </Field>
    );
  }
  return (
    <Field label={label} htmlFor={id} required={required}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* 1 — Main Details                                                    */
/* ------------------------------------------------------------------ */

export function MainDetailsStep({ form, set }: StepProps) {
  const provinces = provincesFor(form.addressRegion);
  const cities = citiesFor(form.addressRegion, form.addressProvince);
  const districts = districtsFor(form.addressCityMunicipality);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="First name" htmlFor="m-first" required>
          <TextInput
            id="m-first"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Suffix" htmlFor="m-suffix">
          <Select
            id="m-suffix"
            value={form.extensionName}
            onChange={(e) => set('extensionName', e.target.value)}
          >
            <option value="">None</option>
            <option>Jr.</option>
            <option>Sr.</option>
            <option>II</option>
            <option>III</option>
            <option>IV</option>
          </Select>
        </Field>
        <Field label="Middle name" htmlFor="m-middle">
          <TextInput
            id="m-middle"
            value={form.middleName}
            onChange={(e) => set('middleName', e.target.value)}
            autoComplete="additional-name"
          />
        </Field>
        <Field label="Last name" htmlFor="m-last" required>
          <TextInput
            id="m-last"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            autoComplete="family-name"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sex" htmlFor="m-sex">
          <Select
            id="m-sex"
            value={form.sex}
            onChange={(e) => set('sex', e.target.value as 'MALE' | 'FEMALE')}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </Field>
        <Field label="Birthdate" htmlFor="m-birth" required>
          <TextInput
            id="m-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </Field>
        <Field label="Civil Status" htmlFor="m-civil">
          <Select
            id="m-civil"
            value={form.civilStatus}
            onChange={(e) => set('civilStatus', e.target.value)}
          >
            <option>Single</option>
            <option>Married</option>
            <option>Widowed</option>
            <option>Separated</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Region" htmlFor="m-region" required>
          <Select
            id="m-region"
            value={form.addressRegion}
            onChange={(e) => {
              // The narrower fields describe the old region, so they go.
              set('addressRegion', e.target.value);
              set('addressProvince', '');
              set('addressCityMunicipality', '');
              set('addressDistrict', '');
            }}
          >
            <option value="">Select…</option>
            {REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </Select>
        </Field>

        <PlaceField
          label="Province"
          id="m-province"
          options={provinces}
          value={form.addressProvince}
          onChange={(value) => {
            set('addressProvince', value);
            set('addressCityMunicipality', '');
            set('addressDistrict', '');
          }}
          placeholder={form.addressRegion === 'NCR' ? 'Not applicable' : undefined}
        />

        <PlaceField
          label="City/Municipality"
          id="m-city"
          options={cities}
          value={form.addressCityMunicipality}
          required
          onChange={(value) => {
            set('addressCityMunicipality', value);
            set('addressDistrict', '');
          }}
        />

        <Field label="Barangay" htmlFor="m-barangay" required>
          <TextInput
            id="m-barangay"
            value={form.addressBarangay}
            onChange={(e) => set('addressBarangay', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <PlaceField
          label="District"
          id="m-district"
          options={districts}
          value={form.addressDistrict}
          onChange={(value) => set('addressDistrict', value)}
        />
        <Field label="Street" htmlFor="m-street" className="sm:col-span-2">
          <TextInput
            id="m-street"
            value={form.addressStreet}
            onChange={(e) => set('addressStreet', e.target.value)}
            placeholder="House number and street"
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 — Additional Details                                              */
/* ------------------------------------------------------------------ */

export function AdditionalDetailsStep({ form, set }: StepProps) {
  const provinces = provincesFor(form.birthRegion);
  const cities = citiesFor(form.birthRegion, form.birthProvince);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Birth Region" htmlFor="a-bregion">
          <Select
            id="a-bregion"
            value={form.birthRegion}
            onChange={(e) => {
              set('birthRegion', e.target.value);
              set('birthProvince', '');
              set('birthCityMunicipality', '');
            }}
          >
            <option value="">Select…</option>
            {REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </Select>
        </Field>
        <PlaceField
          label="Birth Province"
          id="a-bprovince"
          options={provinces}
          value={form.birthProvince}
          onChange={(value) => {
            set('birthProvince', value);
            set('birthCityMunicipality', '');
          }}
        />
        <PlaceField
          label="Birth City/Municipality"
          id="a-bcity"
          options={cities}
          value={form.birthCityMunicipality}
          onChange={(value) => set('birthCityMunicipality', value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Blood Type" htmlFor="a-blood">
          <Select
            id="a-blood"
            value={form.bloodType}
            onChange={(e) => set('bloodType', e.target.value)}
          >
            <option value="">Unknown</option>
            {BLOOD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Educational Attainment"
          htmlFor="a-attainment"
          required
          className="sm:col-span-2"
          hint="This decides which admission documents you will be asked to bring."
        >
          <Select
            id="a-attainment"
            value={form.highestEducation}
            onChange={(e) => set('highestEducation', e.target.value)}
          >
            <option value="">Select…</option>
            {EDUCATIONAL_ATTAINMENTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Previous School" htmlFor="a-school">
          <TextInput
            id="a-school"
            value={form.secondarySchool}
            onChange={(e) => set('secondarySchool', e.target.value)}
          />
        </Field>
        <Field label="Year Ended" htmlFor="a-year">
          <TextInput
            id="a-year"
            value={form.secondarySchoolYearAttended}
            onChange={(e) => set('secondarySchoolYearAttended', e.target.value)}
            placeholder="2025"
            inputMode="numeric"
          />
        </Field>
        <Field label="Employment Status" htmlFor="a-employment" required>
          <Select
            id="a-employment"
            value={form.employmentStatus}
            onChange={(e) => set('employmentStatus', e.target.value)}
          >
            <option value="">Select…</option>
            {EMPLOYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Disability" htmlFor="a-disability">
          <Select
            id="a-disability"
            value={form.disability}
            onChange={(e) => {
              set('disability', e.target.value);
              if (e.target.value === 'None') set('disabilitySpecify', '');
            }}
          >
            {DISABILITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Specify"
          htmlFor="a-specify"
          hint={
            form.disability === 'None'
              ? 'Only needed if a disability is selected.'
              : 'Anything the centre should know to support you.'
          }
        >
          <TextInput
            id="a-specify"
            value={form.disabilitySpecify}
            onChange={(e) => set('disabilitySpecify', e.target.value)}
            disabled={form.disability === 'None'}
          />
        </Field>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3 — Contact Details                                                 */
/* ------------------------------------------------------------------ */

export function ContactDetailsStep({ form, set }: StepProps) {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Personal Contact Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="c-email" required>
            <TextInput
              id="c-email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Phone Number" htmlFor="c-phone" required>
            <TextInput
              id="c-phone"
              value={form.contactNumber}
              onChange={(e) => set('contactNumber', e.target.value)}
              autoComplete="tel"
              placeholder="0918-555-0101"
            />
          </Field>
          <Field label="Social Media" htmlFor="c-social">
            <Select
              id="c-social"
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
          <Field label="Social Media Account" htmlFor="c-social-account">
            <TextInput
              id="c-social-account"
              value={form.socialMediaAccount}
              onChange={(e) => set('socialMediaAccount', e.target.value)}
              disabled={!form.socialMedia}
              placeholder={form.socialMedia ? 'Your username or handle' : 'Pick a platform first'}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Emergency Contact Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="c-em-name" required>
            <TextInput
              id="c-em-name"
              value={form.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
            />
          </Field>
          <Field label="Relationship" htmlFor="c-em-rel" required>
            <Select
              id="c-em-rel"
              value={form.emergencyContactRelationship}
              onChange={(e) => set('emergencyContactRelationship', e.target.value)}
            >
              <option value="">Select…</option>
              {RELATIONSHIP_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phone Number" htmlFor="c-em-phone" required>
            <TextInput
              id="c-em-phone"
              value={form.emergencyContactNumber}
              onChange={(e) => set('emergencyContactNumber', e.target.value)}
              placeholder="0918-555-0101"
            />
          </Field>
          <Field label="Address" htmlFor="c-em-address">
            <TextInput
              id="c-em-address"
              value={form.emergencyContactAddress}
              onChange={(e) => set('emergencyContactAddress', e.target.value)}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4 — Diploma Details                                                 */
/* ------------------------------------------------------------------ */

export function DiplomaDetailsStep({
  form,
  set,
  programs,
}: StepProps & { programs: Program[] }) {
  const chosen = programs.find((p) => p.id === form.programId);

  return (
    <div className="space-y-5">
      <Field
        label="Diploma"
        htmlFor="apply-diploma"
        required
        hint="The centre offers eight three-year Diplomas. Choose the one you are applying to."
      >
        <Select
          id="apply-diploma"
          value={form.programId}
          onChange={(e) => set('programId', e.target.value)}
        >
          <option value="">Select a Diploma…</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} — {program.name}
            </option>
          ))}
        </Select>
      </Field>

      {chosen ? (
        <InfoNote tone="info" title={chosen.name}>
          <p>{chosen.description}</p>
          <p className="mt-1.5">
            {chosen.yearsToComplete} years — five academic semesters and one semester of
            internship.
          </p>
        </InfoNote>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 — Identification Details                                          */
/* ------------------------------------------------------------------ */

export function IdentificationStep({
  form,
  set,
  disabled,
}: StepProps & { disabled?: boolean }) {
  return (
    <div className="space-y-5">
      <InfoNote tone="warning" title="You get one chance at this">
        These two files are filed to the centre&rsquo;s records the moment you submit, and the
        form cannot be edited afterwards. Check they are the right scans and that they are
        readable before you go on.
      </InfoNote>

      <FileDropZone
        label="ID Picture"
        hint="a clear 2×2 photo"
        accept={['.jpg', '.jpeg', '.png']}
        file={form.idPicture}
        onChange={(file) => set('idPicture', file)}
        disabled={disabled}
      />

      <FileDropZone
        label="Birth Certificate/NSO"
        hint="PSA-issued preferred"
        accept={['.pdf', '.jpg', '.jpeg', '.png']}
        file={form.birthCertificate}
        onChange={(file) => set('birthCertificate', file)}
        disabled={disabled}
      />
    </div>
  );
}
