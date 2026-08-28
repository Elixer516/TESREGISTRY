import { useQuery } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { InfoNote, PageHeader } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/states';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';

/**
 * A trainer's own weekly teaching timetable.
 *
 * Before this, a trainer had exactly one screen — Grading Sheets — and it
 * lists classes as a plain table (subject, section, reference, status) with
 * no day, time or room anywhere. There was no way for a trainer to see their
 * own week at a glance; that lived only on the registrar's Class Schedules,
 * which a trainer cannot open.
 *
 * Scoped to their currently open semesters, same as a trainee's own schedule
 * — a trainer teaches one year level of one diploma, and a closed semester's
 * classes would otherwise share the calendar grid with the open one.
 */
export function TrainerSchedulePage() {
  const query = useQuery({
    queryKey: ['my-teaching-schedule'],
    queryFn: () => mineApi.teachingSchedule(),
  });

  return (
    <>
      <PageHeader
        title="My Schedule"
        description="Your published classes for the currently open semester."
      />

      {query.isLoading ? (
        <LoadingState label="Loading your week…" />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <WeeklyCalendar
            schedules={query.data ?? []}
            emptyHint="Nothing is published for you yet, or no semester is open for your diploma and year level. Ask the Registrar if you think this is wrong."
          />
          <div className="mt-4">
            <InfoNote tone="info" title="Overlapping classes">
              If two classes fall at the same hour they are shown side by side rather than
              stacked, so nothing is hidden behind anything else. Click any block for the full
              details.
            </InfoNote>
          </div>
        </>
      )}
    </>
  );
}
