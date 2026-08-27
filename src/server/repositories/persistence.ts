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
import { createSeedDatabase } from '../data/seed';

const STORAGE_KEY = 'registream.db';

/**
 * Bumped when the shape of a record changes in a way the fingerprint below
 * cannot see — a new field on an existing entity, say.
 *
 * A snapshot written by an older build is discarded rather than migrated: a
 * half-understood record is worse than a clean re-seed, and the seed is
 * deterministic anyway.
 */
const SCHEMA_VERSION = 9;

interface Snapshot {
  version: number;
  savedAt: string;
  /** What the seed looked like when this was written. See `seedFingerprint`. */
  fingerprint: string;
  data: Database;
}

/**
 * A cheap description of the seed this build ships.
 *
 * This exists because relying on SCHEMA_VERSION alone has now failed twice.
 * Forgetting to bump it once shipped a snapshot missing a whole collection,
 * and again shipped one whose user accounts no longer matched the login page
 * — the page reads the seed, the login reads the store, and a stale store
 * meant advertising accounts that did not exist.
 *
 * The fingerprint is derived from the parts of the seed a build is most
 * likely to change: which collections exist, which accounts are seeded, and
 * which diplomas and subjects. If any of those differ from the snapshot, it
 * was written by a different build and is discarded — no bump required.
 */
function seedFingerprint(): string {
  const seed = createSeedDatabase();
  const parts = [
    Object.keys(seed).sort().join(','),
    seed.users.map((u) => u.email).sort().join(','),
    seed.programs.map((p) => p.code).sort().join(','),
    `subjects:${seed.subjects.length}`,
    `semesters:${seed.semesters.length}`,
  ];
  return parts.join('|');
}

/** Computed once — the seed is deterministic, so it cannot change at runtime. */
let cachedFingerprint: string | null = null;
function currentFingerprint(): string {
  if (cachedFingerprint === null) cachedFingerprint = seedFingerprint();
  return cachedFingerprint;
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
    if (
      parsed.version !== SCHEMA_VERSION ||
      !parsed.data ||
      parsed.fingerprint !== currentFingerprint()
    ) {
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
      fingerprint: currentFingerprint(),
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
