import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { InfoNote, PageHeader } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';

export function TraineeSchedulePage() {
  const query = useQuery({ queryKey: ['my-schedule'], queryFn: () => mineApi.schedule() });

  return (
    <>
      <PageHeader
        title="My Schedule"
        description="Your published classes for the active term. Draft schedules are never shown to trainees."
      />

      {query.isLoading ? (
        <LoadingState label="Loading your week…" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <WeeklyCalendar
            schedules={query.data ?? []}
            emptyHint="Nothing is published for your section yet, or you are not enrolled in the active term. Ask the Registrar if you think this is wrong."
          />
          <div className="mt-4">
            <InfoNote tone="info" title="Overlapping classes">
              If two classes fall at the same hour they are shown side by side rather than stacked,
              so nothing is hidden behind anything else. Click any block for the full details.
            </InfoNote>
          </div>
        </>
      )}
    </>
  );
}
