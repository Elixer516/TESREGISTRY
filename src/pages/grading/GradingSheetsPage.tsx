/**
 * One route, two jobs.
 *
 * A trainer sees their own classes and fills sheets in; the registrar sees
 * the review queue and rules on them. Which of the two you get is decided by
 * the signed-in role — and independently by the service, which refuses the
 * other role's calls regardless of what this renders.
 */

import { useAuth } from '@/context/AuthContext';
import { TrainerSheets } from './TrainerSheets';
import { RegistrarReviewQueue } from './RegistrarReviewQueue';

export function GradingSheetsPage() {
  const { user } = useAuth();
  if (user?.role === 'TRAINER') return <TrainerSheets />;
  return <RegistrarReviewQueue />;
}
