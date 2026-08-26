/**
 * Durability for the in-memory store.
 *
 * The original build re-seeded on every reload, which was fine while the only
 * way in was the registrar's own keyboard. It stopped being fine once an
 * applicant could submit from the public form: their application has to still
 * be in the Pending queue when the registrar reloads, and — since both pages
 * are the same origin — localStorage is the one place both can see.
 *
 * This is a snapshot, not a database. It is per-browser, it is not shared
 * between machines, and a registrar on another computer sees their own copy.
 * A real deployment replaces this file with a server; nothing else changes,
 * because everything above still talks to `db`.
 */

import type { Database } from './db';

const STORAGE_KEY = 'registream.db';

/**
 * Bumped whenever the shape of anything in `Database` changes.
 *
 * A snapshot written by an older build is discarded rather than migrated: a
 * half-understood record is worse than a clean re-seed, and the seed is
 * deterministic anyway. Forgetting to bump this is what would let a stale
 * snapshot missing new required fields reach the UI as `undefined`.
 */
const SCHEMA_VERSION = 7;

interface Snapshot {
  version: number;
  savedAt: string;
  data: Database;
}

function storage(): Storage | null {
  try {
    // Private windows and blocked-site-data settings throw on access itself,
    // not on use — so the probe has to be inside the try.
    const probe = window.localStorage;
    const key = '__registream_probe__';
    probe.setItem(key, '1');
    probe.removeItem(key);
    return probe;
  } catch {
    return null;
  }
}

/** The stored snapshot, or null if there is none we can trust. */
export function loadSnapshot(): Database | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (parsed.version !== SCHEMA_VERSION || !parsed.data) {
      // Written by a different build of the app — start clean.
      store.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data as Database;
  } catch {
    // Corrupt or unreadable. Losing a prototype's snapshot is survivable;
    // booting into a broken store is not.
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      /* nothing more we can do */
    }
    return null;
  }
}

let pending = 0;

/**
 * Writes the snapshot, coalescing bursts.
 *
 * Every API call triggers a save, and a page load fires several at once, so
 * the write is deferred to the end of the task and collapsed into one.
 */
export function saveSnapshot(data: Database): void {
  const store = storage();
  if (!store) return;

  if (pending) window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = 0;
    const snapshot: Snapshot = {
      version: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      data,
    };
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Almost certainly the ~5MB quota. Dropping the save is the right
      // failure: the app keeps working from memory for this session.
    }
  }, 150);
}

/** Drops the snapshot so the next load re-seeds. */
export function clearSnapshot(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

export { STORAGE_KEY };
