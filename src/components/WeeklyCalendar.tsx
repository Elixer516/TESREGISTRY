/**
 * Weekly class grid.
 *
 * Two classes on the same day at the same hour are packed into side-by-side
 * lanes rather than stacked on top of each other. Stacking would render both
 * unreadable exactly when the reader most needs to see the clash.
 */

import { useMemo, useState } from 'react';
import type { DayCode } from '@/types';
import { DAY_SHORT_LABELS } from '@/types';
import type { ClassScheduleView } from '@/types/views';
import { formatTime12h, timeToMinutes } from '@/lib/schedule-time';
import { classNames } from '@/lib/format';
import { EmptyState } from './states';
import { Modal } from './ui';
import { DescriptionItem } from './ui';

const GRID_DAYS: DayCode[] = ['M', 'T', 'W', 'Th', 'F', 'S'];
const ROW_HEIGHT = 56; // px per hour

interface PlacedEvent {
  schedule: ClassScheduleView;
  startMinutes: number;
  endMinutes: number;
  lane: number;
  laneCount: number;
}

/**
 * Greedy interval-graph colouring: walk the day's events in start order, drop
 * each into the first lane whose last event has already ended, and give every
 * event in a cluster the same lane count so the columns line up.
 */
function packLanes(events: Array<{ schedule: ClassScheduleView; start: number; end: number }>): PlacedEvent[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const placed: PlacedEvent[] = [];

  let cluster: PlacedEvent[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const flush = () => {
    const laneCount = Math.max(1, ...cluster.map((e) => e.lane + 1));
    for (const item of cluster) item.laneCount = laneCount;
    placed.push(...cluster);
    cluster = [];
    laneEnds.length = 0;
    clusterEnd = -1;
  };

  for (const event of sorted) {
    // A gap means the previous cluster is closed and its lane count is final.
    if (cluster.length > 0 && event.start >= clusterEnd) flush();

    let lane = laneEnds.findIndex((end) => end <= event.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(event.end);
    } else {
      laneEnds[lane] = event.end;
    }

    cluster.push({
      schedule: event.schedule,
      startMinutes: event.start,
      endMinutes: event.end,
      lane,
      laneCount: 1,
    });
    clusterEnd = Math.max(clusterEnd, event.end);
  }

  if (cluster.length > 0) flush();
  return placed;
}

export function WeeklyCalendar({
  schedules,
  emptyHint = 'Published classes will appear here once the Training Department publishes them.',
}: {
  schedules: ClassScheduleView[];
  emptyHint?: string;
}) {
  const [detail, setDetail] = useState<ClassScheduleView | null>(null);

  const { startHour, endHour, byDay } = useMemo(() => {
    let min = 7 * 60;
    let max = 18 * 60;
    for (const schedule of schedules) {
      min = Math.min(min, timeToMinutes(schedule.startTime));
      max = Math.max(max, timeToMinutes(schedule.endTime));
    }
    const from = Math.floor(min / 60);
    const to = Math.ceil(max / 60);

    const map = new Map<DayCode, PlacedEvent[]>();
    for (const day of GRID_DAYS) {
      const events = schedules
        .filter((s) => s.days.includes(day))
        .map((schedule) => ({
          schedule,
          start: timeToMinutes(schedule.startTime),
          end: timeToMinutes(schedule.endTime),
        }));
      map.set(day, packLanes(events));
    }

    return { startHour: from, endHour: to, byDay: map };
  }, [schedules]);

  if (schedules.length === 0) {
    return <EmptyState title="No classes to show" hint={emptyHint} icon="🗓" />;
  }

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = hours.length * ROW_HEIGHT;

  return (
    <>
      <div className="scroll-x rounded-xl border border-line bg-surface">
        <div className="min-w-[46rem]">
          {/* Day header */}
          <div className="flex border-b border-line bg-surface-2">
            <div className="w-16 shrink-0 px-2 py-2 text-[11px] font-semibold uppercase text-ink-400">
              Time
            </div>
            {GRID_DAYS.map((day) => (
              <div
                key={day}
                className="flex-1 border-l border-line px-2 py-2 text-center text-xs font-semibold text-ink-700"
              >
                {DAY_SHORT_LABELS[day]}
              </div>
            ))}
          </div>

          <div className="flex" style={{ height: gridHeight }}>
            {/* Hour axis */}
            <div className="w-16 shrink-0">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="border-b border-line px-2 pt-1 text-[11px] tabular-nums text-ink-400"
                  style={{ height: ROW_HEIGHT }}
                >
                  {formatTime12h(`${String(hour).padStart(2, '0')}:00`)}
                </div>
              ))}
            </div>

            {GRID_DAYS.map((day) => (
              <div key={day} className="relative flex-1 border-l border-line">
                {hours.map((hour) => (
                  <div key={hour} className="border-b border-line" style={{ height: ROW_HEIGHT }} />
                ))}

                {(byDay.get(day) ?? []).map((event) => {
                  const top =
                    ((event.startMinutes - startHour * 60) / 60) * ROW_HEIGHT;
                  const height = Math.max(
                    22,
                    ((event.endMinutes - event.startMinutes) / 60) * ROW_HEIGHT - 3,
                  );
                  const widthPct = 100 / event.laneCount;
                  const isDraft = event.schedule.status === 'DRAFT';

                  return (
                    <button
                      key={`${event.schedule.id}-${day}`}
                      type="button"
                      onClick={() => setDetail(event.schedule)}
                      title={`${event.schedule.subjectCode} — ${event.schedule.subjectTitle}\n${event.schedule.sectionCode} · ${event.schedule.timeRange}\n${event.schedule.room} · ${event.schedule.trainerName}`}
                      className={classNames(
                        'absolute overflow-hidden rounded-md border px-1.5 py-1 text-left transition-colors',
                        isDraft
                          ? 'border-dashed border-warning bg-warning-soft text-warning-ink hover:bg-warning-soft/80'
                          : 'border-transparent bg-brand text-white hover:bg-brand-hover',
                      )}
                      style={{
                        top,
                        height,
                        left: `calc(${event.lane * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <span className="block truncate text-[11px] font-semibold leading-tight">
                        {event.schedule.subjectCode}
                      </span>
                      <span className="block truncate text-[10px] leading-tight opacity-90">
                        {event.schedule.sectionCode}
                      </span>
                      {height > 44 ? (
                        <span className="block truncate text-[10px] leading-tight opacity-80">
                          {event.schedule.room}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.subjectCode} — ${detail.subjectTitle}` : ''}
        size="sm"
      >
        {detail ? (
          <dl className="grid grid-cols-2 gap-4">
            <DescriptionItem label="Section">{detail.sectionCode}</DescriptionItem>
            <DescriptionItem label="Units">{detail.units}</DescriptionItem>
            <DescriptionItem label="Days">{detail.dayPattern}</DescriptionItem>
            <DescriptionItem label="Time">{detail.timeRange}</DescriptionItem>
            <DescriptionItem label="Room">{detail.room}</DescriptionItem>
            <DescriptionItem label="Trainer">{detail.trainerName}</DescriptionItem>
            <DescriptionItem label="Term">
              {detail.academicYearLabel} · {detail.semesterLabel}
            </DescriptionItem>
            <DescriptionItem label="Status">{detail.status}</DescriptionItem>
          </dl>
        ) : null}
      </Modal>
    </>
  );
}
