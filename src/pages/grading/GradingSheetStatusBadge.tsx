import type { GradingSheetStatus } from '@/types';
import { GRADING_SHEET_STATUS_LABELS } from '@/types';
import { Badge, type BadgeTone } from '@/components/ui';

/**
 * PENDING is warning-toned, not neutral: it means the registrar looked at a
 * submission and sent it back, which is something the trainer must act on.
 */
const TONES: Record<GradingSheetStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  APPROVED: 'success',
  PENDING: 'warning',
};

export function GradingSheetStatusBadge({ status }: { status: GradingSheetStatus }) {
  return <Badge tone={TONES[status]}>{GRADING_SHEET_STATUS_LABELS[status]}</Badge>;
}
