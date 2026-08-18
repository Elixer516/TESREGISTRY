import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextArea } from '@/components/ui';

export function RejectStudentModal({
  student,
  onClose,
}: {
  student: StudentView | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (student) {
      setReason('');
      setError(null);
    }
  }, [student]);

  const reject = useMutation({
    mutationFn: () => studentsApi.reject(student?.id ?? '', reason),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Application rejected.', updated.fullName + ' was moved to the Rejected tab.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={student !== null}
      onClose={onClose}
      title={student ? 'Reject ' + student.fullName : 'Reject application'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={reject.isPending}
            onClick={() => {
              setError(null);
              reject.mutate();
            }}
          >
            Reject application
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Reason"
          htmlFor="reject-reason"
          required
          hint="The applicant is entitled to know why, and this is kept on the record."
        >
          <TextArea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Incomplete admission requirements — missing Form 137."
          />
        </Field>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
