import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClearanceItem, GraduationClearance, TranscriptView } from '@/types/views';
import { catalogApi, clearanceApi, transcriptApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { lackingRequirementsMessage, mailtoHref } from '@/lib/registrar-messages';
import { useToast } from '@/context/ToastContext';
import { Badge, Button, Field, InfoNote, Modal, Select, Table, TableWrap, Td, TextInput, Th } from '@/components/ui';
import { QueryState } from '@/components/states';
import { AutoFillInput } from '@/components/AutoFillInput';
import { useStudentRecordSuggestions } from '@/lib/use-suggestions';

const today = () => new Date().toISOString().slice(0, 10);

function useGraduationRefresh() {
  const queryClient = useQueryClient();
  return (studentId?: string) => {
    if (studentId) queryClient.invalidateQueries({ queryKey: ['transcript', studentId] });
    queryClient.invalidateQueries({ queryKey: ['transcript'] });
    queryClient.invalidateQueries({ queryKey: ['graduation-candidates'] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['report'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['document-requests'] });
  };
}

/** The clearance as a table: each requirement, when it was submitted, and remarks. */
export function ClearanceSummary({ clearance }: { clearance: GraduationClearance }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {clearance.items.map((item) => (
        <li key={item.type} className="flex items-start gap-2">
          <span aria-hidden className={item.status === 'MISSING' ? 'text-warning-ink' : 'text-success-ink'}>
            {item.status === 'MISSING' ? '○' : '✓'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-ink-900">{item.label}</span>
            <span className="block text-xs text-ink-500">
              {item.status === 'MISSING'
                ? 'Not yet submitted'
                : `${item.status === 'UPLOADED' ? 'Scan on file' : 'Received'} · submitted ${formatDate(item.submittedOn)}`}
              {item.remarks ? ` · ${item.remarks}` : ''}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Mark as graduated — in two steps. First the clearance: if any admission
 * requirement is still missing, the Registrar is told which, and marks each
 * one received (date submitted and remarks) or emails the trainee the list.
 * Only once the clearance is complete do the graduation details follow: the
 * date, the Special Order No. and the NSTP Serial No.
 */
export function GraduateModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: TranscriptView }) {
  const suggest = useStudentRecordSuggestions();
  const toast = useToast();
  const refresh = useGraduationRefresh();
  const editing = data.student.status === 'GRADUATED';
  const [step, setStep] = useState<'CLEARANCE' | 'DETAILS'>('CLEARANCE');
  const [on, setOn] = useState(data.graduatedOn ?? today());
  const [so, setSo] = useState(data.specialOrderNo ?? '');
  const [nstp, setNstp] = useState(data.nstpSerialNo ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(editing || data.clearance.complete ? 'DETAILS' : 'CLEARANCE');
      setOn(data.graduatedOn ?? today());
      setSo(data.specialOrderNo ?? '');
      setNstp(data.nstpSerialNo ?? '');
      setError(null);
    }
    // Only when the dialog opens: the clearance updating underneath must not
    // jump the Registrar to the next step on its own.
  }, [open]);

  const save = useMutation({
    mutationFn: () => {
      const input = { graduatedOn: on, specialOrderNo: so, nstpSerialNo: nstp };
      return editing
        ? transcriptApi.updateGraduation(data.student.id, input)
        : transcriptApi.markGraduated(data.student.id, input);
    },
    onSuccess: () => {
      refresh(data.student.id);
      toast.success(
        editing ? 'Graduation details updated.' : `${data.student.fullName} marked graduated.`,
        'The TOR now carries the SO and NSTP numbers.',
      );
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const missing = data.clearance.items.filter((i) => i.status === 'MISSING');
  const lackingEmail = lackingRequirementsMessage({
    firstName: data.student.firstName,
    missing: data.clearance.missing,
    regarding: 'your graduation clearance',
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit graduation details' : step === 'CLEARANCE' ? 'Clearance before graduation' : 'Mark as graduated'}
      description={`${data.student.fullName} · ${data.student.programName}`}
      footer={
        step === 'CLEARANCE' ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" disabled={!data.clearance.complete} onClick={() => setStep('DETAILS')}>
              Continue to graduation details
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
              {editing ? 'Save' : 'Mark graduated'}
            </Button>
          </>
        )
      }
    >
      {step === 'CLEARANCE' ? (
        <div className="space-y-3">
          {data.clearance.complete ? (
            <InfoNote tone="success" title="Clearance complete">
              Every admission requirement is on file. Continue to enter the graduation details.
            </InfoNote>
          ) : (
            <InfoNote tone="warning" title={`${missing.length} requirement${missing.length === 1 ? '' : 's'} still needed`}>
              {data.student.firstName} cannot be marked graduated until these are marked as completed. Record each one
              as it is received, or email {data.student.firstName} the list.
              <div className="mt-2">
                <a
                  href={mailtoHref(data.student.email, lackingEmail.subject, lackingEmail.body)}
                  className="font-semibold underline"
                >
                  ✉ Email {data.student.firstName} what is lacking
                </a>
              </div>
            </InfoNote>
          )}
          <ul className="divide-y divide-line rounded-lg border border-line">
            {data.clearance.items.map((item) => (
              <ClearanceRow key={item.type} studentId={data.student.id} item={item} onChanged={() => refresh(data.student.id)} />
            ))}
          </ul>
          {data.clearance.standingAssumed ? (
            <p className="text-xs text-ink-500">
              This record has no admission standing set, so the Senior High graduate checklist is used.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {!editing ? (
            <p className="text-sm text-success-ink">✓ Clearance complete — every admission requirement is on file.</p>
          ) : null}
          <Field label="Date graduated" htmlFor="grad-on">
            <TextInput id="grad-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </Field>
          <Field label="Special Order No." htmlFor="grad-so" hint="As issued by TESDA, e.g. 1124-DP-ICT-0226-2026.">
            <AutoFillInput id="grad-so" value={so} onChange={setSo} suggestions={suggest.specialOrderNos} historyKey="so-number" placeholder="1124-DP-…" />
          </Field>
          <Field label="NSTP Serial No." htmlFor="grad-nstp" hint="The trainee's own NSTP graduation number — not the SO.">
            <AutoFillInput id="grad-nstp" value={nstp} onChange={setNstp} suggestions={suggest.nstpSerialNos} historyKey="nstp-serial" placeholder="TVET-NSTP-CWTS-…" />
          </Field>
          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
        </div>
      )}
    </Modal>
  );
}

/** One requirement in the clearance pop-up: done, or a date and remarks to mark it received. */
function ClearanceRow({ studentId, item, onChanged }: { studentId: string; item: ClearanceItem; onChanged: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(today());
  const [remarks, setRemarks] = useState('');
  const receive = useMutation({
    mutationFn: () => clearanceApi.receive(studentId, item.type, date, remarks),
    onSuccess: () => {
      toast.success(`${item.label} marked as received.`);
      onChanged();
    },
    onError: (caught) => toast.error('Could not record it.', errorMessage(caught)),
  });

  if (item.status !== 'MISSING') {
    return (
      <li className="flex items-start gap-3 px-3 py-2.5">
        <span aria-hidden className="mt-0.5 text-success-ink">✓</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-ink-900">{item.label}</p>
          <p className="text-xs text-ink-500">
            {item.status === 'UPLOADED' ? 'Scan on file' : 'Received'} · submitted {formatDate(item.submittedOn)}
            {item.remarks ? ` · ${item.remarks}` : ''}
          </p>
        </div>
        <Badge tone="success">Completed</Badge>
      </li>
    );
  }
  return (
    <li className="space-y-2 bg-warning-soft/40 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-warning-ink">○</span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-ink-900">{item.label}</p>
        <Badge tone="warning">Missing</Badge>
      </div>
      <div className="flex flex-wrap items-end gap-2 pl-6">
        <Field label="Date submitted" htmlFor={`rcv-${item.type}`}>
          <TextInput id={`rcv-${item.type}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </Field>
        <Field label="Remarks (optional)" htmlFor={`rmk-${item.type}`} className="min-w-[12rem] flex-1">
          <TextInput id={`rmk-${item.type}`} value={remarks} maxLength={300} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. PSA copy, photocopy only" />
        </Field>
        <Button size="sm" variant="primary" loading={receive.isPending} onClick={() => receive.mutate()}>
          Mark received
        </Button>
      </div>
    </li>
  );
}

/**
 * Graduate a batch under one Special Order. TESDA issues one SO for a whole
 * group, so the SO and the date are entered once; each trainee keeps their
 * own NSTP Serial No. Only trainees with a complete clearance can be chosen.
 */
export function BatchGraduateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suggest = useStudentRecordSuggestions();
  const toast = useToast();
  const refresh = useGraduationRefresh();
  const [programId, setProgramId] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [on, setOn] = useState(today());
  const [so, setSo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const programs = useQuery({ queryKey: ['programs'], queryFn: () => catalogApi.listPrograms(), enabled: open });
  const candidates = useQuery({
    queryKey: ['graduation-candidates', programId],
    queryFn: () => transcriptApi.candidates(programId || undefined),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setSelected({});
      setSo('');
      setOn(today());
      setError(null);
    }
  }, [open]);

  const rows = candidates.data ?? [];
  const cleared = useMemo(() => rows.filter((r) => r.clearance.complete), [rows]);
  const chosen = Object.keys(selected);

  const save = useMutation({
    mutationFn: () =>
      transcriptApi.markGraduatedBatch(
        { graduatedOn: on, specialOrderNo: so },
        chosen.map((studentId) => ({ studentId, nstpSerialNo: selected[studentId] })),
      ),
    onSuccess: (done) => {
      refresh();
      toast.success(`${done.length} trainee${done.length === 1 ? '' : 's'} marked graduated.`, `Special Order No. ${so}`);
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const toggle = (studentId: string, nstp: string) =>
    setSelected((current) => {
      const next = { ...current };
      if (studentId in next) delete next[studentId];
      else next[studentId] = nstp;
      return next;
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Graduate a batch"
      description="One Special Order No. and date for everyone chosen. Each trainee keeps their own NSTP Serial No."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={chosen.length === 0 || !so.trim()}
            onClick={() => save.mutate()}
          >
            Mark {chosen.length || ''} graduated
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Diploma" htmlFor="batch-program">
            <Select id="batch-program" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">All diplomas</option>
              {(programs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date graduated" htmlFor="batch-on">
            <TextInput id="batch-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </Field>
          <Field label="Special Order No." htmlFor="batch-so">
            <AutoFillInput id="batch-so" value={so} onChange={setSo} suggestions={suggest.specialOrderNos} historyKey="so-number" placeholder="1124-DP-…" />
          </Field>
        </div>

        <QueryState
          isLoading={candidates.isLoading}
          error={candidates.error}
          isEmpty={rows.length === 0}
          onRetry={() => candidates.refetch()}
          emptyTitle="No one is ready to graduate"
          emptyHint="Trainees appear here once every subject of their curriculum is passed or credited."
        >
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>
              {rows.length} eligible · {cleared.length} with a complete clearance
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(Object.fromEntries(cleared.map((r) => [r.studentId, r.nstpSerialNo])))}
              disabled={cleared.length === 0}
            >
              Select all cleared
            </Button>
          </div>
          <TableWrap>
            <Table className="min-w-[44rem]">
              <thead>
                <tr>
                  <Th className="w-10"> </Th>
                  <Th>Trainee</Th>
                  <Th>Diploma</Th>
                  <Th>Clearance</Th>
                  <Th>NSTP Serial No.</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isChosen = r.studentId in selected;
                  return (
                    <tr key={r.studentId} className={r.clearance.complete ? '' : 'opacity-70'}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Choose ${r.name}`}
                          checked={isChosen}
                          disabled={!r.clearance.complete}
                          onChange={() => toggle(r.studentId, r.nstpSerialNo)}
                        />
                      </Td>
                      <Td>
                        <span className="block font-medium text-ink-900">{r.name}</span>
                        <span className="block text-xs text-ink-500">{r.studentNumber}</span>
                      </Td>
                      <Td className="text-xs">{r.programCode}</Td>
                      <Td className="text-xs">
                        {r.clearance.complete ? (
                          <Badge tone="success">Complete</Badge>
                        ) : (
                          <span className="text-warning-ink">
                            Lacks {r.clearance.missing.join(', ')} — mark them received on their own page first
                          </span>
                        )}
                      </Td>
                      <Td>
                        <AutoFillInput
                          aria-label={`NSTP Serial No. of ${r.name}`}
                          value={isChosen ? selected[r.studentId] ?? '' : r.nstpSerialNo ?? ''}
                          disabled={!isChosen}
                          onChange={(v) => setSelected((cur) => ({ ...cur, [r.studentId]: v }))}
                          suggestions={suggest.nstpSerialNos}
                          historyKey="nstp-serial"
                          placeholder="TVET-NSTP-CWTS-…"
                          className="min-w-[14rem]"
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </QueryState>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}
