import type { Notification, Role } from '@/types';
import { cloneAll, db, nextId, nowIso } from '../repositories/db';

export interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  category: Notification['category'];
  link?: string | null;
}

export function notify(input: NotifyInput): Notification {
  const entry: Notification = {
    id: nextId('ntf'),
    userId: input.userId,
    title: input.title,
    body: input.body,
    category: input.category,
    link: input.link ?? null,
    isRead: false,
    createdAt: nowIso(),
  };
  db.notifications.unshift(entry);
  return entry;
}

/** Fan a notification out to every account holding one of the given roles. */
export function notifyRoles(roles: Role[], input: Omit<NotifyInput, 'userId'>): void {
  for (const user of db.users) {
    if (roles.includes(user.role) && user.status === 'APPROVED') {
      notify({ ...input, userId: user.id });
    }
  }
}

export function listNotifications(userId: string): Notification[] {
  return cloneAll(
    db.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export function unreadCount(userId: string): number {
  return db.notifications.filter((n) => n.userId === userId && !n.isRead).length;
}
