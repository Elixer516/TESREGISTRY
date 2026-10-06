import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { MIN_RESPONSES_FOR_TRAINER } from '@/lib/faculty-evaluation-form';
import { InfoNote, PageHeader } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { EvaluationResultCard } from '@/components/EvaluationResultCard';

/**
 * A trainer's own faculty evaluation results — combined, anonymous, and only
 * for terms that are over, so nothing seen here can colour a grade still to
 * be given.
 */
export function TrainerEvaluationsPage() {
  const query = useQuery({ queryKey: ['my-evaluation-results'], queryFn: () => mineApi.evaluationResults() });

  return (
    <>
      <PageHeader
        title="My Evaluation Results"
        description="How your trainees rated your classes, once each term is over. Ratings are 1 (Strongly Disagree) to 5 (Strongly Agree)."
      />
      <div className="mb-4">
        <InfoNote tone="info">
          Results are anonymous: you see the class&rsquo;s combined ratings and comments, never who gave
          them, and only when at least {MIN_RESPONSES_FOR_TRAINER} trainees have answered.
        </InfoNote>
      </div>
      {query.isLoading ? (
        <LoadingState label="Loading your results…" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          title="No results yet"
          hint="Results appear here after a term ends and your trainees have evaluated your classes."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(query.data ?? []).map((result) => (
            <EvaluationResultCard key={result.classScheduleId} result={result} />
          ))}
        </div>
      )}
    </>
  );
}
