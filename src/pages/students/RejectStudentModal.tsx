import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enrollmentDocumentsApi, studentsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { connectDrive, isConnected, trashDriveItem } from '@/lib/google-drive';
import { isDriveConfigured } from '@/config/google-drive';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, TextArea } from '@/components/ui';

/**
 * Rejecting an application also disposes of the applicant's Drive folder —
 * the ID picture and birth certificate they uploaded have no reason to stay
 * in the centre's records once the application is refused.
 *
 * "Deleted" means moved to Drive's Trash, so it is recoverable for 30 days if
 * the rejection is reversed or was a mistake.
 *
 * The rejection is recorded first and never blocked by Drive. If the folder
 * cannot be reached, the applicant is still rejected and the registrar is
 * told the files are still there — the alternative, refusing to reject
 * because Google is unreachable, would be worse.
 */
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

  const hasFolder = Boolean(student?.driveFolderId);

  const reject = useMutation({
    mutationFn: async () => {
      const id = student?.id ?? '';
      const folderId = student?.driveFolderId ?? null;

      const updated = await studentsApi.reject(id, reason);

      if (!folderId || !isDriveConfigured()) {
        return { updated, driveNote: null as string | null };
      }

      try {
        if (!isConnected()) await connectDrive();
        await trashDriveItem(folderId);
        await enrollmentDocumentsApi.clearDriveFolder(id);
        return { updated, driveNote: null };
      } catch (caught) {
        return {
          updated,
          driveNote: `Their Google Drive folder was not deleted: ${errorMessage(caught)}`,
        };
      }
    },
    onSuccess: ({ updated, driveNote }) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['enrollment-documents'] });

      if (driveNote) {
        toast.error(`${updated.fullName} was rejected, but not fully cleaned up.`, driveNote);
      } else {
        toast.success(
          'Application rejected.',
          `${updated.fullName} was moved to the Rejected tab${
            hasFolder ? ', and their uploaded documents were moved to the Drive trash' : ''
          }.`,
        );
      }
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

        {hasFolder ? (
          <InfoNote tone="warning" title="Their uploaded documents will be deleted">
            The Google Drive folder for this applicant, and the files in it, will be moved to
            the trash. Drive keeps trashed items for 30 days, so this can be undone from Drive
            if you reject in error. You may be asked to connect Google Drive.
          </InfoNote>
        ) : null}

        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
