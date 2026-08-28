import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

/**
 * How one column sorts.
 *
 * `value` returns what to compare, not what to display — the two are often
 * different, and sorting the display string is how a table ends up putting
 * 1:00 PM before 7:00 AM. Return a number for anything measured, a string for
 * anything named, and a small number for an ordered enum whose alphabetical
 * order means nothing (a status, a year level).
 *
 * `defaultDirection` is the direction the column takes on its FIRST click.
 * Names want A–Z; dates and counts almost always want largest first, because
 * nobody opens a table to look at the oldest row.
 */
export interface SortColumn<T> {
  value: (row: T) => string | number;
  defaultDirection?: SortDirection;
}

export interface SortState<K> {
  key: K;
  direction: SortDirection;
}

/**
 * Client-side table sorting.
 *
 * Clicking a new column sorts by it in that column's natural direction;
 * clicking the column already sorted reverses it. There is deliberately no
 * third "unsorted" state — a trainer hunting for one row wants to flip
 * between ends of a list, not cycle past a state that looks like nothing
 * happened.
 *
 * Ties fall back to the original array order, which is already meaningful
 * wherever the server sorted before sending.
 */
export function useSort<T, K extends string>(
  rows: T[],
  columns: Record<K, SortColumn<T>>,
  initial: SortState<K>,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const sorted = useMemo(() => {
    const column = columns[sort.key];
    if (!column) return rows;
    const factor = sort.direction === 'asc' ? 1 : -1;

    // Decorated with the original index so equal rows keep the order they
    // arrived in rather than being shuffled by an unstable comparison.
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const left = column.value(a.row);
        const right = column.value(b.row);
        if (left === right) return a.index - b.index;

        const result =
          typeof left === 'number' && typeof right === 'number'
            ? left - right
            : String(left).localeCompare(String(right), undefined, {
                numeric: true,
                sensitivity: 'base',
              });
        return result * factor;
      })
      .map((entry) => entry.row);
  }, [rows, columns, sort]);

  function toggle(key: K) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: columns[key]?.defaultDirection ?? 'asc' },
    );
  }

  return { sorted, sort, toggle };
}
