import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transcriptsApi } from '@/api';
import type { StudentView } from '@/types/views';
import { errorMessage } from '@/lib/api-error';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import {
  Button,
  Card,
  CardHeader,
  InfoNote,
  PageHeader,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/states';
import { PickerButton } from '@/components/RecordPicker';
import { StudentPicker } from '@/components/pickers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PreviousRecordsPanel } from './PreviousRecordsPanel';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Transcript upload.
 *
 * The PDF is held in memory as a data URL and validated by its leading bytes,
 * not its file name. Re-uploading replaces the held copy and bumps the version
 * rather than accumulating files nobody will ever reconcile.
 */
export function TranscriptsPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const tor = useQuery({
    queryKey: ['tor', student?.id],
    queryFn: () => transcriptsApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const upload = useMutation({
    mutationFn: (input: { fileName: string; fileSize: number; dataUrl: string }) =>
      transcriptsApi.upload({ studentId: student?.id ?? '', ...input }),
    onSuccess: (document) => {
      queryClient.invalidateQueries({ queryKey: ['tor'] });
      toast.success(
        'Transcript saved (version ' + document.version + ').',
        'It is stored as evidence — it is never read to build a transcript.',
      );
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: (password: string) => transcriptsApi.remove(student?.id ?? '', password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tor'] });
      toast.success('Transcript removed.');
      setConfirmRemove(false);
    },
    onError: (caught) => {
      setConfirmRemove(false);
      toast.error('The transcript was not removed.', errorMessage(caught));
    },
  });

  const onFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      upload.mutate({ fileName: file.name, fileSize: file.size, dataUrl });
    };
    reader.onerror = () => setError('That file could not be read.');
    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageHeader
        title="Transcript Upload"
        description="One PDF per student, held in memory for this session. Credited subjects are typed in separately below."
      />

      <div className="mb-4 max-w-md">
        <PickerButton
          label="Student"
          value={student ? student.lastFirstName + ' · ' + student.studentNumber : null}
          placeholder="Choose a student…"
          onClick={() => setPickerOpen(true)}
          onClear={() => setStudent(null)}
        />
      </div>

      {!student ? (
        <EmptyState
          title="Choose a student"
          hint="Search by name or student number to upload or review their previous-school transcript."
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              Find a student
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <InfoNote tone="info" title="The uploaded PDF is evidence, not data">
            Nothing in the file is read by the system. A subject only appears on a generated
            transcript if it is entered as a row under <strong>Previous school records</strong>
            below. Uploading the PDF alone changes nothing on the transcript.
          </InfoNote>

          <Card>
            <CardHeader
              title="Uploaded transcript"
              description="Re-uploading replaces the current file and bumps its version."
            />
            <div className="space-y-4 p-4">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="block w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink-700 file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-white"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onFile(file);
                  }}
                />
                <p className="mt-1.5 text-xs text-ink-500">
                  PDF only. The file is checked by its leading bytes, so renaming something to
                  .pdf will not get it through.
                </p>
              </div>

              {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

              {tor.isLoading ? (
                <LoadingState label="Looking for an uploaded transcript…" rows={1} />
              ) : tor.data ? (
                <div className="space-y-3">
                  <dl className="grid gap-3 rounded-lg border border-line bg-surface-2 p-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-ink-500">File</dt>
                      <dd className="break-all font-medium text-ink-900">{tor.data.fileName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Size</dt>
                      <dd className="font-medium text-ink-900">{formatBytes(tor.data.fileSize)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Version</dt>
                      <dd className="font-medium text-ink-900">{tor.data.version}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Uploaded</dt>
                      <dd className="font-medium text-ink-900">
                        {formatDateTime(tor.data.uploadedAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <a href={tor.data.dataUrl} target="_blank" rel="noreferrer">
                      <Button variant="secondary">View inline</Button>
                    </a>
                    <a href={tor.data.dataUrl} download={tor.data.fileName}>
                      <Button variant="secondary">Download</Button>
                    </a>
                    <Button variant="danger" onClick={() => setConfirmRemove(true)}>
                      Remove
                    </Button>
                  </div>

                  <object
                    data={tor.data.dataUrl}
                    type="application/pdf"
                    className="h-96 w-full rounded-lg border border-line"
                    aria-label="Uploaded transcript preview"
                  >
                    <p className="p-4 text-sm text-ink-500">
                      This browser will not preview the PDF inline. Use Download instead.
                    </p>
                  </object>
                </div>
              ) : (
                <EmptyState
                  title="No transcript uploaded"
                  hint="Upload the scanned PDF the student submitted. It is kept as evidence alongside the rows you enter below."
                />
              )}
            </div>
          </Card>

          <PreviousRecordsPanel student={student} />
        </div>
      )}

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this transcript?"
        message="The stored PDF will be deleted from this session. Credited subject rows are not affected."
        confirmLabel="Remove transcript"
        requirePassword
        loading={remove.isPending}
        onConfirm={(password) => remove.mutate(password)}
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}
