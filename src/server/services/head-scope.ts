/**
 * Which diploma a head trainer heads.
 *
 * A trainer belongs to a diploma through the classes they teach, so that is
 * where it is read from — the faculty record's own diploma field is free
 * text from an import, not a key.
 */

import type { User } from '@/types';
import { db } from '../repositories/db';

export function headTrainerProgramId(user: User | null | undefined): string | null {
  if (!user || user.role !== 'TRAINER' || !user.facultyId) return null;
  const faculty = db.faculty.find((f) => f.id === user.facultyId);
  if (!faculty?.isHead) return null;
  for (const schedule of db.classSchedules) {
    if (schedule.facultyId !== faculty.id) continue;
    const semester = db.semesters.find((s) => s.id === schedule.semesterId);
    if (semester) return semester.programId;
  }
  return null;
}
