/**
 * This school year's trainees, split by diploma, as a donut with a legend.
 *
 * Drawn as plain SVG rather than through a chart library: one chart does not
 * justify a dependency, and the app has to keep working offline.
 *
 * The legend carries the numbers. A slice shows proportion at a glance, but
 * "DAT · 42 · 18%" is what a registrar quotes, and colour alone would leave
 * anyone who cannot tell two hues apart with nothing to read.
 */

import { useState } from 'react';
import type { RegistrarDashboard } from '@/types/views';

type Data = RegistrarDashboard['enrollmentByDiploma'];

/** Thirteen distinguishable hues, legible on both the light and dark canvas. */
const COLOURS = [
  '#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626', '#0891b2', '#ca8a04',
  '#db2777', '#4f46e5', '#65a30d', '#0d9488', '#c2410c', '#7c3aed',
];

const SIZE = 180;
const RADIUS = 80;
const HOLE = 50;

export function EnrollmentByDiplomaChart({ data }: { data: Data }) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.total === 0) {
    return (
      <p className="p-4 text-sm text-ink-500">
        Nobody is enrolled{data.schoolYearLabel ? ` in ${data.schoolYearLabel}` : ''} yet.
      </p>
    );
  }

  const percent = (count: number) => (count / data.total) * 100;
  const focus = data.slices.find((s) => s.programId === hovered) ?? null;

  let angle = 0;
  const arcs = data.slices.map((slice, index) => {
    const sweep = (slice.count / data.total) * Math.PI * 2;
    const arc = { ...slice, colour: COLOURS[index % COLOURS.length], start: angle, end: angle + sweep };
    angle += sweep;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-44 w-44 shrink-0"
        role="img"
        aria-label={`Trainees enrolled by diploma: ${data.slices
          .map((s) => `${s.code} ${s.count}`)
          .join(', ')}`}
      >
        {arcs.map((arc) => (
          <path
            key={arc.programId}
            d={slicePath(arc.start, arc.end)}
            fill={arc.colour}
            stroke="var(--surface)"
            strokeWidth={1.5}
            opacity={hovered && hovered !== arc.programId ? 0.35 : 1}
            onMouseEnter={() => setHovered(arc.programId)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>
              {arc.code} · {arc.count} · {percent(arc.count).toFixed(1)}%
            </title>
          </path>
        ))}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="fill-ink-900 text-[22px] font-bold"
        >
          {focus ? `${percent(focus.count).toFixed(0)}%` : data.total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          className="fill-ink-500 text-[10px]"
        >
          {focus ? focus.code : 'trainees'}
        </text>
      </svg>

      <ul className="w-full min-w-0 flex-1 space-y-1 text-sm">
        {arcs.map((arc) => (
          <li
            key={arc.programId}
            className={
              'flex items-center gap-2 rounded px-1.5 py-0.5 ' +
              (hovered === arc.programId ? 'bg-surface-2' : '')
            }
            onMouseEnter={() => setHovered(arc.programId)}
            onMouseLeave={() => setHovered(null)}
            title={arc.name}
          >
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: arc.colour }}
            />
            <span className="w-24 shrink-0 font-medium text-ink-900">{arc.code}</span>
            <span className="flex-1 tabular-nums text-ink-700">
              {arc.count} trainee{arc.count === 1 ? '' : 's'}
            </span>
            <span className="tabular-nums font-medium text-ink-900">
              {percent(arc.count).toFixed(1)}%
            </span>
          </li>
        ))}
        <li className="mt-1 flex items-center gap-2 border-t border-line px-1.5 pt-1.5">
          <span className="h-3 w-3 shrink-0" aria-hidden />
          <span className="w-24 shrink-0 font-semibold text-ink-900">Total</span>
          <span className="flex-1 tabular-nums font-semibold text-ink-900">
            {data.total} trainee{data.total === 1 ? '' : 's'}
          </span>
          <span className="tabular-nums font-semibold text-ink-900">100%</span>
        </li>
      </ul>
    </div>
  );
}

/** A donut segment from `start` to `end` radians, clockwise from 12 o'clock. */
function slicePath(start: number, end: number): string {
  const c = SIZE / 2;
  // A lone diploma is a full ring; an arc from a point back to itself draws
  // nothing, so it is split into two halves.
  if (end - start >= Math.PI * 2 - 1e-6) {
    return slicePath(0, Math.PI) + ' ' + slicePath(Math.PI, Math.PI * 2);
  }
  const point = (r: number, a: number) =>
    `${(c + r * Math.sin(a)).toFixed(3)} ${(c - r * Math.cos(a)).toFixed(3)}`;
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(RADIUS, start)}`,
    `A ${RADIUS} ${RADIUS} 0 ${large} 1 ${point(RADIUS, end)}`,
    `L ${point(HOLE, end)}`,
    `A ${HOLE} ${HOLE} 0 ${large} 0 ${point(HOLE, start)}`,
    'Z',
  ].join(' ');
}
