import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { Button } from '@/components/ui';
import { GradeEvaluationDocument } from '../evaluation/GradeEvaluationSheet';
import { PortalCard, PortalHeading } from './portal-ui';

/**
 * The trainee's own Grade Evaluation Form — the centre's form, whole, with
 * backlogs and credited subjects. Grades still waiting on a faculty
 * evaluation stay masked here, exactly as on the Grades tab.
 */
export function TraineeGradeEvaluationPage() {
  const query = useQuery({ queryKey: ['my-record'], queryFn: () => mineApi.evaluation() });
  const locked = (query.data?.groups ?? []).reduce((n, g) => n + g.rows.filter((r) => r.lockedForEvaluation).length, 0);

  return (
    <>
      <PortalHeading
        title="Grade Evaluation"
        description="Your whole record on the centre’s Grade Evaluation Form, from your first term to now."
        actions={
          <Button variant="primary" disabled={!query.data} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        }
      />
      {locked > 0 ? (
        <div className="no-print mb-4 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          🔒 {locked} grade{locked === 1 ? ' is' : 's are'} hidden until you evaluate the trainer.{' '}
          <Link to="/portal/evaluations" className="font-semibold underline">
            Go to Evaluations
          </Link>
        </div>
      ) : null}
      <PortalCard>
        <GradeEvaluationDocument
          data={query.data}
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        />
      </PortalCard>
    </>
  );
}
