import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrollmentDocumentType } from '@/types';
import { APPLICANT_STANDING_LABELS } from '@/types';
import type { EnrollmentDocumentSlotView, StudentView } from '@/types/views';
import { enrollmentDocumentsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { buildDocumentFileName, buildStudentFolderName } from '@/lib/enrollment-documents';
import { checkFileSignature } from '@/lib/file-signature';
import { isDriveConfigured } from '@/config/google-drive';
import {
  connectDrive,
  findOrCreateStudentFolder,
  isConnected,
  trashDriveItem,
  uploadToDrive,
} from '@/lib/google-drive';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, InfoNote, Table, TableWrap, Td, Th } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { ConfirmDialog } from '@/components/ConfirmDialog';

/**
 * The admission-document checklist for one student.
 *
 * Uploads go to Google Drive first and are only recorded here once Drive has
 * confirmed the file — so a failed upload can never leave a record pointing
 * at a file that does not exist.
 *
 * Which slots are open is decided by the applicant's declared standing. The
 * server enforces the same rule independently; hiding a slot here is only a
 * courtesy to the registrar.
 */
export function DocumentsPanel({ student }: { student: StudentView }) {
  const [connected, setConnected] = useState(isConnected());
  const [busySlot, setBusySlot] = useState<EnrollmentDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<EnrollmentDocumentSlotView | null>(null);
  const fileInputs = useRef<Partial<Record<EnrollmentDocumentType, HTMLInputElement | null>>>({});

  const queryClient = useQueryClient();
  const toast = useToast();

  const checklist = useQuery({
    queryKey: ['enrollment-documents', student.id],
    queryFn: () => enrollmentDocumentsApi.checklist(student.id),
  });

  useEffect(() => setError(null), [student.id]);

  const connect = useMutation({
    mutationFn: () => connectDrive(),
    onSuccess: () => {
      setConnected(true);
      setError(null);
      toast.success('Google Drive connected.', 'The connection lasts about an hour.');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  /**
   * Removing a document now deletes the file too.
   *
   * Order is deliberate: the password is checked and the record dropped
   * first, and only then is Drive touched. A wrong password must never be
   * able to reach Drive, and a file left behind after an authorised removal
   * is recoverable — an unauthorised deletion would not be.
   */
  const remove = useMutation({
    mutationFn: async (input: { id: string; password: string }) => {
      const removed = await enrollmentDocumentsApi.remove(input.id, input.password);
      if (!removed.driveFileId || !isDriveConfigured()) return { driveNote: null };

      try {
        if (!isConnected()) await connectDrive();
        await trashDriveItem(removed.driveFileId);
        return { driveNote: null as string | null };
      } catch (caught) {
        return {
          driveNote: `The record was removed, but the file is still in Drive: ${errorMessage(caught)}`,
        };
      }
    },
    onSuccess: ({ driveNote }) => {
      queryClient.invalidateQueries({ queryKey: ['enrollment-documents', student.id] });
      if (driveNote) {
        toast.error('Removed, but not fully deleted.', driveNote);
      } else {
        toast.success('Document deleted.', 'The file was moved to the Google Drive trash.');
      }
      setRemoving(null);
    },
    onError: (caught) => {
      setRemoving(null);
      toast.error('The document was not removed.', errorMessage(caught));
    },
  });

  /**
   * Validate → resolve the Drive folder → upload → record. Each step is
   * awaited so a failure anywhere stops before anything is written locally.
   */
  const handleFile = async (slot: EnrollmentDocumentSlotView, file: File) => {
    setError(null);
    setBusySlot(slot.type);
    try {
      const check = await checkFileSignature(file, slot.accept);
      if (!check.ok) throw new Error(check.message);

      if (!isConnected()) {
        await connectDrive();
        setConnected(true);
      }

      const folderId = await findOrCreateStudentFolder(buildStudentFolderName(student));
      // Cheap and idempotent; keeps the id handy for the rest of the session.
      await enrollmentDocumentsApi.setDriveFolder(student.id, folderId);

      const fileName = buildDocumentFileName(student, slot.type, file.name);
      const uploaded = await uploadToDrive({
        folderId,
        fileName,
        file,
        existingFileId: slot.document?.driveFileId ?? null,
      });

      await enrollmentDocumentsApi.record({
        studentId: student.id,
        documentType: slot.type,
        fileName,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        driveFileId: uploaded.fileId,
        driveWebViewLink: uploaded.webViewLink,
      });

      queryClient.invalidateQueries({ queryKey: ['enrollment-documents', student.id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success(`${slot.label} filed.`, `Saved to Drive as ${fileName}`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusySlot(null);
      const input = fileInputs.current[slot.type];
      if (input) input.value = '';
    }
  };

  if (checklist.isLoading) return <LoadingState label="Loading the checklist…" />;
  if (checklist.error) {
    return <ErrorState error={checklist.error} onRetry={() => checklist.refetch()} />;
  }
  if (!checklist.data) return null;

  const data = checklist.data;

  if (!data.standing) {
    return (
      <InfoNote tone="warning" title="Educational standing not recorded">
        Which documents this student must submit depends on what they had finished before
        applying — a Senior High graduate needs a Form 138, a college transferee a Transcript of
        Records. Set it under <strong>Edit</strong> first, then the checklist appears here.
      </InfoNote>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink-900">
            {data.submittedRequiredCount} of {data.requiredCount} required documents on file
          </p>
          <p className="text-xs text-ink-500">
            Applying as a {APPLICANT_STANDING_LABELS[data.standing]}. Files are filed in Drive
            under &ldquo;{buildStudentFolderName(student)}&rdquo;.
          </p>
        </div>
        {data.isComplete ? (
          <Badge tone="success">Complete</Badge>
        ) : (
          <Badge tone="warning">Incomplete</Badge>
        )}
      </div>

      {!isDriveConfigured() ? (
        <InfoNote tone="warning" title="Google Drive is not configured">
          No Drive client id is set in this build, so uploading is unavailable. The checklist
          below is read-only.
        </InfoNote>
      ) : !connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/40 bg-info-soft px-3.5 py-3">
          <p className="min-w-0 text-sm text-info-ink">
            Connect the centre&rsquo;s Google account to file documents. The connection lasts
            about an hour.
          </p>
          <Button variant="primary" size="sm" loading={connect.isPending} onClick={() => connect.mutate()}>
            Connect Google Drive
          </Button>
        </div>
      ) : null}

      {error ? (
        <InfoNote tone="danger" title="Nothing was filed">
          {error}
        </InfoNote>
      ) : null}

      <TableWrap>
        <Table className="min-w-[46rem]">
          <thead>
            <tr>
              <Th>Requirement</Th>
              <Th>Status</Th>
              <Th>File</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {data.slots.map((slot) => {
              const blocked = slot.requirement === 'NOT_APPLICABLE';
              const busy = busySlot === slot.type;
              return (
                <tr key={slot.type} className={blocked ? 'opacity-55' : undefined}>
                  <Td>
                    <span className="block font-medium text-ink-900">{slot.label}</span>
                    {slot.note ? (
                      <span className="block text-xs text-ink-500">{slot.note}</span>
                    ) : null}
                  </Td>
                  <Td>
                    {blocked ? (
                      <span className="text-xs text-ink-500">
                        Not applicable to a {APPLICANT_STANDING_LABELS[data.standing!]}
                      </span>
                    ) : slot.document ? (
                      <Badge tone="success">Submitted</Badge>
                    ) : slot.requirement === 'OPTIONAL' ? (
                      <Badge tone="neutral">Optional</Badge>
                    ) : (
                      <Badge tone="warning">Required</Badge>
                    )}
                  </Td>
                  <Td className="text-xs">
                    {slot.document ? (
                      <>
                        <a
                          href={slot.document.driveWebViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-medium text-brand-text hover:underline"
                        >
                          {slot.document.fileName}
                        </a>
                        <span className="mt-0.5 block text-ink-500">
                          v{slot.document.version} · {slot.document.uploadedByName} ·{' '}
                          {formatDateTime(slot.document.uploadedAt)}
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {blocked ? null : (
                      <div className="flex justify-end gap-1.5">
                        <input
                          type="file"
                          hidden
                          accept={slot.accept.join(',')}
                          ref={(el) => {
                            fileInputs.current[slot.type] = el;
                          }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handleFile(slot, file);
                          }}
                        />
                        <Button
                          size="sm"
                          variant={slot.document ? 'secondary' : 'primary'}
                          loading={busy}
                          disabled={!isDriveConfigured() || busySlot !== null}
                          onClick={() => fileInputs.current[slot.type]?.click()}
                        >
                          {slot.document ? 'Replace' : 'Upload'}
                        </Button>
                        {slot.document ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busySlot !== null}
                            onClick={() => setRemoving(slot)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>

      <ConfirmDialog
        open={removing !== null}
        title="Delete this document?"
        message={
          removing
            ? `${removing.label} will be removed from this student's checklist and the file moved to the Google Drive trash. Drive keeps trashed files for 30 days, so this can be undone from Drive if it was a mistake.`
            : ''
        }
        confirmLabel="Delete document"
        requirePassword
        loading={remove.isPending}
        onConfirm={(password) =>
          removing?.document && remove.mutate({ id: removing.document.id, password })
        }
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
