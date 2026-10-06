import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EvaluationTaskView } from '@/types/views';
import { mineApi } from '@/api';
import { formatDate } from '@/lib/format';
import { ErrorState, LoadingState } from '@/components/states';
import { Pill, PortalCard, PortalHeading } from './portal-ui';

/**
 * Faculty Evaluation — one card per subject taken. An evaluation opens once
 * the subject's grade is posted, and answering it is what shows that grade.
 */
export function TraineeEvaluationsPage() {
  const query = useQuery({ queryKey: ['my-evaluations'], queryFn: () => mineApi.evaluationTasks() });

  if (query.isLoading) return <LoadingState label="Loading your evaluations…" />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const tasks = query.data ?? [];
  const pending = tasks.filter((t) => t.status === 'PENDING');
  const waiting = tasks.filter((t) => t.status === 'AWAITING_GRADE');
  const done = tasks.filter((t) => t.status === 'DONE');

  return (
    <>
      <PortalHeading
        title="Faculty Evaluation"
        description="Evaluate the trainer of each subject you took. Your grade for a subject appears as soon as you evaluate it."
      />

      <div className="mb-5 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold text-warning-ink">NOTICE:</span> Your answers are{' '}
        <strong>anonymous</strong> — trainers see only combined results from the whole class, after the
        term. The data is handled in accordance with <strong>RA 10173</strong>, the Data Privacy Act of
        2012, and used only to improve training at the centre.
      </div>

      <Section title="To evaluate" count={pending.length} empty="Nothing to evaluate right now — well done.">
        {pending.map((task) => (
          <TaskCard key={task.enrollmentSubjectId} task={task} />
        ))}
      </Section>

      {waiting.length > 0 ? (
        <Section title="Opens when the grade is posted" count={waiting.length}>
          {waiting.map((task) => (
            <TaskCard key={task.enrollmentSubjectId} task={task} />
          ))}
        </Section>
      ) : null}

      {done.length > 0 ? (
        <Section title="Evaluated" count={done.length}>
          {done.map((task) => (
            <TaskCard key={task.enrollmentSubjectId} task={task} />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-500">
        {title}
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-ink-700">{count}</span>
      </h3>
      {count === 0 && empty ? (
        <PortalCard>
          <p className="text-sm text-ink-500">{empty}</p>
        </PortalCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

function TaskCard({ task }: { task: EvaluationTaskView }) {
  return (
    <PortalCard className="flex flex-col p-4">
      <p className="text-base font-bold text-ink-900">{task.subjectCode}</p>
      <p className="text-sm uppercase text-ink-700">{task.subjectTitle}</p>
      <p className="mt-2 text-xs text-ink-500">
        {task.trainerName}
        <br />
        {task.academicYearLabel} · {task.termLabel}
      </p>
      <div className="mt-auto pt-4">
        {task.status === 'PENDING' ? (
          <Link
            to={`/portal/evaluations/${task.enrollmentSubjectId}`}
            className="inline-flex items-center rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            Evaluate now
          </Link>
        ) : task.status === 'DONE' ? (
          <Pill tone="success">✓ Evaluated {task.submittedAt ? formatDate(task.submittedAt) : ''}</Pill>
        ) : (
          <Pill tone="neutral">Grade not yet posted</Pill>
        )}
      </div>
    </PortalCard>
  );
}
