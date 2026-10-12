import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreditSuggestion, CreditingWorkspace, StudentView } from '@/types/views';
import { creditsApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { useToast } from '@/context/ToastContext';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  InfoNote,
  Modal,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  TextArea,
  TextInput,
  Th,
} from '@/components/ui';
import { EmptyState, QueryState } from '@/components/states';
import { StudentPicker } from '@/components/pickers';
import { PickerButton } from '@/components/RecordPicker';

const STRENGTH = {
  STRONG: { label: 'Strong match', tone: 'success' },
  LIKELY: { label: 'Likely match', tone: 'info' },
  POSSIBLE: { label: 'Possible match', tone: 'warning' },
} as const;

/**
 * Crediting — for a college undergraduate who passed subjects elsewhere.
 *
 * Three steps on one screen: type in the previous school's subjects (they
 * also print on the TOR), review what the system suggests each one matches
 * in the trainee's curriculum, and confirm the credits. A credited subject
 * is not offered at enrolment, counts toward graduation, and prints CRD.
 */
export function CreditingPage() {
  const [student, setStudent] = useState<StudentView | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const workspace = useQuery({
    queryKey: ['crediting', student?.id],
    queryFn: () => creditsApi.workspace(student?.id ?? ''),
    enabled: Boolean(student),
  });

  const refresh = (data: CreditingWorkspace) => {
    queryClient.setQueryData(['crediting', student?.id], data);
    queryClient.invalidateQueries({ queryKey: ['grade-evaluation', student?.id] });
    queryClient.invalidateQueries({ queryKey: ['enrollment-options'] });
  };

  const credit = useMutation({
    mutationFn: (s: { subjectId: string; recordIds: string[]; note?: string }) =>
      creditsApi.credit(student?.id ?? '', s.subjectId, s.recordIds, s.note),
    onSuccess: (data) => {
      refresh(data);
      toast.success('Subject credited.', 'It will not be offered at enrolment, and prints as CRD.');
    },
    onError: (caught) => toast.error('Could not credit it.', errorMessage(caught)),
  });
  const uncredit = useMutation({
    mutationFn: (creditId: string) => creditsApi.removeCredit(creditId),
    onSuccess: (data) => {
      refresh(data);
      toast.success('Credit removed.');
    },
    onError: (caught) => toast.error('Could not remove it.', errorMessage(caught)),
  });
  const removeRecord = useMutation({
    mutationFn: (recordId: string) => creditsApi.removeRecord(recordId),
    onSuccess: refresh,
    onError: (caught) => toast.error('Could not remove it.', errorMessage(caught)),
  });

  const data = workspace.data;

  return (
    <>
      <PageHeader
        title="Crediting"
        description="For college undergraduates: record the subjects passed at the previous school, review the matches the system suggests, and confirm what to credit."
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="no-print h-fit p-4">
          <PickerButton
            label="Trainee"
            value={student ? `${student.lastFirstName} · ${student.studentNumber}` : null}
            placeholder="Choose a trainee…"
            onClick={() => setPickerOpen(true)}
            onClear={() => setStudent(null)}
          />
          {data ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Diploma</dt>
                <dd className="font-medium text-ink-900">{data.student.programCode}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Previous subjects</dt>
                <dd className="font-medium text-ink-900">{data.records.length}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Credited</dt>
                <dd className="font-medium text-ink-900">
                  {data.credits.length} subject{data.credits.length === 1 ? '' : 's'} · {data.creditedUnits} units
                </dd>
              </div>
            </dl>
          ) : null}
        </Card>

        <div className="min-w-0 space-y-4">
          {!student ? (
            <EmptyState
              title="Choose a trainee"
              hint="Pick the college undergraduate whose earlier subjects you are crediting. Ella Torres (DIT) has a previous-school record on file to try it with."
              action={
                <Button variant="primary" onClick={() => setPickerOpen(true)}>
                  Find a trainee
                </Button>
              }
            />
          ) : (
            <QueryState
              isLoading={workspace.isLoading}
              error={workspace.error}
              onRetry={() => workspace.refetch()}
              loadingLabel="Matching subjects…"
            >
              {data ? (
                <>
                  {!data.student.curriculumId ? (
                    <InfoNote tone="warning" title="Approve this trainee first">
                      Crediting is against the curriculum that approval assigns. You can record the
                      previous school&rsquo;s subjects now and credit them after approval.
                    </InfoNote>
                  ) : null}

                  {/* ---- Step 1: the previous school's subjects ---- */}
                  <Card>
                    <CardHeader
                      title="1 · Subjects from the previous school"
                      description="As the transcript the trainee brought lists them. These also print on the TOR."
                      actions={
                        <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                          Add subjects
                        </Button>
                      }
                    />
                    {data.records.length === 0 ? (
                      <p className="p-4 text-sm text-ink-500">None recorded yet.</p>
                    ) : (
                      <TableWrap>
                        <Table className="min-w-[44rem]">
                          <thead>
                            <tr>
                              <Th>Term</Th>
                              <Th>Code</Th>
                              <Th>Title</Th>
                              <Th className="text-right">Grade</Th>
                              <Th className="text-right">Units</Th>
                              <Th>Credited as</Th>
                              <Th className="text-right"> </Th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.records.map((r) => (
                              <tr key={r.id}>
                                <Td className="text-xs text-ink-500">
                                  {r.schoolYear}
                                  <span className="block">{r.schoolName}</span>
                                </Td>
                                <Td className="font-medium text-ink-900">{r.courseCode}</Td>
                                <Td>{r.courseTitle}</Td>
                                <Td className="text-right tabular-nums">
                                  <span className={r.passed ? 'text-ink-900' : 'font-semibold text-danger-ink'}>
                                    {r.grade}
                                    {r.completionGrade ? ` / ${r.completionGrade}` : ''}
                                  </span>
                                </Td>
                                <Td className="text-right tabular-nums">{r.units}</Td>
                                <Td className="text-xs">
                                  {r.creditedAs ? (
                                    <Badge tone="success">{r.creditedAs}</Badge>
                                  ) : r.passed ? (
                                    <span className="text-ink-400">—</span>
                                  ) : (
                                    <span className="text-danger-ink">Not passed — cannot be credited</span>
                                  )}
                                </Td>
                                <Td className="text-right">
                                  {r.creditedAs ? null : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeRecord.mutate(r.id)}
                                      aria-label={`Remove ${r.courseCode}`}
                                    >
                                      Remove
                                    </Button>
                                  )}
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </TableWrap>
                    )}
                  </Card>

                  {/* ---- Step 2: what the system suggests ---- */}
                  <Card>
                    <CardHeader
                      title="2 · Suggested matches"
                      description="Each passed subject against the curriculum subjects not yet passed or credited — by title, code and units. Confirm the ones that are truly equivalent."
                      actions={
                        <Button size="sm" variant="secondary" onClick={() => setManual(true)} disabled={!data.student.curriculumId}>
                          Credit manually
                        </Button>
                      }
                    />
                    {data.suggestions.length === 0 ? (
                      <p className="p-4 text-sm text-ink-500">
                        No suggestions. Every passed subject is either credited already or matches
                        nothing in the curriculum — use Credit manually for a match the system did not see.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {data.suggestions.map((s) => (
                          <SuggestionRow
                            key={`${s.previousRecordId}-${s.subjectId}`}
                            suggestion={s}
                            busy={credit.isPending}
                            onConfirm={() => credit.mutate({ subjectId: s.subjectId, recordIds: [s.previousRecordId] })}
                          />
                        ))}
                      </ul>
                    )}
                  </Card>

                  {/* ---- Step 3: what is credited ---- */}
                  <Card>
                    <CardHeader
                      title="3 · Credited subjects"
                      description="Counted as earned toward graduation, and printed as CRD on the Grade Evaluation and the TOR."
                    />
                    {data.credits.length === 0 ? (
                      <p className="p-4 text-sm text-ink-500">Nothing credited yet.</p>
                    ) : (
                      <TableWrap>
                        <Table className="min-w-[40rem]">
                          <thead>
                            <tr>
                              <Th>Curriculum subject</Th>
                              <Th className="text-right">Units</Th>
                              <Th>Credited from</Th>
                              <Th>By</Th>
                              <Th className="text-right"> </Th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.credits.map((c) => (
                              <tr key={c.id}>
                                <Td>
                                  <span className="block font-medium text-ink-900">{c.subjectCode}</span>
                                  <span className="block text-xs text-ink-500">{c.subjectTitle}</span>
                                </Td>
                                <Td className="text-right tabular-nums">{c.units}</Td>
                                <Td className="text-xs">
                                  {c.from.map((f) => `${f.courseCode} ${f.courseTitle} (${f.grade})`).join('; ')}
                                  {c.note ? <span className="block text-ink-500">{c.note}</span> : null}
                                </Td>
                                <Td className="text-xs text-ink-500">{c.creditedByName}</Td>
                                <Td className="text-right">
                                  <Button size="sm" variant="ghost" onClick={() => uncredit.mutate(c.id)}>
                                    Remove
                                  </Button>
                                </Td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </TableWrap>
                    )}
                  </Card>
                </>
              ) : null}
            </QueryState>
          )}
        </div>
      </div>

      <StudentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setStudent}
        selectedId={student?.id ?? null}
      />
      {student && data ? (
        <AddRecordsModal
          open={adding}
          onClose={() => setAdding(false)}
          studentId={student.id}
          defaultSchool={data.records[0]?.schoolName ?? ''}
          onSaved={(next) => {
            refresh(next);
            setAdding(false);
          }}
        />
      ) : null}
      {data ? (
        <ManualCreditModal
          open={manual}
          onClose={() => setManual(false)}
          workspace={data}
          busy={credit.isPending}
          onSubmit={(subjectId, recordIds, note) =>
            credit.mutate({ subjectId, recordIds, note }, { onSuccess: () => setManual(false) })
          }
        />
      ) : null}
    </>
  );
}

function SuggestionRow({
  suggestion: s,
  busy,
  onConfirm,
}: {
  suggestion: CreditSuggestion;
  busy: boolean;
  onConfirm: () => void;
}) {
  const strength = STRENGTH[s.strength];
  return (
    <li className="flex flex-wrap items-center gap-4 px-4 py-3">
      <div className="min-w-[12rem] flex-1">
        <p className="text-xs uppercase tracking-wide text-ink-500">Previous school</p>
        <p className="font-medium text-ink-900">
          {s.previousCode} · {s.previousTitle}
        </p>
        <p className="text-xs text-ink-500">
          Grade {s.previousGrade} · {s.previousUnits} units
        </p>
      </div>
      <span aria-hidden className="text-xl text-ink-400">→</span>
      <div className="min-w-[12rem] flex-1">
        <p className="text-xs uppercase tracking-wide text-ink-500">{s.termLabel}</p>
        <p className="font-medium text-ink-900">
          {s.subjectCode} · {s.subjectTitle}
        </p>
        <p className="text-xs text-ink-500">{s.subjectUnits} units</p>
      </div>
      <div className="w-48">
        <Badge tone={strength.tone}>
          {strength.label} · {Math.round(s.score * 100)}%
        </Badge>
        <p className="mt-1 text-[11px] text-ink-500">{s.reasons.join(' · ')}</p>
      </div>
      <Button size="sm" variant="primary" loading={busy} onClick={onConfirm}>
        Credit it
      </Button>
    </li>
  );
}

interface DraftRow {
  schoolYear: string;
  courseCode: string;
  courseTitle: string;
  grade: string;
  units: string;
}
const blankRow = (term = ''): DraftRow => ({ schoolYear: term, courseCode: '', courseTitle: '', grade: '', units: '3' });

function AddRecordsModal({
  open,
  onClose,
  studentId,
  defaultSchool,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  defaultSchool: string;
  onSaved: (data: CreditingWorkspace) => void;
}) {
  const toast = useToast();
  const [school, setSchool] = useState(defaultSchool);
  const [rows, setRows] = useState<DraftRow[]>([blankRow()]);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      creditsApi.addRecords(
        studentId,
        rows
          .filter((r) => r.courseTitle.trim() || r.courseCode.trim())
          .map((r) => ({ ...r, schoolName: school, units: Number(r.units) })),
      ),
    onSuccess: (data) => {
      toast.success('Subjects recorded.');
      setRows([blankRow()]);
      setError(null);
      onSaved(data);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const set = (index: number, key: keyof DraftRow, value: string) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [key]: value } : r)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Add subjects from the previous school"
      description="One line per subject, as the transcript shows it. Grades are kept exactly as that school wrote them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            Save subjects
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="School and programme" htmlFor="prev-school">
          <TextInput
            id="prev-school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="e.g. Davao Polytechnic College - BS Information Technology"
          />
        </Field>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-500">
                <th className="pb-1 pr-2 font-medium">Term</th>
                <th className="pb-1 pr-2 font-medium">Code</th>
                <th className="pb-1 pr-2 font-medium">Title</th>
                <th className="pb-1 pr-2 font-medium">Grade</th>
                <th className="pb-1 pr-2 font-medium">Units</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="pb-1.5 pr-2">
                    <TextInput aria-label="Term" value={row.schoolYear} onChange={(e) => set(index, 'schoolYear', e.target.value)} placeholder="1st Semester, 2024-2025" />
                  </td>
                  <td className="w-28 pb-1.5 pr-2">
                    <TextInput aria-label="Code" value={row.courseCode} onChange={(e) => set(index, 'courseCode', e.target.value)} />
                  </td>
                  <td className="pb-1.5 pr-2">
                    <TextInput aria-label="Title" value={row.courseTitle} onChange={(e) => set(index, 'courseTitle', e.target.value)} />
                  </td>
                  <td className="w-20 pb-1.5 pr-2">
                    <TextInput aria-label="Grade" value={row.grade} onChange={(e) => set(index, 'grade', e.target.value)} placeholder="1.75" />
                  </td>
                  <td className="w-16 pb-1.5 pr-2">
                    <TextInput aria-label="Units" inputMode="decimal" value={row.units} onChange={(e) => set(index, 'units', e.target.value)} />
                  </td>
                  <td className="pb-1.5">
                    {rows.length > 1 ? (
                      <Button size="sm" variant="ghost" onClick={() => setRows((r) => r.filter((_, i) => i !== index))} aria-label="Remove line">
                        ✕
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setRows((r) => [...r, blankRow(r[r.length - 1]?.schoolYear ?? '')])}>
          + Another subject
        </Button>
        {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
      </div>
    </Modal>
  );
}

function ManualCreditModal({
  open,
  onClose,
  workspace,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  workspace: CreditingWorkspace;
  busy: boolean;
  onSubmit: (subjectId: string, recordIds: string[], note: string) => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [recordIds, setRecordIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const open_ = workspace.curriculumSubjects.filter((s) => s.status === 'OPEN');
  const creditable = workspace.records.filter((r) => r.passed && !r.creditedAs);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Credit a subject manually"
      description="For an equivalence the suggestions did not catch — a subject renamed, or two of theirs that together cover one of ours."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!subjectId || recordIds.length === 0}
            onClick={() => onSubmit(subjectId, recordIds, note)}
          >
            Credit it
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Curriculum subject" htmlFor="manual-subject">
          <Select id="manual-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Choose…</option>
            {open_.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.code} — {s.title} ({s.units} u) · {s.termLabel}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-900">Credited from</legend>
          {creditable.length === 0 ? (
            <p className="text-sm text-ink-500">No passed subject is left to credit from.</p>
          ) : (
            <div className="space-y-1">
              {creditable.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recordIds.includes(r.id)}
                    onChange={(e) =>
                      setRecordIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((id) => id !== r.id)))
                    }
                  />
                  {r.courseCode} {r.courseTitle} — {r.grade}, {r.units} units
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <Field label="Note (optional)" htmlFor="manual-note">
          <TextArea id="manual-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Content matched against the syllabus provided." />
        </Field>
      </div>
    </Modal>
  );
}
