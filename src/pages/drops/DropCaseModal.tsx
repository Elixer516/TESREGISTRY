import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DropCaseStatus } from '@/types';
import { DROP_CASE_STATUS_LABELS } from '@/types';
import type { DropCaseView } from '@/types/views';
import { dropsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate, formatDateTime } from '@/lib/format';
import { buildStudentFolderName } from '@/lib/enrollment-documents';
import { useToast } from '@/context/ToastContext';
import {
  AttachmentList,
  AttachmentsField,
  type DraftAttachment,
} from '@/components/AttachmentsField';
import { Badge, Button, Field, InfoNote, Modal, TextArea, TextInput } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { QueryState } from '@/components/states';
import {
  DepartureFields,
  isDepartureComplete,
  type DepartureDraft,
} from '../students/DepartureFields';

export const DROP_STATUS_TONE: Record<DropCaseStatus, BadgeTone> = {
  FOR_REVIEW: 'warning',
  DROPPED: 'danger',
  REINSTATED: 'success',
  CLOSED: 'neutral',
};

const toDraft = (attachments: DropCaseView['attachments']): DraftAttachment[] =>
  attachments.map(({ id, kind, name, url, driveFileId, mimeType, size }) => ({
    id,
    kind,
    name,
    url,
    driveFileId,
    mimeType,
    size,
  }));

/**
 * One drop case, start to finish.
 *
 * Under review it is a form: the reason, the effective date, and the proof.
 * Confirming the drop needs a reason and at least one attachment; the
 * button says so rather than letting the request fail. Once decided it is
 * a record — the reason, the proof, and every step, with reinstatement
 * available on a confirmed drop.
 */
export function DropCaseModal({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['drop-case', caseId],
    queryFn: () => dropsApi.get(caseId ?? ''),
    enabled: Boolean(caseId),
  });
  const data = query.data;

  const [departure, setDeparture] = useState<DepartureDraft>({ reason: '', note: '' });
  const [effectiveDate, setEffectiveDate] = useState('');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [closing, setClosing] = useState<null | 'close' | 'reinstate'>(null);
  const [closingNote, setClosingNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Start from what is saved each time a case is opened or reloaded.
  useEffect(() => {
    if (!data) return;
    setDeparture({ reason: data.reason ?? '', note: data.note });
    setEffectiveDate(data.effectiveDate ?? '');
    setAttachments(data.status === 'FOR_REVIEW' ? toDraft(data.attachments) : []);
    setClosing(null);
    setClosingNote('');
    setError(null);
  }, [data]);

  const refresh = async (updated: DropCaseView, message: string, detail?: string) => {
    queryClient.setQueryData(['drop-case', caseId], updated);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['drop-cases'] }),
      queryClient.invalidateQueries({ queryKey: ['drop-candidates'] }),
      queryClient.invalidateQueries({ queryKey: ['students'] }),
      queryClient.invalidateQueries({ queryKey: ['academic-standing'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
    toast.success(message, detail);
  };

  const details = () => ({
    reason: departure.reason || null,
    note: departure.note,
    effectiveDate: effectiveDate || null,
    attachments,
  });

  const save = useMutation({
    mutationFn: () => dropsApi.update(caseId ?? '', details()),
    onSuccess: (updated) => refresh(updated, 'Case saved.'),
    onError: (caught) => setError(errorMessage(caught)),
  });
  const confirm = useMutation({
    mutationFn: () => dropsApi.confirm(caseId ?? '', details()),
    onSuccess: (updated) =>
      refresh(
        updated,
        `${updated.student.fullName} is dropped.`,
        'Enrolment into later terms is closed. Reinstate from this case if it was a mistake.',
      ),
    onError: (caught) => setError(errorMessage(caught)),
  });
  const close = useMutation({
    mutationFn: () => dropsApi.close(caseId ?? '', closingNote),
    onSuccess: (updated) => refresh(updated, 'Case closed — the trainee was not dropped.'),
    onError: (caught) => setError(errorMessage(caught)),
  });
  const reinstate = useMutation({
    mutationFn: () => dropsApi.reinstate(caseId ?? '', closingNote),
    onSuccess: (updated) => refresh(updated, `${updated.student.fullName} is reinstated.`),
    onError: (caught) => setError(errorMessage(caught)),
  });
  const addLate = useMutation({
    mutationFn: () => dropsApi.addAttachments(caseId ?? '', attachments),
    onSuccess: (updated) => refresh(updated, 'Attachment added to the case.'),
    onError: (caught) => setError(errorMessage(caught)),
  });

  const busy =
    save.isPending || confirm.isPending || close.isPending || reinstate.isPending || addLate.isPending;
  const underReview = data?.status === 'FOR_REVIEW';
  const canConfirm = isDepartureComplete(departure) && attachments.length > 0;

  const footer = data ? (
    underReview ? (
      closing === 'close' ? (
        <>
          <Button variant="secondary" onClick={() => setClosing(null)} disabled={busy}>
            Back
          </Button>
          <Button variant="primary" loading={close.isPending} disabled={!closingNote.trim()} onClick={() => close.mutate()}>
            Close without dropping
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setClosing('close')} disabled={busy}>
            Not dropping…
          </Button>
          <Button variant="secondary" loading={save.isPending} disabled={busy} onClick={() => save.mutate()}>
            Save
          </Button>
          <Button
            variant="danger"
            loading={confirm.isPending}
            disabled={busy || !canConfirm}
            onClick={() => {
              setError(null);
              confirm.mutate();
            }}
          >
            Confirm drop
          </Button>
        </>
      )
    ) : data.status === 'DROPPED' ? (
      closing === 'reinstate' ? (
        <>
          <Button variant="secondary" onClick={() => setClosing(null)} disabled={busy}>
            Back
          </Button>
          <Button variant="primary" loading={reinstate.isPending} disabled={!closingNote.trim()} onClick={() => reinstate.mutate()}>
            Reinstate trainee
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={() => setClosing('reinstate')}>
            Reinstate…
          </Button>
        </>
      )
    ) : (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    )
  ) : null;

  return (
    <Modal
      open={caseId !== null}
      onClose={onClose}
      size="xl"
      title={data ? `${data.caseNumber} — ${data.student.fullName}` : 'Drop case'}
      description={
        data
          ? `${data.student.studentNumber} · ${data.student.programCode} · Year ${data.student.yearLevel}${
              data.student.sectionCode ? ` · ${data.student.sectionCode}` : ''
            }`
          : undefined
      }
      footer={footer}
    >
      <QueryState isLoading={query.isLoading} error={query.error} onRetry={() => query.refetch()}>
        {data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={DROP_STATUS_TONE[data.status]}>{DROP_CASE_STATUS_LABELS[data.status]}</Badge>
              <span className="text-ink-500">
                Opened {formatDateTime(data.openedAt)}
                {data.origin === 'STANDING' ? ' from the academic standing review' : ''}
              </span>
            </div>

            {data.standing ? (
              <section>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                  Grades at or below the 79% line
                </p>
                <ul className="space-y-0.5 text-sm">
                  {data.standing.subjects.map((s) => (
                    <li key={`${s.subjectCode}-${s.termLabel}`}>
                      <span
                        className={
                          'font-semibold tabular-nums ' +
                          ((s.percentage ?? 0) <= 75 ? 'text-danger-ink' : 'text-warning-ink')
                        }
                      >
                        {s.percentage !== null ? `${s.percentage}%` : ''} {s.grade}
                      </span>{' '}
                      <strong>{s.subjectCode}</strong> {s.subjectTitle}{' '}
                      <span className="text-ink-500">· {s.termLabel}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {underReview ? (
              closing === 'close' ? (
                <Field label="Why is the trainee not being dropped?" required htmlFor="drop-close-note">
                  <TextArea
                    id="drop-close-note"
                    rows={3}
                    value={closingNote}
                    onChange={(event) => setClosingNote(event.target.value)}
                    placeholder="e.g. Grade was corrected; trainee completed the requirement."
                  />
                </Field>
              ) : (
                <>
                  <DepartureFields value={departure} onChange={setDeparture} disabled={busy} />
                  <Field
                    label="Effective date"
                    htmlFor="drop-effective"
                    hint="The date on the drop slip. Leave blank to use the day the drop is confirmed."
                  >
                    <TextInput
                      id="drop-effective"
                      type="date"
                      className="max-w-[12rem]"
                      value={effectiveDate}
                      onChange={(event) => setEffectiveDate(event.target.value)}
                    />
                  </Field>
                  <div>
                    <p className="text-xs font-semibold text-ink-700">
                      Proof and supporting documents <span className="text-danger">*</span>
                    </p>
                    <p className="mb-2 text-xs text-ink-500">
                      The drop slip, a withdrawal letter, a record of absences — whatever backs
                      the drop. At least one is required to confirm it.
                    </p>
                    <AttachmentsField
                      value={attachments}
                      onChange={setAttachments}
                      folderName={buildStudentFolderName(data.student)}
                      slot="DROP_PROOF"
                      disabled={busy}
                    />
                  </div>
                  {!canConfirm ? (
                    <p className="text-xs text-ink-500">
                      To confirm the drop:{' '}
                      {[
                        !isDepartureComplete(departure) ? 'choose a reason' : null,
                        attachments.length === 0 ? 'attach at least one proof' : null,
                      ]
                        .filter(Boolean)
                        .join(' and ')}
                      .
                    </p>
                  ) : null}
                </>
              )
            ) : (
              <>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-ink-500">Reason</dt>
                    <dd className="font-medium text-ink-900">
                      {data.reasonLabel ?? '—'}
                      {data.institutionInitiated !== null ? (
                        <span className="ml-1 text-xs font-normal text-ink-500">
                          ({data.institutionInitiated ? 'centre' : 'trainee'})
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Effective</dt>
                    <dd className="font-medium text-ink-900">
                      {data.effectiveDate
                        ? formatDate(data.effectiveDate)
                        : data.droppedAt
                          ? formatDate(data.droppedAt)
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-500">Note</dt>
                    <dd className="text-ink-700">{data.note || '—'}</dd>
                  </div>
                </dl>
                <section>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Proof and supporting documents
                  </p>
                  <AttachmentList items={data.attachments} />
                  {data.status === 'DROPPED' && closing !== 'reinstate' ? (
                    <div className="mt-2">
                      <AttachmentsField
                        value={attachments}
                        onChange={setAttachments}
                        folderName={buildStudentFolderName(data.student)}
                        slot="DROP_PROOF"
                        disabled={busy}
                      />
                      {attachments.length > 0 ? (
                        <Button
                          className="mt-2"
                          size="sm"
                          variant="primary"
                          loading={addLate.isPending}
                          onClick={() => addLate.mutate()}
                        >
                          Add to the case
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
                {closing === 'reinstate' ? (
                  <Field label="Why is the trainee being reinstated?" required htmlFor="drop-reinstate">
                    <TextArea
                      id="drop-reinstate"
                      rows={3}
                      value={closingNote}
                      onChange={(event) => setClosingNote(event.target.value)}
                      placeholder="e.g. Appeal granted by the Center Administrator on 2 Oct 2026."
                    />
                  </Field>
                ) : null}
              </>
            )}

            {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">History</p>
              <ol className="space-y-1 border-l border-line pl-3 text-sm">
                {data.history.map((event, index) => (
                  <li key={index}>
                    <span className="font-medium text-ink-900">
                      {event.action.charAt(0) + event.action.slice(1).toLowerCase()}
                    </span>{' '}
                    <span className="text-ink-500">
                      — {event.byName}, {formatDateTime(event.at)}
                    </span>
                    {event.note ? <span className="block text-xs text-ink-700">{event.note}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : null}
      </QueryState>
    </Modal>
  );
}
