/**
 * The transport seam.
 *
 * Every call the UI makes goes through `request`, which adds a small delay and
 * surfaces failures as `ApiError`. Swapping this file for `fetch` is the only
 * change a real backend would require — the pages never learn the difference.
 */

import { ApiError } from '@/lib/api-error';

const SIMULATED_LATENCY_MS = 120;

function normalize(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const message =
    error instanceof Error ? error.message : 'The server returned an unexpected error.';
  return new ApiError(500, 'BAD_REQUEST', message);
}

export function request<T>(operation: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(operation());
      } catch (error) {
        reject(normalize(error));
      }
    }, SIMULATED_LATENCY_MS);
  });
}
