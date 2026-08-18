import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { classNames, relativeTime } from '@/lib/format';
import { Button } from './ui';

/** Bell with an unread count. Every notification is scoped to its recipient. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => mineApi.notifications(),
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const markRead = useMutation({
    mutationFn: (id: string) => mineApi.markRead(id),
    onSuccess: (rows) => queryClient.setQueryData(['notifications'], rows),
  });

  const markAll = useMutation({
    mutationFn: () => mineApi.markAllRead(),
    onSuccess: (rows) => queryClient.setQueryData(['notifications'], rows),
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const bellLabel = unread > 0 ? 'Notifications, ' + unread + ' unread' : 'Notifications';

  return (
    <div className="no-print relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={bellLabel}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-700 hover:bg-surface-2"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="animate-in absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface shadow-xl"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            <Button
              size="sm"
              variant="ghost"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-ink-500">
                Nothing yet. Messages about schedules, documents and your account arrive here.
              </p>
            ) : (
              <ul>
                {notifications.slice(0, 12).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!item.isRead) markRead.mutate(item.id);
                        if (item.link) {
                          navigate(item.link);
                          setOpen(false);
                        }
                      }}
                      className={classNames(
                        'w-full border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-2',
                        !item.isRead && 'bg-brand-soft',
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <span
                          aria-hidden
                          className={classNames(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            !item.isRead && 'bg-brand',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink-900">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-500">{item.body}</span>
                          <span className="mt-1 block text-[11px] text-ink-400">
                            {relativeTime(item.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
