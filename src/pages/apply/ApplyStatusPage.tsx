import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import type { ApplicationStatusView } from '@/types/views';
import { applicationsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { Button, Card, Field, InfoNote, TextInput } from '@/components/ui';
import { StudentStatusBadge } from '@/components/StatusBadge';
import { ApplyShell } from './ApplyShell';

/**
 * Status lookup by reference code.
 *
 * What comes back is deliberately thin — a six-character code is short enough
 * to guess at, so this confirms an application exists and where it stands
 * without handing anyone the applicant's contact details.
 */
export function ApplyStatusPage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ApplicationStatusView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: () => applicationsApi.lookup(code),
    onSuccess: (found) => {
      setResult(found);
      setError(null);
    },
    onError: (caught) => {
      setResult(null);
      setError(errorMessage(caught));
    },
  });

  return (
    <ApplyShell>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
          Check your application
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter the reference code you were given when you submitted the form.
        </p>
      </div>

      <Card className="p-5">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            lookup.mutate();
          }}
        >
          <Field label="Reference code" htmlFor="s-code" required>
            <TextInput
              id="s-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="RS-2026-A7K3QF"
              className="font-mono tracking-wider"
              autoComplete="off"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={lookup.isPending}
            disabled={!code.trim()}
          >
            Check status
          </Button>
        </form>

        {error ? (
          <div className="mt-4">
            <InfoNote tone="danger" title="Not found">
              {error}
            </InfoNote>
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm font-semibold text-ink-900">
                {result.referenceCode}
              </p>
              <StudentStatusBadge status={result.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">Applicant</dt>
                <dd className="font-medium text-ink-900">{result.maskedName}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Submitted</dt>
                <dd className="font-medium text-ink-900">{formatDate(result.submittedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-ink-500">Program</dt>
                <dd className="font-medium text-ink-900">{result.programName}</dd>
              </div>
            </dl>

            {result.rejectionReason ? (
              <div className="mt-3">
                <InfoNote tone="danger" title="Reason given">
                  {result.rejectionReason}
                </InfoNote>
              </div>
            ) : result.status === 'PENDING' ? (
              <p className="mt-3 text-sm text-ink-500">
                Your application is in the queue. It is not complete until you have submitted
                your documents at the Registrar&rsquo;s Office.
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="mt-4">
        <InfoNote tone="info" title="Prototype limitation">
          This build keeps its records in the browser&rsquo;s memory, so a reference code only
          resolves during the same session it was issued in. Reloading the page starts the
          demonstration data over.
        </InfoNote>
      </div>

      <p className="mt-4 text-sm">
        <Link to="/apply" className="text-brand-text hover:underline">
          ← Back to the application form
        </Link>
      </p>
    </ApplyShell>
  );
}
