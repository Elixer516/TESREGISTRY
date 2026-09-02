/**
 * Restoring the demonstration dataset.
 *
 * The seed IS the controlled dataset — the freshman diploma with its open
 * First Semester, the Sequential Enrollment diploma with its finished and
 * graded one, the trainers, the curricula, the class schedules. So restoring
 * it is a rebuild from that definition, not a hunt through the tables for
 * rows to delete.
 *
 * That distinction is the whole design. Selective deletion would have to know
 * which of two students is "demonstration data" and which is debris, get the
 * order of every foreign key right, and be re-checked every time the seed
 * changes. Rebuilding cannot leave a half-deleted enrolment behind, cannot
 * strand a grading sheet whose class no longer exists, and needs no
 * maintenance: whatever the seed says, that is what comes back.
 *
 * Configuration is preserved for the same reason rather than by special
 * handling — programs, curricula, subjects, semesters and accounts are all
 * part of the seed, so they return identical.
 */

import { db, resetToSeed } from '../repositories/db';
import { currentUser, requireRole, verifyOwnPassword } from '../auth';
import { badRequest } from '@/lib/api-error';
import { recordAudit } from './audit';

/** Typed by the registrar to confirm. Deliberately not a single click. */
export const DEMO_RESET_PHRASE = 'RESET DEMO';

export interface DemoResetSummary {
  students: number;
  enrollments: number;
  gradingSheets: number;
  openSemesters: string[];
}

/**
 * Restore the prepared demonstration state.
 *
 * The audit entry is written BEFORE the rebuild and is expected to be wiped
 * with everything else — it exists so that a registrar watching the log
 * during a demonstration sees the action land, not as a durable record. A
 * reset that survived in the audit trail would mean the trail had not
 * actually been restored.
 */
export function resetDemoData(phrase: string, password: string): DemoResetSummary {
  const actor = requireRole('REGISTRAR');

  if (phrase.trim().toUpperCase() !== DEMO_RESET_PHRASE) {
    throw badRequest(`Type ${DEMO_RESET_PHRASE} exactly to confirm.`);
  }
  verifyOwnPassword(password);

  recordAudit({
    action: 'DEMO_DATA_RESET',
    recordType: 'System',
    recordId: 'demo-reset',
    actor,
    detail: 'Demonstration data restored to its prepared state.',
  });

  resetToSeed();

  // The signed-in session survives because it lives outside the database, so
  // the registrar stays where they are rather than being thrown to the login
  // screen mid-demonstration.
  const stillSignedIn = currentUser();
  if (!stillSignedIn) {
    throw badRequest('The demonstration data was restored, but your session ended. Sign in again.');
  }

  return {
    students: db.students.length,
    enrollments: db.enrollments.length,
    gradingSheets: db.gradingSheets.length,
    openSemesters: db.semesters
      .filter((s) => s.isActive)
      .map((s) => {
        const program = db.programs.find((p) => p.id === s.programId);
        const period = s.semesterPeriod === 'FIRST' ? '1st' : '2nd';
        return `${program?.code ?? '—'} Year ${s.yearLevel}, ${period} Semester`;
      })
      .sort(),
  };
}
