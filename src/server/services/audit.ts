import type { AuditAction, AuditLog, User } from '@/types';
import { db, nextId, nowIso } from '../repositories/db';
import { ROLE_LABELS } from '@/types';

export interface AuditInput {
  action: AuditAction;
  recordType: string;
  recordId: string;
  actor: User | null;
  detail: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export function actorLabel(actor: User | null, fallback = 'System'): string {
  if (!actor) return fallback;
  return `${actor.firstName} ${actor.lastName} (${ROLE_LABELS[actor.role]})`;
}

export function recordAudit(input: AuditInput): AuditLog {
  const entry: AuditLog = {
    id: nextId('aud'),
    action: input.action,
    recordType: input.recordType,
    recordId: input.recordId,
    userId: input.actor?.id ?? null,
    userLabel: actorLabel(input.actor),
    before: input.before ?? null,
    after: input.after ?? null,
    detail: input.detail,
    createdAt: nowIso(),
  };
  db.auditLogs.unshift(entry);
  return entry;
}

/** Log an action attributed to an unauthenticated subject (failed logins). */
export function recordAnonymousAudit(
  action: AuditAction,
  recordType: string,
  recordId: string,
  label: string,
  detail: string,
): AuditLog {
  const entry: AuditLog = {
    id: nextId('aud'),
    action,
    recordType,
    recordId,
    userId: null,
    userLabel: label,
    before: null,
    after: null,
    detail,
    createdAt: nowIso(),
  };
  db.auditLogs.unshift(entry);
  return entry;
}
