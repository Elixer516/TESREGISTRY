/**
 * Live-updates every open tab when another one changes the store.
 *
 * This app has no backend and no websocket — "live" here means the browser's
 * own `storage` event, which fires in every OTHER tab of the same origin the
 * instant one tab calls `localStorage.setItem`. That is enough to make the
 * public form feel connected to the registrar's screen for a demo: open
 * /apply in one tab and Students → Pending in another, submit, and the
 * Pending table updates itself with no reload — which is what makes this
 * worth having, since a registrar showing the flow off would otherwise have
 * to explain away a stale table before refreshing it by hand.
 *
 * It cannot reach a different device or a different browser — `storage`
 * events are same-origin, this-browser-only, which matches everything else
 * this prototype promises. Renders nothing; it exists purely for the effect.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { STORAGE_KEY } from '@/server/repositories/persistence';
import { syncFromStorage } from '@/server/repositories/db';

export function CrossTabSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      // Not our key, or nothing actually changed (some browsers fire this
      // for same-value writes) — nothing to do.
      if (event.key !== STORAGE_KEY || event.newValue === event.oldValue) return;

      const changed = syncFromStorage();
      if (!changed) return;

      // Broad rather than targeted: this tab has no idea what the other one
      // just did — a new application, an approval, a grade — and every
      // screen reads the same in-memory store, so invalidating everything is
      // both correct and, since it is all synchronous and local, cheap.
      void queryClient.invalidateQueries();
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [queryClient]);

  return null;
}
