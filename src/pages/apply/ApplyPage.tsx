import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApplicantStanding } from '@/types';
import { ALL_APPLICANT_STANDINGS, APPLICANT_STANDING_LABELS } from '@/types';
import type { ApplicationReceipt } from '@/types/views';
import { applicationsApi, catalogApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { documentsFor } from '@/lib/enrollment-documents';
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Select,
  TextArea,
  TextInput,
} from '@/components/ui';
import { ApplyShell } from './ApplyShell';

/**
 * The public enrollment form.
 *
 * Personal data only — no file uploads. An applicant signing into Google
 * would be signing into *their own* Drive, so their documents could never
 * reach the centre's. The physical requirements are brought to the Registrar's
 * Office instead, and the receipt below tells them exactly which ones, chosen
 * from the standing they declare here.
 */

const EMPTY = {
  firstName: '',
  middleName: '',
  lastName: '',
  extensionName: '',
  email: '',
  contactNumber: '',
  address: '',
  birthDate: '',
  birthPlace: '',
  sex: 'MALE' as 'MALE' | 'FEMALE',
  civilStatus: 'Single',
  nationality: 'Filipino',
  applicantStanding: '' as ApplicantStanding | '',
  secondarySchool: '',
  secondarySchoolYearAttended: '',
  programId: '',
};

export function ApplyPage() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
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
    onError: (caught) => setError(errorMessage(caught)),
  });

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  if (receipt) return <ApplyReceipt receipt={receipt} />;

  return (
    <ApplyShell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          Apply for enrollment
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Fill this in yourself — it takes a few minutes. When you finish you will get a
          reference code, and a list of the documents to bring to the Registrar&rsquo;s Office.
        </p>
      </div>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          submit.mutate();
        }}
      >
        <Card>
          <CardHeader title="Personal information" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
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
              <Select
                id="a-sex"
                value={form.sex}
                onChange={(e) => set('sex', e.target.value as 'MALE' | 'FEMALE')}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field label="Civil status" htmlFor="a-civil">
              <Select
                id="a-civil"
                value={form.civilStatus}
                onChange={(e) => set('civilStatus', e.target.value)}
              >
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
        </Card>

        <Card>
          <CardHeader title="How to reach you" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
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
              className="sm:col-span-2"
              hint="House number and street, barangay, municipality or city, province."
            >
              <TextArea
                id="a-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Educational background"
            description="Your standing decides which documents you will be asked to submit."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field
              label="What have you finished?"
              htmlFor="a-standing"
              required
              className="sm:col-span-2"
            >
              <Select
                id="a-standing"
                value={form.applicantStanding}
                onChange={(e) =>
                  set('applicantStanding', e.target.value as ApplicantStanding | '')
                }
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
                        {doc.requirement[form.applicantStanding as ApplicantStanding] ===
                        'OPTIONAL'
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
        </Card>

        <Card>
          <CardHeader title="Program you are applying for" />
          <div className="p-4">
            <Field label="Program" htmlFor="a-program" required>
              <Select
                id="a-program"
                value={form.programId}
                onChange={(e) => set('programId', e.target.value)}
              >
                <option value="">Select a program…</option>
                {(programs.data ?? []).map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.code} — {program.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-3 text-sm text-danger-ink"
          >
            <p className="font-semibold">Your application was not submitted</p>
            <p className="mt-0.5">{error}</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <Link to="/apply/status" className="text-sm text-brand-text hover:underline">
            Already applied? Check your status
          </Link>
          <Button type="submit" variant="primary" loading={submit.isPending}>
            Submit application
          </Button>
        </div>
      </form>
    </ApplyShell>
  );
}

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
