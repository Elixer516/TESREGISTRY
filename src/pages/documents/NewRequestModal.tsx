import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DocumentType } from '@/types';
import { ALL_DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS } from '@/types';
import { documentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, TextArea } from '@/components/ui';
import { PickerButton } from '@/components/RecordPicker';
import { DocumentStudentPicker } from '@/components/pickers';

export function NewRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>('TOR');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setStudent(null);
      setDocumentType('TOR');
      setPurpose('');
      setError(null);
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () => documentsApi.createRequest(student?.id ?? '', documentType, purpose),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['document-requests'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success(created.documentTypeLabel + ' requested for ' + created.studentName + '.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="New document request"
        description="The request enters the pipeline as Pending. Generating the document is a separate step."
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!student || !purpose.trim()}
              loading={create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
            >
              Raise request
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PickerButton
            label="Student"
            value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
            placeholder="Choose a student…"
            onClick={() => setPickerOpen(true)}
            onClear={() => setStudent(null)}
          />

          <Field label="Document type" htmlFor="req-type" required>
            <Select
              id="req-type"
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

          <Field label="Purpose" htmlFor="req-purpose" required>
            <TextArea
              id="req-purpose"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Scholarship application, employment requirement, transfer…"
            />
          </Field>

          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      </Modal>

      <DocumentStudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />
    </>
  );
}
