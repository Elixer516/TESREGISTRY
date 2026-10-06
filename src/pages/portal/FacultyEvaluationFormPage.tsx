import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { errorMessage } from '@/lib/api-error';
import {
  ALL_EVALUATION_ITEMS,
  EVALUATION_AREAS,
  EVALUATION_COMMENTS,
  EVALUATION_NUMBERS,
  RATING_SCALE,
} from '@/lib/faculty-evaluation-form';
import { useToast } from '@/context/ToastContext';
import { Button, InfoNote, TextArea, TextInput } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { PortalCard } from './portal-ui';

/**
 * The Faculty Evaluation form for one subject.
 *
 * Laid out the way trainees know evaluation forms: the subject's details on
 * the left with a progress count that stays in view, lettered sections of
 * statements on the right, and Submit at the top. Each statement is a row of
 * five choices large enough to tap on a phone. Nothing is saved until
 * Submit, and leaving with answers given asks first.
 */
export function FacultyEvaluationFormPage() {
  const { enrollmentSubjectId = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tasks = useQuery({ queryKey: ['my-evaluations'], queryFn: () => mineApi.evaluationTasks() });
  const task = tasks.data?.find((t) => t.enrollmentSubjectId === enrollmentSubjectId);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [showMissing, setShowMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answered = Object.keys(ratings).length;
  const total = ALL_EVALUATION_ITEMS.length;
  const missingNumbers = EVALUATION_NUMBERS.filter((q) => {
    const v = Number(numbers[q.id]);
    return numbers[q.id] === undefined || numbers[q.id] === '' || !Number.isFinite(v) || v < q.min || v > q.max;
  });
  const missingComments = EVALUATION_COMMENTS.filter((q) => q.required && (comments[q.id] ?? '').trim().length < 2);
  const complete = answered === total && missingNumbers.length === 0 && missingComments.length === 0;
  const touched = answered > 0 || Object.keys(comments).length > 0;

  // Answers are lost on leaving; the browser asks first.
  useEffect(() => {
    if (!touched) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched]);

  const submit = useMutation({
    mutationFn: () =>
      mineApi.submitEvaluation(enrollmentSubjectId, {
        ratings,
        numbers: Object.fromEntries(Object.entries(numbers).map(([k, v]) => [k, Number(v)])),
        comments,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-evaluations'] }),
        queryClient.invalidateQueries({ queryKey: ['my-record'] }),
        queryClient.invalidateQueries({ queryKey: ['my-curriculum'] }),
      ]);
      toast.success('Thank you for your evaluation.', `Your grade for ${task?.subjectCode ?? 'this subject'} is now visible.`);
      navigate('/portal/grades');
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const onSubmit = () => {
    setError(null);
    if (!complete) {
      setShowMissing(true);
      const first =
        ALL_EVALUATION_ITEMS.find((i) => !ratings[i.id])?.id ??
        missingNumbers[0]?.id ??
        missingComments[0]?.id;
      if (first) document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    submit.mutate();
  };

  const pct = useMemo(() => Math.round((answered / total) * 100), [answered, total]);

  if (tasks.isLoading) return <LoadingState label="Opening the form…" />;
  if (tasks.error) return <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} />;
  if (!task || task.status !== 'PENDING') {
    return (
      <PortalCard>
        <p className="font-semibold text-ink-900">
          {task?.status === 'DONE' ? 'You have already evaluated this subject.' : 'This evaluation is not open.'}
        </p>
        <Link to="/portal/evaluations" className="mt-2 inline-block text-sm text-brand-text hover:underline">
          ← Back to Evaluations
        </Link>
      </PortalCard>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900">Faculty Evaluation</h2>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (!touched || window.confirm('Leave this form? Your answers will be lost.')) {
                navigate('/portal/evaluations');
              }
            }}
          >
            Change subject
          </Button>
          <Button variant="primary" loading={submit.isPending} onClick={onSubmit}>
            Submit
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        {/* The subject, and how far along the trainee is — kept in view. */}
        <aside className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <PortalCard className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Information</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Info label="Subject" value={task.subjectCode} />
              <Info label="Title" value={task.subjectTitle} />
              <Info label="Trainer" value={task.trainerName} />
              <Info label="Term" value={`${task.academicYearLabel} · ${task.termLabel}`} />
            </dl>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-ink-500">
                <span>Statements answered</span>
                <span className="tabular-nums">
                  {answered}/{total}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </PortalCard>
          <div className="rounded-2xl border border-warning/40 bg-warning-soft p-3 text-xs text-warning-ink">
            <strong>CAUTION:</strong> Answers are lost if you change subject or leave this page before
            submitting.
          </div>
        </aside>

        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-700">
            <strong className="text-warning-ink">INSTRUCTION:</strong> Please answer honestly. Every
            statement is required unless marked optional. Your answers are anonymous — your trainer sees
            only the class&rsquo;s combined results, after the term. When done, press{' '}
            <strong>Submit</strong> at the top.
          </div>

          {EVALUATION_AREAS.map((area) => (
            <section key={area.id}>
              <h3 className="mb-2 text-lg font-semibold text-ink-900">
                {area.id}. {area.title}
              </h3>
              <div className="space-y-3">
                {area.items.map((item, index) => {
                  const missing = showMissing && !ratings[item.id];
                  return (
                    <PortalCard
                      key={item.id}
                      className={`p-4 ${missing ? 'border-danger ring-1 ring-danger/40' : ''}`}
                    >
                      <fieldset id={`q-${item.id}`}>
                        <legend className="text-sm font-medium text-ink-900">
                          {index + 1}. {item.text}{' '}
                          <span className="text-[10px] font-semibold uppercase italic text-danger-ink">required</span>
                        </legend>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                          {RATING_SCALE.map((option) => {
                            const chosen = ratings[item.id] === option.value;
                            return (
                              <label
                                key={option.value}
                                className={
                                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors sm:flex-col sm:gap-1 sm:text-center ' +
                                  (chosen
                                    ? 'border-brand bg-brand text-white'
                                    : 'border-line text-ink-700 hover:bg-surface-2')
                                }
                              >
                                <input
                                  type="radio"
                                  className="sr-only"
                                  name={item.id}
                                  checked={chosen}
                                  onChange={() => setRatings((r) => ({ ...r, [item.id]: option.value }))}
                                />
                                <span className="text-base font-bold leading-none">{option.value}</span>
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    </PortalCard>
                  );
                })}
                {area.id === 'E'
                  ? EVALUATION_NUMBERS.map((question) => {
                      const missing = showMissing && missingNumbers.some((q) => q.id === question.id);
                      return (
                        <PortalCard key={question.id} className={`p-4 ${missing ? 'border-danger ring-1 ring-danger/40' : ''}`}>
                          <label id={`q-${question.id}`} className="block text-sm font-medium text-ink-900">
                            {question.text}{' '}
                            <span className="text-[10px] font-semibold uppercase italic text-danger-ink">required</span>
                            <TextInput
                              type="number"
                              min={question.min}
                              max={question.max}
                              className="mt-2 max-w-[8rem]"
                              value={numbers[question.id] ?? ''}
                              onChange={(event) => setNumbers((n) => ({ ...n, [question.id]: event.target.value }))}
                            />
                          </label>
                        </PortalCard>
                      );
                    })
                  : null}
              </div>
            </section>
          ))}

          <section>
            <h3 className="mb-2 text-lg font-semibold text-ink-900">F. Comments</h3>
            <div className="space-y-3">
              {EVALUATION_COMMENTS.map((question) => {
                const missing = showMissing && missingComments.some((q) => q.id === question.id);
                return (
                  <PortalCard key={question.id} className={`p-4 ${missing ? 'border-danger ring-1 ring-danger/40' : ''}`}>
                    <label id={`q-${question.id}`} className="block text-sm font-medium text-ink-900">
                      {question.text}{' '}
                      {question.required ? (
                        <span className="text-[10px] font-semibold uppercase italic text-danger-ink">required</span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase italic text-ink-400">optional</span>
                      )}
                      <TextArea
                        className="mt-2"
                        rows={3}
                        maxLength={1000}
                        value={comments[question.id] ?? ''}
                        onChange={(event) => setComments((c) => ({ ...c, [question.id]: event.target.value }))}
                      />
                    </label>
                  </PortalCard>
                );
              })}
            </div>
          </section>

          {showMissing && !complete ? (
            <InfoNote tone="warning" title="Some answers are missing">
              {total - answered > 0 ? `${total - answered} statement(s) still to rate. ` : ''}
              {missingNumbers.length > 0 ? `${missingNumbers.length} number question(s) still to answer. ` : ''}
              {missingComments.length > 0 ? `${missingComments.length} comment(s) still to write.` : ''}
            </InfoNote>
          ) : null}
          {error ? <InfoNote tone="danger">{error}</InfoNote> : null}

          <div className="flex justify-end">
            <Button variant="primary" loading={submit.isPending} onClick={onSubmit}>
              Submit evaluation
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}
