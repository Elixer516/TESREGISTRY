import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mineApi } from '@/api';
import { formatDateTime } from '@/lib/format';
import { Badge, Button, Card, PageHeader } from '@/components/ui';
import { QueryState } from '@/components/states';
import { useToast } from '@/context/ToastContext';

const CATEGORY_TONE = {
  SCHEDULE: 'info',
  DOCUMENT: 'brand',
  AVAILABILITY: 'warning',
  ACCOUNT: 'danger',
  GENERAL: 'neutral',
} as const;

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => mineApi.notifications(),
  });

  const markAll = useMutation({
    mutationFn: () => mineApi.markAllRead(),
    onSuccess: (rows) => {
      queryClient.setQueryData(['notifications'], rows);
      toast.success('All notifications marked as read.');
    },
  });

  const markOne = useMutation({
    mutationFn: (id: string) => mineApi.markRead(id),
    onSuccess: (rows) => queryClient.setQueryData(['notifications'], rows),
  });

  const rows = query.data ?? [];
  const unread = rows.filter((row) => !row.isRead).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Messages addressed to your account. Nobody else can see these."
        actions={
          <Button
            variant="secondary"
            disabled={unread === 0 || markAll.isPending}
            loading={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            Mark all read
          </Button>
        }
      />

      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={rows.length === 0}
        onRetry={() => query.refetch()}
        emptyTitle="No notifications yet"
        emptyHint="You will be told here when a schedule is published, a document request moves, or an account needs attention."
      >
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-start gap-3 p-4">
                <Badge tone={CATEGORY_TONE[row.category]}>{row.category}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{row.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500">{row.body}</p>
                  <p className="mt-1 text-xs text-ink-400">{formatDateTime(row.createdAt)}</p>
                </div>
                {row.isRead ? (
                  <span className="text-xs text-ink-400">Read</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => markOne.mutate(row.id)}>
                    Mark read
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </QueryState>
    </>
  );
}
