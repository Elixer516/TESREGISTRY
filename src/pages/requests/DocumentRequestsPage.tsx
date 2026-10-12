import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RequestStatus } from '@/types';
import type { DocumentRequestView } from '@/types/views';
import { documentRequestsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime, relativeTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Card, Field, InfoNote, Modal, PageHeader, Table, TableWrap, Tabs, Td, TextArea, Th } from '@/components/ui';
import { QueryState } from '@/components/states';

type TabValue = 'OPEN' | 'RELEASED' | 'CANCELLED' | 'ALL';

const TONES: Record<RequestStatus, 'warning' | 'info' | 'success' | 'neutral' | 'danger'> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  READY: 'success',
  RELEASED: 'neutral',
  CANCELLED: 'danger',
};

/** The next step for each status, as the button reads. */
const NEXT_STEP: Partial<Record<RequestStatus, { to: RequestStatus; label: string }>> = {
  PENDING: { to: 'PROCESSING', label: 'Start processing' },
  PROCESSING: { to: 'READY', label: 'Ready for release' },
  READY: { to: 'RELEASED', label: 'Mark released' },
};

/** Where each document is printed from, so the Registrar can go straight there. */
const MADE_AT: Partial<Record<DocumentRequestView['documentType'], { to: string; label: string }>> = {
  TOR: { to: '/transcript', label: 'Transcript & Graduation' },
  CERT_GRADES: { to: '/evaluation', label: 'Grade Evaluation' },
  GSA: { to: '/gsa', label: 'GSA' },
};

/**
 * Document requests from the trainee portal, worked through to release:
 * Pending → Processing → Ready for release → Released, or Cancelled with a
 * reason the trainee reads.
 */
export function DocumentRequestsPage() {
  const [tab, setTab] = useState<TabValue>('OPEN');
  const [cancelling, setCancelling] = useState<DocumentRequestView | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const all = useQuery({ queryKey: ['document-requests', 'ALL'], queryFn: () => documentRequestsApi.list('ALL') });
  const rows = (all.data ?? []).filter((r) =>
    tab === 'ALL' ? true : tab === 'OPEN' ? ['PENDING', 'PROCESSING', 'READY'].includes(r.status) : r.status === tab,
  );

  const move = useMutation({
    mutationFn: (input: { id: string; to: RequestStatus; remarks?: string }) =>
      documentRequestsApi.update(input.id, input.to, input.remarks),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`${request.referenceNumber}: ${request.statusLabel}.`);
      setCancelling(null);
    },
    onError: (caught) => toast.error('Could not update the request.', errorMessage(caught)),
  });

  const count = (pred: (r: DocumentRequestView) => boolean) => (all.data ?? []).filter(pred).length;

  return (
    <>
      <PageHeader
        title="Document Requests"
        description="Requests trainees made from their portal. Work each one through to release; the trainee sees its status as it moves."
      />
      <div className="mb-4">
        <Tabs<TabValue>
          ariaLabel="Request status"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'OPEN', label: 'Open', count: count((r) => ['PENDING', 'PROCESSING', 'READY'].includes(r.status)) },
            { value: 'RELEASED', label: 'Released', count: count((r) => r.status === 'RELEASED') },
            { value: 'CANCELLED', label: 'Cancelled', count: count((r) => r.status === 'CANCELLED') },
            { value: 'ALL', label: 'All' },
          ]}
        />
      </div>

      <QueryState
        isLoading={all.isLoading}
        error={all.error}
        isEmpty={rows.length === 0}
        onRetry={() => all.refetch()}
        emptyTitle={tab === 'OPEN' ? 'Nothing waiting' : 'No requests here'}
        emptyHint="Trainees request documents from the Requests tab of their portal."
      >
        <Card>
          <TableWrap>
            <Table className="min-w-[56rem]">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Trainee</Th>
                  <Th>Document</Th>
                  <Th>Purpose</Th>
                  <Th>Requested</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const next = NEXT_STEP[r.status];
                  const madeAt = MADE_AT[r.documentType];
                  return (
                    <tr key={r.id} className="align-top">
                      <Td className="font-mono text-xs">{r.referenceNumber}</Td>
                      <Td>
                        <span className="block font-medium text-ink-900">{r.studentName}</span>
                        <span className="block text-xs text-ink-500">
                          {r.studentNumber} · {r.programCode}
                        </span>
                      </Td>
                      <Td>
                        <span className="block text-ink-900">{r.documentTypeLabel}</span>
                        <span className="block text-xs text-ink-500">
                          {r.copies} cop{r.copies === 1 ? 'y' : 'ies'}
                          {madeAt ? (
                            <>
                              {' · '}
                              <Link to={madeAt.to} className="text-brand-text hover:underline">
                                print from {madeAt.label}
                              </Link>
                            </>
                          ) : null}
                        </span>
                      </Td>
                      <Td className="max-w-[14rem] text-xs">{r.purpose}</Td>
                      <Td className="text-xs">
                        <span className="block">{relativeTime(r.requestedAt)}</span>
                        <span className="block text-ink-500">{formatDateTime(r.requestedAt)}</span>
                      </Td>
                      <Td>
                        <Badge tone={TONES[r.status]}>{r.statusLabel}</Badge>
                        {r.remarks ? <span className="mt-1 block text-[11px] text-ink-500">{r.remarks}</span> : null}
                      </Td>
                      <Td className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          {next ? (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={move.isPending && move.variables?.id === r.id}
                              onClick={() => move.mutate({ id: r.id, to: next.to })}
                            >
                              {next.label}
                            </Button>
                          ) : null}
                          {['PENDING', 'PROCESSING', 'READY'].includes(r.status) ? (
                            <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
                              Cancel…
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <CancelModal
        request={cancelling}
        busy={move.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={(remarks) => cancelling && move.mutate({ id: cancelling.id, to: 'CANCELLED', remarks })}
      />
    </>
  );
}

function CancelModal({
  request,
  busy,
  onClose,
  onConfirm,
}: {
  request: DocumentRequestView | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState('');
  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Cancel this request"
      description={request ? `${request.referenceNumber} · ${request.documentTypeLabel} for ${request.studentName}` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} disabled={!remarks.trim()} onClick={() => onConfirm(remarks)}>
            Cancel request
          </Button>
        </>
      }
    >
      <Field label="Reason" htmlFor="cancel-reason" hint="The trainee reads this on their portal.">
        <TextArea id="cancel-reason" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </Field>
      <div className="mt-3">
        <InfoNote tone="warning">A cancelled request cannot be reopened; the trainee can file a new one.</InfoNote>
      </div>
    </Modal>
  );
}
