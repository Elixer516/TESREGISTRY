import type {
  GradeStatus,
  RequestStatus,
  ScheduleStatus,
  StudentStatus,
  UserAccountStatus,
} from '@/types';
import {
  ACCOUNT_STATUS_LABELS,
  GRADE_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  STUDENT_STATUS_LABELS,
} from '@/types';
import { Badge, type BadgeTone } from './ui';

const STUDENT_TONES: Record<StudentStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  GRADUATED: 'brand',
  DROPPED: 'danger',
};

const ACCOUNT_TONES: Record<UserAccountStatus, BadgeTone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  DEACTIVATED: 'neutral',
};

const GRADE_TONES: Record<GradeStatus, BadgeTone> = {
  ENROLLED_NOT_GRADED: 'neutral',
  PASSED: 'success',
  FAILED: 'danger',
  INC_PENDING: 'warning',
  INC_RESOLVED: 'info',
};

const REQUEST_TONES: Record<RequestStatus, BadgeTone> = {
  PENDING: 'warning',
  PROCESSING: 'info',
  READY: 'brand',
  RELEASED: 'success',
  CANCELLED: 'neutral',
};

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <Badge tone={STUDENT_TONES[status]}>{STUDENT_STATUS_LABELS[status]}</Badge>;
}

export function AccountStatusBadge({ status }: { status: UserAccountStatus }) {
  return <Badge tone={ACCOUNT_TONES[status]}>{ACCOUNT_STATUS_LABELS[status]}</Badge>;
}

export function GradeStatusBadge({ status }: { status: GradeStatus }) {
  return <Badge tone={GRADE_TONES[status]}>{GRADE_STATUS_LABELS[status]}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_TONES[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
}

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  return (
    <Badge tone={status === 'PUBLISHED' ? 'success' : 'warning'}>
      {status === 'PUBLISHED' ? 'Published' : 'Draft — Training Dept only'}
    </Badge>
  );
}
