import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType, RequestStatus } from '@/types';
import { DOCUMENT_TYPE_LABELS } from '@/types';
import { mineApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Select, TextInput } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { Pill, PortalCard, PortalHeading } from './portal-ui';

const CHOICES: DocumentType[] = ['TOR', 'CERT_GRADES', 'CERT_ENROLLMENT', 'GSA', 'GOOD_MORAL', 'DIPLOMA', 'SPECIAL_ORDER'];

const TONE: Record<RequestStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  READY: 'success',
  RELEASED: 'neutral',
  CANCELLED: 'danger',
};
const STEPS: RequestStatus[] = ['PENDING', 'PROCESSING', 'READY', 'RELEASED'];

/**
 * Requests — ask the Registrar for a document and follow it to release.
 */
export function TraineeRequestsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>('CERT_GRADES');
  const [purpose, setPurpose] = useState('');
  const [copies, setCopies] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({ queryKey: ['my-requests'], queryFn: () => mineApi.documentRequests() });

  const submit = useMutation({
    mutationFn: () => mineApi.requestDocument({ documentType: type, purpose, copies: Number(copies) }),
    onSuccess: async (request) => {
      await queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success(`Request ${request.referenceNumber} sent.`, 'Quote this number at the Registrar’s window.');
      setPurpose('');
      setCopies('1');
      setError(null);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const withdraw = useMutation({
    mutationFn: (id: string) => mineApi.withdrawRequest(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['my-requests'] });
      toast.success('Request withdrawn.');
    },
    onError: (caught) => toast.error('Could not withdraw it.', errorMessage(caught)),
  });

  return (
    <>
      <PortalHeading
        title="Document Requests"
        description="Ask the Registrar for a document. You collect it at the Registrar’s window once it is ready for release."
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <PortalCard className="h-fit">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">New request</h3>
          <div className="space-y-3">
            <Field label="Document" htmlFor="req-type">
              <Select id="req-type" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
                {CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {DOCUMENT_TYPE_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Purpose" htmlFor="req-purpose" hint="e.g. Scholarship renewal, Employment, Transfer">
              <TextInput id="req-purpose" value={purpose} maxLength={200} onChange={(e) => setPurpose(e.target.value)} />
            </Field>
            <Field label="Copies" htmlFor="req-copies">
              <Select id="req-copies" value={copies} onChange={(e) => setCopies(e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
            <Button variant="primary" className="w-full" loading={submit.isPending} disabled={!purpose.trim()} onClick={() => submit.mutate()}>
              Send request
            </Button>
          </div>
        </PortalCard>

        <div className="min-w-0 space-y-3">
          {list.isLoading ? (
            <LoadingState label="Loading your requests…" />
          ) : list.error ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : (list.data ?? []).length === 0 ? (
            <PortalCard>
              <p className="text-sm text-ink-500">You have not requested any documents yet.</p>
            </PortalCard>
          ) : (
            (list.data ?? []).map((r) => {
              const step = STEPS.indexOf(r.status);
              return (
                <PortalCard key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">{r.documentTypeLabel}</p>
                      <p className="text-xs text-ink-500">
                        <span className="font-mono">{r.referenceNumber}</span> · {r.copies} cop{r.copies === 1 ? 'y' : 'ies'} ·{' '}
                        {r.purpose}
                      </p>
                      <p className="text-xs text-ink-500">Requested {formatDateTime(r.requestedAt)}</p>
                    </div>
                    <Pill tone={TONE[r.status]}>{r.statusLabel}</Pill>
                  </div>
                  {r.status !== 'CANCELLED' ? (
                    <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Progress">
                      {STEPS.map((s, i) => (
                        <li key={s} className="text-center">
                          <span className={`block h-1.5 rounded-full ${i <= step ? 'bg-brand' : 'bg-surface-3'}`} />
                          <span className={`mt-1 block text-[10px] ${i <= step ? 'text-ink-900' : 'text-ink-400'}`}>
                            {s === 'READY' ? 'Ready' : s.charAt(0) + s.slice(1).toLowerCase()}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {r.status === 'READY' ? (
                    <p className="mt-2 text-sm text-success-ink">Ready — collect it at the Registrar’s window and quote {r.referenceNumber}.</p>
                  ) : null}
                  {r.remarks ? <p className="mt-2 text-xs text-ink-700">Registrar’s note: {r.remarks}</p> : null}
                  {r.status === 'PENDING' ? (
                    <Button size="sm" variant="ghost" className="mt-2" loading={withdraw.isPending} onClick={() => withdraw.mutate(r.id)}>
                      Withdraw
                    </Button>
                  ) : null}
                </PortalCard>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
