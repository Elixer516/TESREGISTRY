import type { GradeDeadline, GradeDeadlineAlert } from '@/types/views';
import { Badge, Button, Card, CardHeader, Table, TableWrap, Td, Th } from '@/components/ui';
import { formatDate } from '@/lib/format';

const TONES = {
  NONE: 'neutral',
  OPEN: 'neutral',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
  ON_TIME: 'success',
  LATE: 'warning',
} as const;

/** "Due in 4 days" / "3 days late" / "Submitted on time", with the date under it. */
export function DeadlineBadge({ deadline }: { deadline: GradeDeadline }) {
  if (deadline.state === 'NONE') return <span className="text-xs text-ink-400">No deadline</span>;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <Badge tone={TONES[deadline.state]}>{deadline.label}</Badge>
      {deadline.dueDate ? (
        <span className="text-[11px] text-ink-500">due {formatDate(deadline.dueDate)}</span>
      ) : null}
    </span>
  );
}

/**
 * The Registrar's warning: every class whose grades are due within the week
 * or already overdue, and not yet handed in.
 */
export function GradeDeadlineAlerts({
  alerts,
  limit,
  compact = false,
  onSetDeadline,
}: {
  alerts: GradeDeadlineAlert[];
  limit?: number;
  compact?: boolean;
  /** Offers the Registrar a way to move a class's deadline from the warning itself. */
  onSetDeadline?: (classScheduleId: string) => void;
}) {
  if (alerts.length === 0) return null;
  const overdue = alerts.filter((a) => a.deadline.state === 'OVERDUE').length;
  const soon = alerts.length - overdue;
  const shown = limit ? alerts.slice(0, limit) : alerts;
  return (
    <Card className={overdue > 0 ? 'border-danger/40' : 'border-warning/40'}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>⏰</span> Grade submissions{' '}
            {overdue > 0 ? <Badge tone="danger">{overdue} overdue</Badge> : null}
            {soon > 0 ? <Badge tone="warning">{soon} due this week</Badge> : null}
          </span>
        }
        description="Classes whose trainers have not yet submitted grades. Remind them before the next enrolment depends on it."
      />
      <TableWrap>
        <Table className={compact ? 'min-w-[36rem]' : 'min-w-[48rem]'}>
          <thead>
            <tr>
              <Th>Class</Th>
              <Th>Section</Th>
              <Th>Trainer</Th>
              {compact ? null : <Th>Sheet</Th>}
              <Th>Deadline</Th>
              {onSetDeadline ? <Th className="text-right"> </Th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => (
              <tr key={a.classScheduleId}>
                <Td>
                  <span className="block font-medium text-ink-900">{a.subjectCode}</span>
                  <span className="block text-xs text-ink-500">{a.subjectTitle}</span>
                </Td>
                <Td className="text-xs">{a.sectionCode}</Td>
                <Td className="text-xs">{a.trainerName}</Td>
                {compact ? null : (
                  <Td className="text-xs">{a.status === 'NOT_STARTED' ? 'Not started' : a.status === 'DRAFT' ? 'Draft' : a.status}</Td>
                )}
                <Td>
                  <DeadlineBadge deadline={a.deadline} />
                </Td>
                {onSetDeadline ? (
                  <Td className="text-right">
                    <Button size="sm" variant="secondary" onClick={() => onSetDeadline(a.classScheduleId)}>
                      Set deadline
                    </Button>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {limit && alerts.length > limit ? (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-500">
          and {alerts.length - limit} more — see Grading Sheets.
        </p>
      ) : null}
    </Card>
  );
}
