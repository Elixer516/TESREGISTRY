import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AuditAction } from '@/types';
import { auditApi } from '@/api';
import { formatDateTime } from '@/lib/format';
import {
  Badge,
  Card,
  CardHeader,
  Field,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  TextInput,
} from '@/components/ui';
import { QueryState } from '@/components/states';

/**
 * Audit log.
 *
 * Rows show the readable label while filtering keys off the machine
 * identifier, so a renamed label never breaks someone's saved filter habit.
 */
export function AuditPage() {
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL');
  const [recordType, setRecordType] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const actions = useQuery({ queryKey: ['audit-actions'], queryFn: () => auditApi.actions() });
  const recordTypes = useQuery({
    queryKey: ['audit-record-types'],
    queryFn: () => auditApi.recordTypes(),
  });
  const logs = useQuery({
    queryKey: ['audit-logs', action, recordType, query],
    queryFn: () => auditApi.logs({ action, recordType, query }),
  });

  const rows = logs.data ?? [];

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every recorded action, with the acting user and the values before and after where they apply."
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Action" htmlFor="a-action">
            <Select
              id="a-action"
              value={action}
              onChange={(event) => setAction(event.target.value as AuditAction | 'ALL')}
            >
              <option value="ALL">All actions</option>
              {(actions.data ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Record type" htmlFor="a-type">
            <Select
              id="a-type"
              value={recordType}
              onChange={(event) => setRecordType(event.target.value)}
            >
              <option value="ALL">All record types</option>
              {(recordTypes.data ?? []).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" htmlFor="a-search">
            <TextInput
              id="a-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Detail, user or record id…"
            />
          </Field>
        </div>
      </Card>

      <QueryState
        isLoading={logs.isLoading}
        error={logs.error}
        isEmpty={rows.length === 0}
        onRetry={() => logs.refetch()}
        loadingLabel="Loading the audit trail…"
        emptyTitle="No entries match"
        emptyHint="Clear the filters to see the whole trail. The log resets when the page reloads."
      >
        <Card>
          <CardHeader title="Entries" description={rows.length + ' entry(ies), newest first.'} />
          <TableWrap>
            <Table className="min-w-[54rem]">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Action</Th>
                  <Th>Record</Th>
                  <Th>User</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-2">
                    <Td className="whitespace-nowrap text-xs text-ink-500">
                      {formatDateTime(entry.createdAt)}
                    </Td>
                    <Td>
                      <Badge tone="brand">{entry.actionLabel}</Badge>
                      <span className="mt-1 block font-mono text-[10px] text-ink-400">
                        {entry.action}
                      </span>
                    </Td>
                    <Td className="text-xs">
                      <span className="block font-medium text-ink-900">{entry.recordType}</span>
                      <span className="block font-mono text-ink-400">{entry.recordId}</span>
                    </Td>
                    <Td className="text-xs">{entry.userLabel}</Td>
                    <Td className="max-w-[22rem] text-xs">{entry.detail}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </QueryState>
    </>
  );
}
