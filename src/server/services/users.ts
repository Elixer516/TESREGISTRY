/**
 * The audit trail, and the trainer list that schedules pick from.
 *
 * Account administration lived here until V9 removed it: accounts are seeded,
 * and creating them is an IT Admin job that this system does not yet host.
 * What remains is the read side — the record of what was done, and by whom.
 */

import type { AuditAction } from '@/types';
import { ALL_AUDIT_ACTIONS, auditActionLabel } from '@/types';
import type { AuditLogView, FacultyView } from '@/types/views';
import { db } from '../repositories/db';
import { toFacultyView } from '../repositories/lookups';
import { requireRole } from '../auth';

/* ---------------------------------------------------------------- */
/* Reads                                                             */
/* ---------------------------------------------------------------- */

export function listAllFaculty(query = ''): FacultyView[] {
  requireRole('REGISTRAR');
  const needle = query.trim().toLowerCase();
  return db.faculty
    .filter(
      (f) =>
        !needle ||
        `${f.firstName} ${f.lastName} ${f.employeeId} ${f.diploma}`
          .toLowerCase()
          .includes(needle),
    )
    .map(toFacultyView)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/* ---------------------------------------------------------------- */
/* Account creation                                                  */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* Account state changes                                             */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* Audit log                                                         */
/* ---------------------------------------------------------------- */

export interface AuditFilters {
  action?: AuditAction | 'ALL';
  recordType?: string | 'ALL';
  query?: string;
  limit?: number;
}

export function listAuditLogs(filters: AuditFilters = {}): AuditLogView[] {
  requireRole('REGISTRAR');
  let rows = [...db.auditLogs];

  if (filters.action && filters.action !== 'ALL') {
    rows = rows.filter((r) => r.action === filters.action);
  }
  if (filters.recordType && filters.recordType !== 'ALL') {
    rows = rows.filter((r) => r.recordType === filters.recordType);
  }
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    rows = rows.filter((r) =>
      `${r.detail} ${r.userLabel} ${r.recordId} ${auditActionLabel(r.action)}`
        .toLowerCase()
        .includes(needle),
    );
  }

  return rows
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, filters.limit ?? 300)
    .map((r) => ({
      id: r.id,
      action: r.action,
      actionLabel: auditActionLabel(r.action),
      recordType: r.recordType,
      recordId: r.recordId,
      userLabel: r.userLabel,
      detail: r.detail,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt,
    }));
}

/** Action list for the filter dropdown — machine id plus readable label. */
export function auditActionOptions(): Array<{ value: AuditAction; label: string }> {
  requireRole('REGISTRAR');
  return ALL_AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: auditActionLabel(action),
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export function auditRecordTypes(): string[] {
  requireRole('REGISTRAR');
  return [...new Set(db.auditLogs.map((r) => r.recordType))].sort();
}
