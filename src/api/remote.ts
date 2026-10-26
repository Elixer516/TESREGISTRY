/**
 * `serverApi`, answered by the `api` Edge Function instead of this tab.
 *
 * Same shape as `serverApi`, so `src/api/index.ts` calls one or the other
 * without knowing which: `backend.students.list(filters)` either runs the
 * service here (demo build) or posts `{ op: 'students.list', args }` to
 * Supabase, which runs the very same service against the real database.
 * Remote calls return promises; `request` in ./client awaits either kind.
 */

import { ApiError, type ApiErrorCode, type ApiErrorOptions } from '@/lib/api-error';
import { isSupabaseMode, supabase } from '@/lib/supabase';
import { serverApi } from '@/server/api';

interface RemoteError extends ApiErrorOptions {
  status: number;
  code: ApiErrorCode;
  message: string;
}

/** Posts one operation to the `api` Edge Function. */
export async function invokeRemote<T>(op: string, args: unknown[]): Promise<T> {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  const { data, error } = await supabase.functions.invoke('api', { body: { op, args } });
  if (!error) return (data as { result: T }).result;
  const response = (error as { context?: Response }).context;
  const payload = (await response?.json().catch(() => null)) as { error?: RemoteError } | null;
  const failure = payload?.error;
  if (!failure) {
    throw new ApiError(503, 'BAD_REQUEST', 'The server could not be reached. Check the connection and try again.');
  }
  throw new ApiError(failure.status, failure.code, failure.message, {
    conflicts: failure.conflicts ?? undefined,
    details: failure.details ?? undefined,
    rowErrors: failure.rowErrors ?? undefined,
  });
}

const remote = new Proxy({} as typeof serverApi, {
  get: (_, namespace: string) =>
    new Proxy(
      {},
      {
        get:
          (__, name: string) =>
          (...args: unknown[]) =>
            invokeRemote(`${namespace}.${name}`, args),
      },
    ),
});

/** Where `src/api` sends every call: the Edge Function in Supabase mode, this tab otherwise. */
export const backend: typeof serverApi = isSupabaseMode ? remote : serverApi;
