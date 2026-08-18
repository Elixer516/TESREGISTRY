import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType, RequestStatus } from '@/types';
import {
  ALL_DOCUMENT_TYPES,
  ALL_REQUEST_STATUSES,
  DOCUMENT_TYPE_LABELS,
  REQUEST_STATUS_LABELS,
} from '@/types';
import { documentsApi } from '@/api';
import type { GeneratedDocument } from '@/types';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  Field,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';
import { RequestStatusBadge } from '@/components/StatusBadge';
import { NewRequestModal } from './NewRequestModal';
import { GenerateDocumentModal } from './GenerateDocumentModal';
import { DocumentPrintModal } from './DocumentPrintModal';

/**
 * Every status a request may legally move to from its current one, mirroring
 * the server's own transition table. RELEASED and CANCELLED are terminal.
 */
const STATUS_OPTIONS: Record<RequestStatus, RequestStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY', 'CANCELLED'],
  READY: ['RELEASED', 'CANCELLED'],
  RELEASED: [],
  CANCELLED: [],
};

export function DocumentsPage() {
  const [status, setStatus] = useState<RequestStatus | 'ALL'>('ALL');
  const [docType, setDocType] = useState<DocumentType | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [generateFor, setGenerateFor] = useState<{
    studentId: string;
    studentName: string;
    documentType: DocumentType;
    requestId: string | null;
  } | null>(null);
  const [printing, setPrinting] = useState<GeneratedDocument | null>(null);

  const queryClient = useQueryClient();
  const toast = useToast();

  const requests = useQuery({
    queryKey: ['document-requests', status, docType, query],
    queryFn: () => documentsApi.listRequests({ status, documentType: docType, query }),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: RequestStatus }) =>
      documentsApi.updateRequestStatus(
        input.id,
        input.status,
        input.status === 'CANCELLED' ? 'Cancelled by the Registrar.' : undefined,
      ),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(updated.documentTypeLabel + ' is now ' + updated.statusLabel + '.');
    },
    onError: (caught) => toast.error('Could not update the request.', errorMessage(caught)),
  });

  const rows = requests.data ?? [];

  return (
    <>
      <PageHeader
        title="Documents"
        description="Six document types through one pipeline. Generation runs a validation gate first and refuses rather than producing a blank document."
        actions={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            New request
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status" htmlFor="doc-status">
            <Select
              id="doc-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as RequestStatus | 'ALL')}
            >
              <option value="ALL">All statuses</option>
              {ALL_REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {REQUEST_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Document type" htmlFor="doc-type">
            <Select
              id="doc-type"
              value={docType}
              onChange={(event) => setDocType(event.target.value as DocumentType | 'ALL')}
            >
              <option value="ALL">All types</option>
              {ALL_DOCUMENT_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="doc-search">
            <TextInput
              id="doc-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Student name, number or purpose…"
            />
          </Field>
        </div>
      </Card>

      <QueryState
        isLoading={requests.isLoading}
        error={requests.error}
        isEmpty={rows.length === 0}
        onRetry={() => requests.refetch()}
        loadingLabel="Loading document requests…"
        emptyTitle="No requests match"
        emptyHint="Clear the filters, or raise a new request for a student with standing at the centre."
        emptyAction={
          <Button variant="primary" onClick={() => setNewOpen(true)}>
            New request
          </Button>
        }
      >
        <Card>
          <CardHeader
            title="Requests"
            description="PENDING → PROCESSING → READY → RELEASED. Change the status from the dropdown; generating the document is a separate action."
          />
          <TableWrap>
            <Table className="min-w-[52rem]">
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Document</Th>
                  <Th>Purpose</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const options = STATUS_OPTIONS[row.status];
                  return (
                    <tr key={row.id} className="hover:bg-surface-2">
                      <Td>
                        <span className="block font-medium text-ink-900">{row.studentName}</span>
                        <span className="block text-xs text-ink-500">
                          {row.studentNumber} · {row.programCode}
                        </span>
                      </Td>
                      <Td>{row.documentTypeLabel}</Td>
                      <Td className="max-w-[16rem] text-xs">{row.purpose}</Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <RequestStatusBadge status={row.status} />
                          {options.length > 0 ? (
                            <Select
                              aria-label={'Change status for ' + row.studentName}
                              className="w-40 text-xs"
                              value=""
                              disabled={changeStatus.isPending}
                              onChange={(event) => {
                                const next = event.target.value as RequestStatus;
                                if (!next) return;
                                changeStatus.mutate({ id: row.id, status: next });
                                event.target.value = '';
                              }}
                            >
                              <option value="">Change status…</option>
                              {options.map((value) => (
                                <option key={value} value={value}>
                                  Mark {REQUEST_STATUS_LABELS[value]}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-xs text-ink-400">No further changes</span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-xs text-ink-500">{formatDateTime(row.updatedAt)}</Td>
                      <Td className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setGenerateFor({
                              studentId: row.studentId,
                              studentName: row.studentName,
                              documentType: row.documentType,
                              requestId: row.id,
                            })
                          }
                        >
                          Generate
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>

      <NewRequestModal open={newOpen} onClose={() => setNewOpen(false)} />

      <GenerateDocumentModal
        target={generateFor}
        onClose={() => setGenerateFor(null)}
        onGenerated={(document) => {
          setGenerateFor(null);
          setPrinting(document);
        }}
      />

      <DocumentPrintModal document={printing} onClose={() => setPrinting(null)} />
    </>
  );
}
