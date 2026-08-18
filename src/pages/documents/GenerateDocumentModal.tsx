import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocumentType, GeneratedDocument } from '@/types';
import { DOCUMENT_TYPE_LABELS } from '@/types';
import { documentsApi } from '@/api';
import { errorMessage, isApiError } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, InfoNote, Modal } from '@/components/ui';
import { LoadingState } from '@/components/states';
import { useState } from 'react';

export interface GenerateTarget {
  studentId: string;
  studentName: string;
  documentType: DocumentType;
  requestId: string | null;
}

/**
 * Generation, gated.
 *
 * The gate is checked here so the button can explain itself, and again on the
 * server, which is what actually refuses. A document that cannot be truthful
 * is not produced at all.
 */
export function GenerateDocumentModal({
  target,
  onClose,
  onGenerated,
}: {
  target: GenerateTarget | null;
  onClose: () => void;
  onGenerated: (document: GeneratedDocument) => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const gate = useQuery({
    queryKey: ['document-gate', target?.studentId, target?.documentType],
    queryFn: () => documentsApi.checkGate(target?.studentId ?? '', target?.documentType ?? 'TOR'),
    enabled: Boolean(target),
  });

  const generate = useMutation({
    mutationFn: () =>
      documentsApi.generate(
        target?.studentId ?? '',
        target?.documentType ?? 'TOR',
        target?.requestId ?? null,
      ),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      toast.success('Document generated.', 'Serial ' + document.serialNumber + '.');
      onGenerated(document);
    },
    onError: (caught) => setError(caught),
  });

  const issues = gate.data?.issues ?? [];
  const serverIssues = isApiError(error) ? (error.details ?? []) : [];

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target ? 'Generate ' + DOCUMENT_TYPE_LABELS[target.documentType] : 'Generate document'}
      description={target ? 'For ' + target.studentName + '.' : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!gate.data?.ok}
            loading={generate.isPending}
            onClick={() => {
              setError(null);
              generate.mutate();
            }}
          >
            Generate
          </Button>
        </>
      }
    >
      {gate.isLoading ? (
        <LoadingState label="Checking whether this document can be produced…" rows={2} />
      ) : (
        <div className="space-y-4">
          {gate.data?.ok ? (
            <InfoNote tone="success" title="Ready to generate">
              Every field this document needs is present. A snapshot of exactly this data will be
              stored with the generated copy, so later grade edits will not silently change it.
            </InfoNote>
          ) : (
            <InfoNote tone="danger" title="This document cannot be generated yet">
              <p className="mb-2">
                Producing it now would mean issuing a document with holes in it. Fix these first:
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </InfoNote>
          )}

          {error ? (
            <InfoNote tone="danger" title="Refused">
              <p>{errorMessage(error)}</p>
              {serverIssues.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {serverIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </InfoNote>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
