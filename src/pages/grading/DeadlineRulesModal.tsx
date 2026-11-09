import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScholarshipCode } from '@/types';
import type { DeadlineRuleOptions } from '@/types/views';
import { gradeDeadlinesApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import { formatDate } from '@/lib/format';
import { useToast } from '@/context/ToastContext';
import { Button, Field, InfoNote, Modal, Select, Table, TableWrap, Td, TextInput, Th } from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * Sets a grade deadline in one step: choose the diploma, then narrow it by
 * term, section, scholarship and batch (the year first enrolled), and give
 * the date. Every open class that fits gets it — no semester-by-semester
 * setting. Nothing narrowed sets the terms' own deadline.
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
  const narrowed = Boolean(sectionId || scholarship || batch);
  const earliestStart = sectionTerms.map((t) => t.startDate).sort().at(-1);

  const after = (next: DeadlineRuleOptions) => {
    queryClient.setQueryData(['deadline-rules'], next);
    for (const key of ['dashboard', 'grading-sheets', 'grade-deadline-alerts', 'deadline-overrides', 'semesters', 'head-trainer']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const save = useMutation({
    mutationFn: () =>
      gradeDeadlinesApi.setRule({
        programId,
        semesterId: semesterId || null,
        sectionId: sectionId || null,
        scholarship: (scholarship || null) as ScholarshipCode | null,
        batch: batch || null,
        dueDate,
      }),
    onSuccess: (next) => {
      after(next);
      toast.success('Deadline set.', `${covered.length} class${covered.length === 1 ? '' : 'es'} now due ${formatDate(dueDate)}.`);
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
      description="Choose who it is for, then the date. Every open class that fits gets it at once."
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

              <InfoNote tone={covered.length === 0 ? 'warning' : 'info'}>
                {covered.length === 0
                  ? 'No open class with trainees fits this choice yet. You can still set it; it applies once one does.'
                  : `Covers ${covered.length} open class${covered.length === 1 ? '' : 'es'}.`}{' '}
                {narrowed
                  ? 'A deadline for one class, set from Grading Sheets, still comes first.'
                  : 'Nothing narrowed: this becomes the term’s own deadline.'}
              </InfoNote>
              {error ? <InfoNote tone="danger">{error}</InfoNote> : null}
              <div className="flex justify-end">
                <Button variant="primary" loading={save.isPending} disabled={!programId || !dueDate} onClick={() => save.mutate()}>
                  Set deadline
                </Button>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-ink-900">Deadlines already set for this diploma</p>
                {rules.length === 0 ? (
                  <p className="text-sm text-ink-500">None beyond the terms’ own deadlines.</p>
                ) : (
                  <TableWrap className="relative">
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
                              {[
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
