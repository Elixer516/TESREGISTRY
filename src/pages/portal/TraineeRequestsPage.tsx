import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType } from '@/types';
import { ALL_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/types';
import { documentsApi, mineApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextArea,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { RequestStatusBadge } from '@/components/StatusBadge';

export function TraineeRequestsPage() {
  const [open, setOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('CERT_ENROLLMENT');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const studentId = useQuery({ queryKey: ['my-student-id'], queryFn: () => mineApi.studentId() });
  const requests = useQuery({
    queryKey: ['document-requests', 'mine'],
    queryFn: () => documentsApi.listRequests({}),
  });

  const create = useMutation({
    mutationFn: () => documentsApi.createRequest(studentId.data ?? '', documentType, purpose),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(created.documentTypeLabel + ' requested.', 'The Registrar has been notified.');
      setOpen(false);
      setPurpose('');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const rows = requests.data ?? [];

  return (
    <>
      <PageHeader
        title="Document Requests"
        description="Ask the Registrar for a document and follow its progress."
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      />

      <div className="mb-4">
        <InfoNote tone="info" title="How a request moves">
          Pending → Processing → Ready for Release → Released. You will get a notification each
          time it changes. Collect the document from the Registrar once it reads Ready.
        </InfoNote>
      </div>

      <QueryState
        isLoading={requests.isLoading}
        error={requests.error}
        isEmpty={rows.length === 0}
        onRetry={() => requests.refetch()}
        loadingLabel="Loading your requests…"
        emptyTitle="No requests yet"
        emptyHint="Raise a request for a certificate, transcript or other document you need."
        emptyAction={
          <Button variant="primary" onClick={() => setOpen(true)}>
            New request
          </Button>
        }
      >
        <Card>
          <CardHeader title="My requests" description="Newest first." />
          <TableWrap>
            <Table className="min-w-[40rem]">
              <thead>
                <tr>
                  <Th>Document</Th>
                  <Th>Purpose</Th>
                  <Th>Status</Th>
                  <Th>Requested</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-medium text-ink-900">{row.documentTypeLabel}</Td>
                    <Td className="max-w-[16rem] text-xs">{row.purpose}</Td>
                    <Td>
                      <RequestStatusBadge status={row.status} />
                    </Td>
                    <Td className="text-xs text-ink-500">{formatDateTime(row.requestedAt)}</Td>
                    <Td className="text-xs text-ink-500">{formatDateTime(row.updatedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New document request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!purpose.trim()}
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              Send request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Document" htmlFor="tr-type" required>
            <Select
              id="tr-type"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value as DocumentType)}
            >
              {ALL_DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Purpose" htmlFor="tr-purpose" required>
            <TextArea
              id="tr-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Scholarship application"
            />
          </Field>
          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      </Modal>
    </>
  );
}
