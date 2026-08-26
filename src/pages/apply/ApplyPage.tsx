import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApplicantStanding, Program } from '@/types';
import { ALL_APPLICANT_STANDINGS, APPLICANT_STANDING_LABELS } from '@/types';
import type { ApplicationReceipt } from '@/types/views';
import { applicationsApi, catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { documentsFor } from '@/lib/enrollment-documents';
import {
  Button,
  Card,
  DescriptionItem,
  Field,
  InfoNote,
  Select,
  TextArea,
  TextInput,
} from '@/components/ui';
import { ApplyShell } from './ApplyShell';
import { Stepper, type StepDef } from './Stepper';

/**
 * The public enrollment form.
 *
 * A five-step wizard — Personal Information, Educational Background,
 * Program Choice, Contact Information, then a Save & Review step before
 * anything is sent. No file uploads happen here: an applicant signing into
 * Google would be signing into *their own* Drive, so their documents could
 * never reach the centre's. The physical requirements are brought to the
 * Registrar's Office instead, and both the review step and the receipt
 * that follows spell out exactly which ones, chosen from the standing
 * declared in step two.
 */

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  email: string;
  contactNumber: string;
  address: string;
  birthDate: string;
  birthPlace: string;
  sex: 'MALE' | 'FEMALE';
  civilStatus: string;
  nationality: string;
  applicantStanding: ApplicantStanding | '';
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  programId: string;
};

const EMPTY: FormState = {
  firstName: '',
  middleName: '',
  lastName: '',
  extensionName: '',
  email: '',
  contactNumber: '',
  address: '',
  birthDate: '',
  birthPlace: '',
  sex: 'MALE',
  civilStatus: 'Single',
  nationality: 'Filipino',
  applicantStanding: '',
  secondarySchool: '',
  secondarySchoolYearAttended: '',
  programId: '',
};

const STEPS: StepDef[] = [
  { id: 'PERSONAL', label: 'Personal Information' },
  { id: 'EDUCATION', label: 'Educational Background' },
  { id: 'PROGRAM', label: 'Program Choice' },
  { id: 'CONTACT', label: 'Contact Information' },
  { id: 'REVIEW', label: 'Save & Review' },
];

/** Fields required before the wizard will move off a given step. */
function missingFieldsFor(stepId: string, form: FormState): string[] {
  const missing: string[] = [];
  if (stepId === 'PERSONAL') {
    if (!form.firstName.trim()) missing.push('First name');
    if (!form.lastName.trim()) missing.push('Last name');
    if (!form.birthDate) missing.push('Date of birth');
  } else if (stepId === 'EDUCATION') {
    if (!form.applicantStanding) missing.push('Educational standing');
  } else if (stepId === 'PROGRAM') {
    if (!form.programId) missing.push('Program');
  } else if (stepId === 'CONTACT') {
    if (!form.email.trim()) missing.push('Email address');
    if (!form.contactNumber.trim()) missing.push('Contact number');
    if (!form.address.trim()) missing.push('Home address');
  }
  return missing;
}

export function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApplicationReceipt | null>(null);

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => catalogApi.listPrograms(),
  });

  const submit = useMutation({
    mutationFn: () => applicationsApi.submit(form),
    onSuccess: (result) => {
      setReceipt(result);
      window.scrollTo({ top: 0 });
    },
    onError: (caught) => setSubmitError(errorMessage(caught)),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (receipt) return <ApplyReceipt receipt={receipt} />;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const goToStep = (id: string) => {
    const index = STEPS.findIndex((s) => s.id === id);
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
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <ApplyShell wide>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          Apply for enrollment
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Fill this in yourself — it takes a few minutes. When you finish you will get a
          reference code, and a list of the documents to bring to the Registrar&rsquo;s Office.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line bg-surface-2 px-4 py-5 sm:px-6">
          <Stepper steps={STEPS} currentIndex={stepIndex} />
        </div>

        <form
          className="p-4 sm:p-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!isLastStep) {
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

          {step.id === 'PERSONAL' ? <PersonalStep form={form} set={set} /> : null}
          {step.id === 'EDUCATION' ? <EducationStep form={form} set={set} /> : null}
          {step.id === 'PROGRAM' ? (
            <ProgramStep form={form} set={set} programs={programs.data ?? []} />
          ) : null}
          {step.id === 'CONTACT' ? <ContactStep form={form} set={set} /> : null}
          {step.id === 'REVIEW' ? (
            <ReviewStep form={form} programs={programs.data ?? []} onEdit={goToStep} />
          ) : null}

          {stepError ? (
            <div className="mt-4">
              <InfoNote tone="danger">{stepError}</InfoNote>
            </div>
          ) : null}

          {isLastStep && submitError ? (
            <div className="mt-4" role="alert">
              <InfoNote tone="danger" title="Your application was not submitted">
                {submitError}
              </InfoNote>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              {stepIndex > 0 ? (
                <Button type="button" variant="secondary" onClick={goBack}>
                  Back
                </Button>
              ) : (
                <Link to="/apply/status" className="text-sm text-brand-text hover:underline">
                  Already applied? Check your status
                </Link>
              )}
            </div>
            {isLastStep ? (
              <Button type="submit" variant="primary" loading={submit.isPending}>
                Submit application
              </Button>
            ) : (
              <Button type="submit" variant="primary">
                Next
              </Button>
            )}
          </div>
        </form>
      </Card>
    </ApplyShell>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Personal Information                                       */
/* ------------------------------------------------------------------ */

function PersonalStep({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="First name" htmlFor="a-first" required>
        <TextInput
          id="a-first"
          value={form.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          autoComplete="given-name"
        />
      </Field>
      <Field label="Middle name" htmlFor="a-middle">
        <TextInput
          id="a-middle"
          value={form.middleName}
          onChange={(e) => set('middleName', e.target.value)}
          autoComplete="additional-name"
        />
      </Field>
      <Field label="Last name" htmlFor="a-last" required>
        <TextInput
          id="a-last"
          value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          autoComplete="family-name"
        />
      </Field>
      <Field label="Suffix" htmlFor="a-ext" hint="Jr., III, and so on. Leave blank if none.">
        <TextInput
          id="a-ext"
          value={form.extensionName}
          onChange={(e) => set('extensionName', e.target.value)}
        />
      </Field>
      <Field label="Date of birth" htmlFor="a-birth" required>
        <TextInput
          id="a-birth"
          type="date"
          value={form.birthDate}
          onChange={(e) => set('birthDate', e.target.value)}
        />
      </Field>
      <Field label="Place of birth" htmlFor="a-birthplace">
        <TextInput
          id="a-birthplace"
          value={form.birthPlace}
          onChange={(e) => set('birthPlace', e.target.value)}
        />
      </Field>
      <Field label="Sex" htmlFor="a-sex">
        <Select id="a-sex" value={form.sex} onChange={(e) => set('sex', e.target.value as 'MALE' | 'FEMALE')}>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </Select>
      </Field>
      <Field label="Civil status" htmlFor="a-civil">
        <Select id="a-civil" value={form.civilStatus} onChange={(e) => set('civilStatus', e.target.value)}>
          <option>Single</option>
          <option>Married</option>
          <option>Widowed</option>
          <option>Separated</option>
        </Select>
      </Field>
      <Field label="Nationality" htmlFor="a-nationality">
        <TextInput
          id="a-nationality"
          value={form.nationality}
          onChange={(e) => set('nationality', e.target.value)}
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Educational Background                                     */
/* ------------------------------------------------------------------ */

function EducationStep({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="What have you finished?"
        htmlFor="a-standing"
        required
        className="sm:col-span-2"
        hint="This decides which admission documents you will be asked to bring."
      >
        <Select
          id="a-standing"
          value={form.applicantStanding}
          onChange={(e) => set('applicantStanding', e.target.value as ApplicantStanding | '')}
        >
          <option value="">Select your standing…</option>
          {ALL_APPLICANT_STANDINGS.map((value) => (
            <option key={value} value={value}>
              {APPLICANT_STANDING_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      {form.applicantStanding ? (
        <div className="sm:col-span-2">
          <InfoNote tone="info" title="What you will need to bring">
            <ul className="list-inside list-disc space-y-0.5">
              {documentsFor(form.applicantStanding).map((doc) => (
                <li key={doc.type}>
                  {doc.label}
                  {doc.requirement[form.applicantStanding as ApplicantStanding] === 'OPTIONAL'
                    ? ' — may follow after enrollment'
                    : ''}
                </li>
              ))}
            </ul>
          </InfoNote>
        </div>
      ) : null}

      <Field
        label="Last school attended"
        htmlFor="a-school"
        hint="Your Senior High School, or the college you came from."
      >
        <TextInput
          id="a-school"
          value={form.secondarySchool}
          onChange={(e) => set('secondarySchool', e.target.value)}
        />
      </Field>
      <Field label="Year last attended" htmlFor="a-year">
        <TextInput
          id="a-year"
          value={form.secondarySchoolYearAttended}
          onChange={(e) => set('secondarySchoolYearAttended', e.target.value)}
          placeholder="2025"
        />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Program Choice                                             */
/* ------------------------------------------------------------------ */

function ProgramStep({
  form,
  set,
  programs,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  programs: Program[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Program" htmlFor="a-program" required className="sm:col-span-2">
        <Select id="a-program" value={form.programId} onChange={(e) => set('programId', e.target.value)}>
          <option value="">Select a program…</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} — {program.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Contact Information                                        */
/* ------------------------------------------------------------------ */

function ContactStep({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Email address" htmlFor="a-email" required>
        <TextInput
          id="a-email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </Field>
      <Field label="Contact number" htmlFor="a-contact" required>
        <TextInput
          id="a-contact"
          value={form.contactNumber}
          onChange={(e) => set('contactNumber', e.target.value)}
          autoComplete="tel"
          placeholder="0918-555-0101"
        />
      </Field>
      <Field
        label="Home address"
        htmlFor="a-address"
        required
        className="sm:col-span-2"
        hint="House number and street, barangay, municipality or city, province."
      >
        <TextArea id="a-address" value={form.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Save & Review                                              */
/* ------------------------------------------------------------------ */

function ReviewStep({
  form,
  programs,
  onEdit,
}: {
  form: FormState;
  programs: Program[];
  onEdit: (stepId: string) => void;
}) {
  const program = programs.find((p) => p.id === form.programId);
  const fullName = [form.firstName, form.middleName, form.lastName, form.extensionName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-5">
      <ReviewSection title="Personal Information" onEdit={() => onEdit('PERSONAL')}>
        <DescriptionItem label="Full name">{fullName || '—'}</DescriptionItem>
        <DescriptionItem label="Date of birth">{form.birthDate || '—'}</DescriptionItem>
        <DescriptionItem label="Place of birth">{form.birthPlace || '—'}</DescriptionItem>
        <DescriptionItem label="Sex">{form.sex === 'MALE' ? 'Male' : 'Female'}</DescriptionItem>
        <DescriptionItem label="Civil status">{form.civilStatus}</DescriptionItem>
        <DescriptionItem label="Nationality">{form.nationality || '—'}</DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Educational Background" onEdit={() => onEdit('EDUCATION')}>
        <DescriptionItem label="Standing">
          {form.applicantStanding ? APPLICANT_STANDING_LABELS[form.applicantStanding] : '—'}
        </DescriptionItem>
        <DescriptionItem label="Last school attended">{form.secondarySchool || '—'}</DescriptionItem>
        <DescriptionItem label="Year last attended">
          {form.secondarySchoolYearAttended || '—'}
        </DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Program Choice" onEdit={() => onEdit('PROGRAM')}>
        <DescriptionItem label="Program">
          {program ? `${program.code} — ${program.name}` : '—'}
        </DescriptionItem>
      </ReviewSection>

      <ReviewSection title="Contact Information" onEdit={() => onEdit('CONTACT')}>
        <DescriptionItem label="Email">{form.email || '—'}</DescriptionItem>
        <DescriptionItem label="Contact number">{form.contactNumber || '—'}</DescriptionItem>
        <DescriptionItem label="Home address">{form.address || '—'}</DescriptionItem>
      </ReviewSection>

      {form.applicantStanding ? (
        <InfoNote tone="warning" title="Bring these to the Registrar's Office">
          <p className="mb-2">
            Submitting this form does not finish your application — bring the originals below in
            person, as a {APPLICANT_STANDING_LABELS[form.applicantStanding]}:
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {documentsFor(form.applicantStanding).map((doc) => (
              <li key={doc.type}>
                {doc.label}
                {doc.requirement[form.applicantStanding as ApplicantStanding] === 'OPTIONAL'
                  ? ' — may follow after enrollment'
                  : ''}
              </li>
            ))}
          </ul>
        </InfoNote>
      ) : null}
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
  const documents = documentsFor(receipt.standing);

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
          now with the Registrar for review.
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
          <InfoNote tone="warning" title="Bring these to the Registrar's Office">
            <p className="mb-2">
              Your application is not complete until these are submitted in person. Bring the
              originals as noted — as a {APPLICANT_STANDING_LABELS[receipt.standing]}, you need:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {documents.map((doc) => (
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
