import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { Button } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { GsaSnapshotSheet } from '../gsa/GsaSnapshotSheet';
import { PortalHeading } from './portal-ui';

/**
 * Certificate of Registration (COR) for the current term — the same
 * document the Registrar prints.
 */
export function TraineeRegistrationPage() {
  const query = useQuery({ queryKey: ['my-gsa'], queryFn: () => mineApi.scheduleAssessment() });

  return (
    <>
      <PortalHeading
        title="Certificate of Registration"
        description="Your COR for this term: subjects, units and weekly schedule."
        actions={
          <Button variant="primary" disabled={!query.data?.subjects.length} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        }
      />
      {query.isLoading ? (
        <LoadingState label="Loading your registration…" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <GsaSnapshotSheet data={query.data} title="Certificate of Registration" />
      ) : null}
    </>
  );
}
