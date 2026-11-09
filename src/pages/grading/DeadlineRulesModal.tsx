import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeadlineRuleOptions } from '@/types/views';
import { gradeDeadlinesApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, Table, TableWrap, Td, TextInput, Th } from '@/components/ui';
import { classNames } from '@/lib/format';
import { QueryState } from '@/components/states';

/**
 * Sets a grade deadline in one step: choose the diploma, narrow it by term,
 * section, scholarship and batch (the year first enrolled), and the classes
 * that fit are listed with a tick each. Every ticked class gets the date as
 * its own deadline, which comes before any other rule, so what is ticked is
 * exactly what changes.
 */
export function DeadlineRulesModal({
  open,
  onClose,
  programCode,
}: {
  open: boolean;
  onClose: () => void;
  /** The diploma tab the page is on, to start the form from. */
  programCode?: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [programId, setProgramId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [scholarship, setScholarship] = useState('');
  const [batch, setBatch] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Classes the Registrar unticked. Cleared whenever the choice changes. */
  const [unticked, setUnticked] = useState<Set<string>>(new Set());

  const options = useQuery({
    queryKey: ['deadline-rules'],
    queryFn: () => gradeDeadlinesApi.rules(),
    enabled: open,
  });
  const data = options.data;

  // Start from the diploma the page is showing, when it has an open term.
  useEffect(() => {
    if (!open || !data || programId) return;
    const match = data.programs.find((p) => p.code === programCode) ?? data.programs[0];
    if (match) setProgramId(match.programId);
  }, [open, data, programCode, programId]);

  const reset = () => {
    setSemesterId('');
    setSectionId('');
    setScholarship('');
    setBatch('');
    setDueDate('');
    setError(null);
    setUnticked(new Set());
  };
  const close = () => {
    reset();
    setProgramId('');
    onClose();
  };

  const terms = useMemo(() => (data?.terms ?? []).filter((t) => t.programId === programId), [data, programId]);
  const term = terms.find((t) => t.semesterId === semesterId);
  const sections = useMemo(
    () => (data?.sections ?? []).filter((s) => s.programId === programId && (!term || s.yearLevel === term.yearLevel)),
    [data, programId, term],
  );
  const section = sections.find((s) => s.sectionId === sectionId);
  const sectionTerms = section ? terms.filter((t) => t.yearLevel === section.yearLevel) : terms;

  /** The open classes the current choice covers. */
  const covered = useMemo(
    () =>
      (data?.classes ?? []).filter(
        (c) =>
          c.programId === programId &&
          (!semesterId || c.semesterId === semesterId) &&
          (!sectionId || c.sectionId === sectionId) &&
          (!scholarship || c.scholarships.includes(scholarship)) &&
          (!batch || c.batches.includes(batch)),
      ),
    [data, programId, semesterId, sectionId, scholarship, batch],
  );
  const batches = useMemo(
    () =>
      [
        ...new Set(
          (data?.classes ?? [])
            .filter((c) => c.programId === programId && (!semesterId || c.semesterId === semesterId) && (!sectionId || c.sectionId === sectionId))
            .flatMap((c) => c.batches),
        ),
      ]
        .sort()
        .reverse(),
    [data, programId, semesterId, sectionId],
  );
  // A new choice starts with every class it covers ticked again.
  useEffect(() => setUnticked(new Set()), [programId, semesterId, sectionId, scholarship, batch]);
  const ticked = covered.filter((c) => !unticked.has(c.classScheduleId));
  const toggle = (id: string) =>
    setUnticked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const earliestStart = sectionTerms.map((t) => t.startDate).sort().at(-1);

  const after = (next: DeadlineRuleOptions) => {
    queryClient.setQueryData(['deadline-rules'], next);
    for (const key of ['dashboard', 'grading-sheets', 'grade-deadline-alerts', 'deadline-overrides', 'semesters', 'head-trainer']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const save = useMutation({
    mutationFn: () =>
      gradeDeadlinesApi.setForClasses({ classScheduleIds: ticked.map((c) => c.classScheduleId), dueDate }),
    onSuccess: (next) => {
      after(next);
      toast.success('Deadline set.', `${ticked.length} class${ticked.length === 1 ? '' : 'es'} now due ${formatDate(dueDate)}.`);
      reset();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => gradeDeadlinesApi.removeRule(id),
    onSuccess: after,
    onError: (caught) => toast.error('Could not remove it.', errorMessage(caught)),
  });

  const rules = (data?.rules ?? []).filter((r) => !programId || r.programCode === data?.programs.find((p) => p.programId === programId)?.code);

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Set grade deadline"
      description="Choose who it is for, tick the classes, then the date. Every ticked class gets it at once."
    >
      <QueryState isLoading={options.isLoading} error={options.error} onRetry={() => options.refetch()}>
        {data ? (
          data.programs.length === 0 ? (
            <p className="text-sm text-ink-500">No diploma has an open term. Open one under School Years &amp; Semesters first.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Diploma" htmlFor="dr-program">
                  <Select
                    id="dr-program"
                    value={programId}
                    onChange={(e) => {
                      setProgramId(e.target.value);
                      reset();
                    }}
                  >
                    {data.programs.map((p) => (
                      <option key={p.programId} value={p.programId}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Term" htmlFor="dr-term">
                  <Select
                    id="dr-term"
                    value={semesterId}
                    onChange={(e) => {
                      setSemesterId(e.target.value);
                      setSectionId('');
                      setBatch('');
                    }}
                  >
                    <option value="">All open terms</option>
                    {terms.map((t) => (
                      <option key={t.semesterId} value={t.semesterId}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Section" htmlFor="dr-section">
                  <Select
                    id="dr-section"
                    value={sectionId}
                    onChange={(e) => {
                      setSectionId(e.target.value);
                      setBatch('');
                    }}
                  >
                    <option value="">All sections</option>
                    {sections.map((s) => (
                      <option key={s.sectionId} value={s.sectionId}>
                        {s.code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Scholarship" htmlFor="dr-scholarship">
                  <Select id="dr-scholarship" value={scholarship} onChange={(e) => setScholarship(e.target.value)}>
                    <option value="">All scholarships</option>
                    {data.scholarships.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Batch" hint="The year the trainees first enrolled." htmlFor="dr-batch">
                  <Select id="dr-batch" value={batch} onChange={(e) => setBatch(e.target.value)}>
                    <option value="">All batches</option>
                    {batches.map((b) => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Grades due" htmlFor="dr-date">
                  <TextInput id="dr-date" type="date" value={dueDate} min={earliestStart} onChange={(e) => setDueDate(e.target.value)} />
                </Field>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900">
                    Classes {covered.length > 0 ? `· ${ticked.length} of ${covered.length} ticked` : ''}
                  </p>
                  {covered.length > 0 ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setUnticked(new Set())}>
                        Tick all
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setUnticked(new Set(covered.map((c) => c.classScheduleId)))}>
                        Untick all
                      </Button>
                    </div>
                  ) : null}
                </div>
                {covered.length === 0 ? (
                  <InfoNote tone="warning">No open class with trainees fits this choice. Try another section, scholarship or batch.</InfoNote>
                ) : (
                  <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                    {covered.map((c) => {
                      const on = !unticked.has(c.classScheduleId);
                      return (
                        <li key={c.classScheduleId}>
                          <label
                            className={classNames(
                              'flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-surface-2',
                              !on && 'text-ink-500',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => toggle(c.classScheduleId)}
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-ink-900">
                                {c.subjectCode} <span className="font-normal text-ink-500">· {c.subjectTitle}</span>
                              </span>
                              <span className="block text-xs text-ink-500">
                                {c.sectionCode} · {c.trainerName}
                                {c.batches.length ? ` · Batch ${c.batches.join(', ')}` : ''}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-ink-500">
                              {c.dueDate ? `Due ${formatDate(c.dueDate)}` : 'No deadline yet'}
                              {c.hasOwnDate ? <span className="block">its own date</span> : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
              <div className="flex justify-end">
                <Button variant="primary" loading={save.isPending} disabled={!dueDate || ticked.length === 0} onClick={() => save.mutate()}>
                  {ticked.length ? `Set deadline for ${ticked.length} class${ticked.length === 1 ? '' : 'es'}` : 'Set deadline'}
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink-900">Deadlines already set for this diploma</p>
                {rules.length === 0 ? (
                  <p className="text-sm text-ink-500">None yet: every class follows its term’s own deadline.</p>
                ) : (
                  <TableWrap className="relative max-h-64 overflow-y-auto">
                    <Table className="min-w-[36rem]">
                      <thead>
                        <tr>
                          <Th>Term</Th>
                          <Th>For</Th>
                          <Th>Grades due</Th>
                          <Th className="text-right">Classes</Th>
                          <Th className="text-right">
                            <span className="sr-only">Remove</span>
                          </Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((r) => (
                          <tr key={r.id}>
                            <Td>{r.termLabel}</Td>
                            <Td>
                              {r.isClass
                                ? `${r.subjectLabel} · ${r.sectionCode ?? ''} only`
                                : [
                                    r.subjectId ? r.subjectLabel : null,
                                    r.sectionCode ?? 'All sections',
                                    r.scholarship ?? 'All scholarships',
                                    r.batch ? `Batch ${r.batch}` : 'All batches',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Td>
                            <Td className="font-medium">{formatDate(r.dueDate)}</Td>
                            <Td className="text-right tabular-nums">{r.classCount}</Td>
                            <Td className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
                                Remove
                              </Button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </div>
            </div>
          )
        ) : null}
      </QueryState>
    </Modal>
  );
}
