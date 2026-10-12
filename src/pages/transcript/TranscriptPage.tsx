import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StudentView, TranscriptBlock, TranscriptView } from '@/types/views';
import { studentsApi, transcriptApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { INSTITUTION, SIGNATORIES } from '@/config/institution';
import { GRADE_POINTS } from '@/server/services/grade-rules';
import { Badge, Button, Card, Field, InfoNote, Modal, PageHeader, TextInput } from '@/components/ui';
import { EmptyState, QueryState } from '@/components/states';
import { StudentPicker } from '@/components/pickers';
import { PickerButton } from '@/components/RecordPicker';
import korphilLogo from '@/assets/korphil-logo.png';
import tesdaLogo from '@/assets/tesda-logo.png';

/**
 * Transcript & Graduation.
 *
 * Marking a trainee graduated — with the date and the Special Order No. TESDA
 * issued — and printing their Transcript of Records, which carries both. The
 * TOR includes the previous school's subjects for a college undergraduate,
 * and any subjects credited from them.
 */
export function TranscriptPage() {
  const [params, setParams] = useSearchParams();
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [graduating, setGraduating] = useState(false);

  // Opened from the Completion report with ?student=<id>.
  const linkedId = params.get('student');
  const linked = useQuery({
    queryKey: ['student', linkedId],
    queryFn: () => studentsApi.get(linkedId ?? ''),
    enabled: Boolean(linkedId) && !student,
  });
  useEffect(() => {
    if (linked.data && !student) setStudent(linked.data);
  }, [linked.data, student]);

  const tor = useQuery({
    queryKey: ['transcript', student?.id],
    queryFn: () => transcriptApi.get(student?.id ?? ''),
    enabled: Boolean(student),
  });
  const data = tor.data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Transcript & Graduation"
          description="Mark an eligible trainee graduated with their Special Order No., and print the Transcript of Records."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="no-print h-fit space-y-4">
          <Card className="p-4">
            <PickerButton
              label="Trainee"
              value={student ? `${student.lastFirstName} · ${student.studentNumber}` : null}
              placeholder="Choose a trainee…"
              onClick={() => setPickerOpen(true)}
              onClear={() => {
                setStudent(null);
                setParams({});
              }}
            />
          </Card>

          {data ? (
            <Card className="p-4">
              <p className="text-sm font-semibold text-ink-900">Graduation</p>
              {data.student.status === 'GRADUATED' ? (
                <>
                  <div className="mt-2">
                    <Badge tone="success">Graduated</Badge>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div>
                      <dt className="text-xs text-ink-500">Date graduated</dt>
                      <dd className="font-medium text-ink-900">{data.graduatedOn ? formatDate(data.graduatedOn) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">Special Order No.</dt>
                      <dd className="font-mono font-medium text-ink-900">{data.specialOrderNo ?? '—'}</dd>
                    </div>
                  </dl>
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => setGraduating(true)}>
                    Edit graduation details
                  </Button>
                </>
              ) : data.graduation.eligible ? (
                <>
                  <p className="mt-2 text-sm text-success-ink">
                    ✓ Eligible — all {data.graduation.subjectsRequired} curriculum subjects passed or credited.
                  </p>
                  <Button variant="primary" className="mt-3 w-full" onClick={() => setGraduating(true)}>
                    Mark as graduated
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm text-ink-700">
                    Not yet eligible — {data.graduation.subjectsDone} of {data.graduation.subjectsRequired} subjects done.
                  </p>
                  {data.graduation.hasUnresolvedInc ? (
                    <p className="mt-1 text-xs text-warning-ink">An INC is still unresolved.</p>
                  ) : null}
                  <p className="mt-2 text-xs text-ink-500">
                    Still to pass: {data.graduation.remaining.slice(0, 8).join(', ')}
                    {data.graduation.remaining.length > 8 ? ` and ${data.graduation.remaining.length - 8} more` : ''}
                  </p>
                </>
              )}
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a trainee"
              hint="Patricia Gonzales (DAT) has finished every term and is eligible to graduate — a good one to try."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a trainee
                </Button>
              }
            />
          ) : (
            <QueryState isLoading={tor.isLoading} error={tor.error} onRetry={() => tor.refetch()} loadingLabel="Building the transcript…">
              {data ? (
                <>
                  <div className="no-print flex flex-wrap items-center justify-between gap-2">
                    {data.student.status !== 'GRADUATED' ? (
                      <p className="text-xs text-ink-500">
                        Not graduated yet — the TOR prints without the graduation statement until they are.
                      </p>
                    ) : (
                      <span />
                    )}
                    <Button variant="primary" onClick={() => window.print()}>
                      Print TOR
                    </Button>
                  </div>
                  <TorSheet data={data} />
                </>
              ) : null}
            </QueryState>
          )}
        </div>
      </div>

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(s) => {
          setStudent(s);
          setParams({ student: s.id });
        }}
        selectedId={student?.id ?? null}
      />
      {data ? <GraduateModal open={graduating} onClose={() => setGraduating(false)} data={data} /> : null}
    </>
  );
}

function GraduateModal({ open, onClose, data }: { open: boolean; onClose: () => void; data: TranscriptView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const editing = data.student.status === 'GRADUATED';
  const [on, setOn] = useState(data.graduatedOn ?? new Date().toISOString().slice(0, 10));
  const [so, setSo] = useState(data.specialOrderNo ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOn(data.graduatedOn ?? new Date().toISOString().slice(0, 10));
      setSo(data.specialOrderNo ?? '');
      setError(null);
    }
  }, [open, data.graduatedOn, data.specialOrderNo]);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? transcriptApi.updateGraduation(data.student.id, { graduatedOn: on, specialOrderNo: so })
        : transcriptApi.markGraduated(data.student.id, { graduatedOn: on, specialOrderNo: so }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcript', data.student.id] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['report'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Graduation details updated.' : `${data.student.fullName} marked graduated.`, 'The TOR now carries the SO number.');
      onClose();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit graduation details' : 'Mark as graduated'}
      description={`${data.student.fullName} · ${data.student.programName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            {editing ? 'Save' : 'Mark graduated'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Date graduated" htmlFor="grad-on">
          <TextInput id="grad-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        </Field>
        <Field label="Special Order No." htmlFor="grad-so" hint="As issued by TESDA, e.g. 1124-DP-ICT-0226-2026.">
          <TextInput id="grad-so" value={so} onChange={(e) => setSo(e.target.value)} placeholder="1124-DP-…" />
        </Field>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}

/** The TOR, after the centre's own: header, trainee block, terms, graduation, grading system. */
function TorSheet({ data }: { data: TranscriptView }) {
  const s = data.student;
  const long = (iso: string | null) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return (
    <Card className="print-sheet tor-sheet space-y-4 p-6 text-[12px] text-ink-900">
      <header className="flex items-center gap-3 border-b-2 border-ink-900 pb-3">
        <img src={tesdaLogo} alt="TESDA" className="h-16 w-16 shrink-0 object-contain" />
        <div className="min-w-0 flex-1 text-center leading-tight">
          <p className="text-[11px]">Republic of the Philippines</p>
          <p className="text-[11px] font-semibold uppercase">{INSTITUTION.agency}</p>
          <p className="font-bold uppercase">{INSTITUTION.centre}</p>
          <p className="text-[11px]">{INSTITUTION.address}</p>
          <p className="mt-2 text-base font-bold tracking-wide">OFFICIAL TRANSCRIPT OF RECORDS</p>
        </div>
        <img src={korphilLogo} alt="KorPhil" className="h-16 w-16 shrink-0 object-contain" />
      </header>

      <p className="text-sm">
        <span className="font-semibold">Name: </span>
        <span className="font-bold uppercase">
          {s.lastName}, {s.firstName} {s.middleName}
        </span>
      </p>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-0.5 sm:grid-cols-2">
        <TorField label="TOR No." value={data.torNumber} />
        <TorField label="Learner’s ID" value={s.learnerId} />
        <TorField label="Home Address" value={s.address} />
        <TorField label="Birth Date" value={long(s.birthDate)} />
        <TorField label="Birth Place" value={s.birthPlace} />
        <TorField label="Secondary School" value={s.secondarySchool} />
        <TorField label="Last Attended" value={s.secondarySchoolYearAttended} />
        <TorField label="Basis of Admission" value={s.basisOfAdmission} />
        <TorField label="Date Admitted" value={long(s.dateAdmitted)} />
        <TorField label="Course" value={data.courseName} />
        <TorField label="Date Graduated" value={long(data.graduatedOn)} />
        <TorField label="NSTP Serial No." value={s.nstpSerialNo} />
      </dl>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y-2 border-ink-900 text-left text-[11px] uppercase">
            <th className="w-28 py-1 pr-2">Course Code</th>
            <th className="py-1 pr-2">Course Title</th>
            <th className="w-20 py-1 pr-2 text-center">Final</th>
            <th className="w-24 py-1 pr-2 text-center">Completion</th>
            <th className="w-16 py-1 text-right">Units</th>
          </tr>
        </thead>
        <tbody>
          {data.previousSchools.map((school) => (
            <SchoolRows key={school.schoolName} name={school.schoolName} blocks={school.blocks} />
          ))}
          {data.credited ? <BlockRows block={data.credited} note="Credited from the previous school" /> : null}
          {data.previousSchools.length > 0 ? (
            <tr>
              <td colSpan={5} className="pt-3 font-bold uppercase">
                {INSTITUTION.centre}
              </td>
            </tr>
          ) : null}
          {data.blocks.map((block, i) => (
            <BlockRows key={`${block.heading}-${i}`} block={block} />
          ))}
          <tr>
            <td colSpan={5} className="py-2 text-center text-[11px] tracking-widest">
              ------------------------------ TRANSCRIPT CLOSED ------------------------------
            </td>
          </tr>
        </tbody>
      </table>

      {data.student.status === 'GRADUATED' ? (
        <div className="break-inside-avoid">
          <p className="font-bold">GRADUATED:</p>
          <p className="font-semibold uppercase">
            FROM THE THREE-YEAR {data.courseName} AS OF {long(data.graduatedOn).toUpperCase()}.
          </p>
          <p className="font-semibold">Special Order No.: {data.specialOrderNo}</p>
        </div>
      ) : null}

      <div className="break-inside-avoid text-[11px]">
        <p className="font-bold">NOTE:</p>
        <p>
          This transcript is valid only when it bears the seal of the center and the original signature in ink of
          the Registrar and Center Administrator. Any erasure or alteration made on the entries of this form
          renders the whole transcript invalid.
        </p>
        <p className="mt-1">
          <span className="font-bold">Remarks: </span>
          {data.student.status === 'GRADUATED' ? 'Not valid for transfer.' : 'For evaluation purposes only.'}
        </p>
      </div>

      <div className="grid break-inside-avoid grid-cols-2 gap-8 pt-6 text-center text-[11px]">
        <div>
          <p className="border-t border-ink-900 pt-1 font-bold uppercase">{SIGNATORIES.registrarName}</p>
          <p>{SIGNATORIES.registrarTitle}</p>
        </div>
        <div>
          <p className="border-t border-ink-900 pt-1 font-bold uppercase">{SIGNATORIES.centerAdminName}</p>
          <p>{SIGNATORIES.centerAdminTitle}</p>
        </div>
      </div>

      <div className="break-inside-avoid border-t border-ink-400 pt-2">
        <p className="mb-1 text-[10px] font-bold uppercase">Grading System</p>
        <div className="grid grid-cols-2 gap-x-4 text-[10px] sm:grid-cols-3">
          {GRADE_POINTS.map((p) => (
            <p key={p.value}>
              <span className="font-semibold">{p.value}</span> · {p.percentage} · {p.descriptor}
            </p>
          ))}
          <p>
            <span className="font-semibold">INC</span> · Incomplete
          </p>
          <p>
            <span className="font-semibold">DRP</span> · Dropped
          </p>
          <p>
            <span className="font-semibold">CRD</span> · Credited
          </p>
        </div>
        <p className="mt-2 text-right text-[10px] italic">NOT VALID WITHOUT CENTER SEAL</p>
      </div>
    </Card>
  );
}

function TorField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[8.5rem_0.75rem_1fr]">
      <dt>{label}</dt>
      <dd>:</dd>
      <dd className="font-medium">{value || ''}</dd>
    </div>
  );
}

function SchoolRows({ name, blocks }: { name: string; blocks: TranscriptBlock[] }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="pt-2 font-bold uppercase">
          {name}
        </td>
      </tr>
      {blocks.map((block) => (
        <BlockRows key={block.heading} block={block} />
      ))}
    </>
  );
}

function BlockRows({ block, note }: { block: TranscriptBlock; note?: string }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="pt-2 font-semibold italic">
          {block.heading}
          {note ? <span className="ml-2 font-normal not-italic text-ink-500">({note})</span> : null}
        </td>
      </tr>
      {block.rows.map((row, i) => (
        <tr key={`${row.courseCode}-${i}`} className="align-top">
          <td className="pr-2">{row.courseCode}</td>
          <td className="pr-2">{row.courseTitle}</td>
          <td className="pr-2 text-center tabular-nums">{row.rating}</td>
          <td className="pr-2 text-center tabular-nums">{row.completion}</td>
          <td className="text-right tabular-nums">{row.units}</td>
        </tr>
      ))}
    </>
  );
}
