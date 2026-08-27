import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { APPLICANT_STANDING_LABELS } from '@/types';
import type { ApplicationReceipt } from '@/types/views';
import { applicationsApi, catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { buildDocumentFileName, documentsFor, standingFromAttainment } from '@/lib/enrollment-documents';
import { isRelayConfigured, uploadViaRelay } from '@/lib/drive-relay';
import { composeAddress, regionName } from '@/lib/psgc';
import { Button, Card, DescriptionItem, InfoNote } from '@/components/ui';
import { ApplyShell } from './ApplyShell';
import { Stepper } from './Stepper';
import {
  APPLY_STEPS,
  EMPTY_APPLY_FORM,
  missingFieldsFor,
  type ApplyFormState,
} from './form-state';
import {
  AdditionalDetailsStep,
  ContactDetailsStep,
  DiplomaDetailsStep,
  IdentificationStep,
  MainDetailsStep,
} from './steps';

/**
 * The public enrollment form.
 *
 * Six steps, ending in a review the applicant confirms before anything is
 * sent. The two scans they attach in step 5 go to the centre's Drive through
 * an Apps Script relay — a token granted in this browser would authorise the
 * *applicant's* Drive, not the centre's, so the credential has to live
 * server-side. See `@/lib/drive-relay`.
 *
 * Submission is one-shot on purpose. Drive is written first, and only once it
 * confirms is the application recorded, so a failed upload leaves no record
 * pointing at files that do not exist. Once it succeeds the form is gone —
 * corrections are a registrar's job from here.
 */
export function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<ApplyFormState>(EMPTY_APPLY_FORM);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.idPicture || !form.birthCertificate) {
        throw new Error('Both documents are required before submitting.');
      }

      const standing = standingFromAttainment(form.highestEducation);
      const naming = {
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName,
        extensionName: form.extensionName,
      };
      const folderName = buildApplicantFolderName(naming);

      // Drive first. A record whose files never arrived is worse than no
      // record at all — the registrar would have nothing to review.
      const uploaded = await uploadViaRelay(folderName, [
        {
          slot: 'ID_PICTURE',
          fileName: buildDocumentFileName(naming, 'ID_PICTURE', form.idPicture.name),
          file: form.idPicture,
        },
        {
          slot: 'BIRTH_CERTIFICATE',
          fileName: buildDocumentFileName(
            naming,
            'BIRTH_CERTIFICATE',
            form.birthCertificate.name,
          ),
          file: form.birthCertificate,
        },
      ]);

      return applicationsApi.submit({
        firstName: form.firstName,
        middleName: form.middleName,
        lastName: form.lastName,
        extensionName: form.extensionName,
        sex: form.sex,
        birthDate: form.birthDate,
        civilStatus: form.civilStatus,
        addressRegion: form.addressRegion,
        addressProvince: form.addressProvince,
        addressCityMunicipality: form.addressCityMunicipality,
        addressBarangay: form.addressBarangay,
        addressDistrict: form.addressDistrict,
        addressStreet: form.addressStreet,
        birthRegion: form.birthRegion,
        birthProvince: form.birthProvince,
        birthCityMunicipality: form.birthCityMunicipality,
        bloodType: form.bloodType,
        highestEducation: form.highestEducation,
        secondarySchool: form.secondarySchool,
        secondarySchoolYearAttended: form.secondarySchoolYearAttended,
        employmentStatus: form.employmentStatus,
        disability: form.disability === 'None' ? '' : form.disability,
        disabilitySpecify: form.disabilitySpecify,
        email: form.email,
        contactNumber: form.contactNumber,
        socialMedia: form.socialMedia,
        socialMediaAccount: form.socialMediaAccount,
        emergencyContactName: form.emergencyContactName,
        emergencyContactRelationship: form.emergencyContactRelationship,
        emergencyContactNumber: form.emergencyContactNumber,
        emergencyContactAddress: form.emergencyContactAddress,
        programId: form.programId,
        driveFolderId: uploaded.folderId,
        documents: uploaded.files.map((file) => ({
          documentType: file.slot,
          fileName: file.fileName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          driveFileId: file.fileId,
          driveWebViewLink: file.webViewLink,
        })),
      }).then((result) => ({ result, standing }));
    },
    onSuccess: ({ result }) => {
      setReceipt(result);
      window.scrollTo({ top: 0 });
    },
    onError: (caught) => setSubmitError(errorMessage(caught)),
  });

  const set = <K extends keyof ApplyFormState>(key: K, value: ApplyFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (receipt) return <ApplyReceipt receipt={receipt} />;

  const step = APPLY_STEPS[stepIndex];
  const isReview = step.id === 'REVIEW';
  const locked = submit.isPending;

  const goToStep = (id: string) => {
    const index = APPLY_STEPS.findIndex((s) => s.id === id);
    if (index >= 0) {
      setStepError(null);
      setStepIndex(index);
    }
  };

  const goNext = () => {
    const missing = missingFieldsFor(step.id, form);
    if (missing.length > 0) {
      setStepError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    setStepError(null);
    setStepIndex((i) => Math.min(i + 1, APPLY_STEPS.length - 1));
  };

  return (
    <ApplyShell wide>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          Registration Form
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Fill this in yourself — it takes a few minutes. You will need a photo of your ID and a
          scan of your Birth Certificate, and you will get a reference code at the end.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-4 py-5 sm:px-6">
          <Stepper steps={APPLY_STEPS} currentIndex={stepIndex} />
        </div>

        <form
          className="p-4 sm:p-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!isReview) {
              goNext();
              return;
            }
            setSubmitError(null);
            submit.mutate();
          }}
        >
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-brand-text">
            {step.label}
          </h2>

          {step.id === 'MAIN' ? <MainDetailsStep form={form} set={set} /> : null}
          {step.id === 'ADDITIONAL' ? <AdditionalDetailsStep form={form} set={set} /> : null}
          {step.id === 'CONTACT' ? <ContactDetailsStep form={form} set={set} /> : null}
          {step.id === 'DIPLOMA' ? (
            <DiplomaDetailsStep form={form} set={set} programs={programs.data ?? []} />
          ) : null}
          {step.id === 'IDENTIFICATION' ? (
            <IdentificationStep form={form} set={set} disabled={locked} />
          ) : null}
          {isReview ? (
            <ReviewStep form={form} programs={programs.data ?? []} onEdit={goToStep} />
          ) : null}

          {stepError ? (
            <div className="mt-4">
              <InfoNote tone="danger">{stepError}</InfoNote>
            </div>
          ) : null}

          {isReview && submitError ? (
            <div className="mt-4" role="alert">
              <InfoNote tone="danger" title="Nothing was submitted">
                {submitError}
              </InfoNote>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={locked}
                  onClick={() => {
                    setStepError(null);
                    setStepIndex((i) => Math.max(i - 1, 0));
                  }}
                >
                  Back
                </Button>
              ) : (
                <Link to="/apply/status" className="text-sm text-brand-text hover:underline">
                  Already applied? Check your status
                </Link>
              )}
            </div>
            <Button type="submit" variant="primary" loading={locked}>
              {isReview ? 'Submit application' : 'Next'}
            </Button>
          </div>
        </form>
      </Card>
    </ApplyShell>
  );
}

/**
 * "LASTNAME, FIRSTNAME M." — the same shape the registrar's own uploads use,
 * so an applicant's folder and a registrar's resolve to one folder in Drive
 * rather than two spellings of the same person.
 */
function buildApplicantFolderName(person: {
  firstName: string;
  lastName: string;
  middleName: string;
  extensionName: string;
}): string {
  const middleInitial = person.middleName.trim()
    ? ` ${person.middleName.trim().charAt(0).toUpperCase()}.`
    : '';
  const suffix = person.extensionName.trim() ? ` ${person.extensionName.trim()}` : '';
  return `${person.lastName.trim().toUpperCase()}, ${person.firstName.trim().toUpperCase()}${middleInitial}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* 6 — Review                                                          */
/* ------------------------------------------------------------------ */

function ReviewStep({
  form,
  programs,
  onEdit,
}: {
  form: ApplyFormState;
  programs: Array<{ id: string; code: string; name: string }>;
  onEdit: (stepId: string) => void;
}) {
  const program = programs.find((p) => p.id === form.programId);
  const fullName = [form.firstName, form.middleName, form.lastName, form.extensionName]
    .filter(Boolean)
    .join(' ');
  const standing = form.highestEducation
    ? standingFromAttainment(form.highestEducation)
    : null;

  return (
    <div className="space-y-5">
      {!isRelayConfigured() ? (
        <InfoNote tone="danger" title="Online upload is not configured">
          This build has no upload service set, so your documents cannot be filed and the form
          cannot be submitted. Please contact the Registrar&rsquo;s Office.
        </InfoNote>
      ) : null}

      <ReviewSection title="Main Details" onEdit={() => onEdit('MAIN')}>
        <DescriptionItem label="Full name">{fullName || '—'}</DescriptionItem>
        <DescriptionItem label="Sex">{form.sex === 'MALE' ? 'Male' : 'Female'}</DescriptionItem>
        <DescriptionItem label="Birthdate">{form.birthDate || '—'}</DescriptionItem>
        <DescriptionItem label="Civil status">{form.civilStatus}</DescriptionItem>
        <DescriptionItem label="Address">
          {composeAddress({
            street: form.addressStreet,
            barangay: form.addressBarangay,
            cityMunicipality: form.addressCityMunicipality,
            province: form.addressProvince,
            regionCode: form.addressRegion,
          }) || '—'}
        </DescriptionItem>
        <DescriptionItem label="Region">
          {form.addressRegion ? regionName(form.addressRegion) : '—'}
        </DescriptionItem>
        <DescriptionItem label="District">{form.addressDistrict || '—'}</DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Additional Details" onEdit={() => onEdit('ADDITIONAL')}>
        <DescriptionItem label="Birthplace">
          {[form.birthCityMunicipality, form.birthProvince].filter(Boolean).join(', ') || '—'}
        </DescriptionItem>
        <DescriptionItem label="Blood type">{form.bloodType || '—'}</DescriptionItem>
        <DescriptionItem label="Educational attainment">
          {form.highestEducation || '—'}
        </DescriptionItem>
        <DescriptionItem label="Previous school">{form.secondarySchool || '—'}</DescriptionItem>
        <DescriptionItem label="Year ended">
          {form.secondarySchoolYearAttended || '—'}
        </DescriptionItem>
        <DescriptionItem label="Employment status">{form.employmentStatus || '—'}</DescriptionItem>
        <DescriptionItem label="Disability">
          {form.disability === 'None' || !form.disability
            ? 'None'
            : `${form.disability}${form.disabilitySpecify ? ` — ${form.disabilitySpecify}` : ''}`}
        </DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Contact Details" onEdit={() => onEdit('CONTACT')}>
        <DescriptionItem label="Email">{form.email || '—'}</DescriptionItem>
        <DescriptionItem label="Phone number">{form.contactNumber || '—'}</DescriptionItem>
        <DescriptionItem label="Social media">
          {form.socialMedia ? `${form.socialMedia} — ${form.socialMediaAccount || '—'}` : '—'}
        </DescriptionItem>
        <DescriptionItem label="Emergency contact">
          {form.emergencyContactName || '—'}
          {form.emergencyContactRelationship ? ` (${form.emergencyContactRelationship})` : ''}
        </DescriptionItem>
        <DescriptionItem label="Emergency number">
          {form.emergencyContactNumber || '—'}
        </DescriptionItem>
        <DescriptionItem label="Emergency address">
          {form.emergencyContactAddress || '—'}
        </DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Diploma Details" onEdit={() => onEdit('DIPLOMA')}>
        <DescriptionItem label="Diploma">
          {program ? `${program.code} — ${program.name}` : '—'}
        </DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Identification Details" onEdit={() => onEdit('IDENTIFICATION')}>
        <DescriptionItem label="ID Picture">{form.idPicture?.name ?? '—'}</DescriptionItem>
        <DescriptionItem label="Birth Certificate/NSO">
          {form.birthCertificate?.name ?? '—'}
        </DescriptionItem>
      </ReviewSection>

      {standing ? (
        <InfoNote tone="warning" title="Bring these to the Registrar's Office">
          <p className="mb-2">
            Submitting this form starts your application; it is not complete until the rest of
            your documents are handed in personally. As a{' '}
            {APPLICANT_STANDING_LABELS[standing]}, you still need:
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {documentsFor(standing)
              .filter((doc) => doc.type !== 'ID_PICTURE' && doc.type !== 'BIRTH_CERTIFICATE')
              .map((doc) => (
                <li key={doc.type}>
                  {doc.label}
                  {doc.requirement[standing] === 'OPTIONAL'
                    ? ' — may follow after enrollment'
                    : ''}
                </li>
              ))}
          </ul>
        </InfoNote>
      ) : null}

      <InfoNote tone="danger" title="This cannot be undone">
        Submitting files your ID Picture and Birth Certificate to the centre&rsquo;s records and
        closes this form. You will not be able to edit it or upload again — corrections after
        this point have to go through the Registrar&rsquo;s Office.
      </InfoNote>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-semibold text-brand-text hover:underline"
        >
          Edit
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Receipt                                                             */
/* ------------------------------------------------------------------ */

function ApplyReceipt({ receipt }: { receipt: ApplicationReceipt }) {
  const remaining = documentsFor(receipt.standing).filter(
    (doc) => doc.type !== 'ID_PICTURE' && doc.type !== 'BIRTH_CERTIFICATE',
  );

  return (
    <ApplyShell>
      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-success-ink">
          Application received
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink-900">
          Thank you, {receipt.fullName}.
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Your application for <strong className="text-ink-900">{receipt.programName}</strong> is
          now with the Registrar for review. Your ID Picture and Birth Certificate have been
          filed.
        </p>

        <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Your reference code
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-ink-900">
            {receipt.referenceCode}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Write this down. You will need it to check your status.
          </p>
        </div>

        <div className="mt-5">
          <InfoNote tone="warning" title="Still to bring to the Registrar's Office">
            <p className="mb-2">
              As a {APPLICANT_STANDING_LABELS[receipt.standing]}, submit these in person to
              complete your application:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {remaining.map((doc) => (
                <li key={doc.type}>
                  {doc.label}
                  {doc.requirement[receipt.standing] === 'OPTIONAL'
                    ? ' — may follow after enrollment'
                    : ''}
                </li>
              ))}
            </ul>
          </InfoNote>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/apply/status">
            <Button variant="secondary">Check application status</Button>
          </Link>
          <Button variant="ghost" onClick={() => window.print()}>
            Print this page
          </Button>
        </div>
      </Card>
    </ApplyShell>
  );
}
