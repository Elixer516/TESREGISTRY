/**
 * Which diploma a head trainer heads.
 *
 * A trainer belongs to a diploma through the classes they teach, so that is
 * where it is read from — the faculty record's own diploma field is free
 * text from an import, not a key.
 */

import type { Faculty, User } from '@/types';
import { db } from '../repositories/db';

export function headTrainerProgramId(user: User | null | undefined): string | null {
  if (!user || user.role !== 'TRAINER' || !user.facultyId) return null;
  const faculty = db.faculty.find((f) => f.id === user.facultyId);
  if (!faculty?.isHead) return null;
  return facultyProgramId(faculty);
}

/**
 * The diploma a trainer belongs to: from the classes they teach when they
 * have any, else from the diploma named on their record — which is all a
 * newly made trainer has until the Registrar assigns them classes.
 */
export function facultyProgramId(faculty: Faculty): string | null {
  for (const schedule of db.classSchedules) {
    if (schedule.facultyId !== faculty.id) continue;
    const semester = db.semesters.find((s) => s.id === schedule.semesterId);
    if (semester) return semester.programId;
  }
  const named = faculty.diploma.trim().toLowerCase();
  if (!named) return null;
  const program = db.programs.find((p) => {
    const name = p.name.trim().toLowerCase();
    return name === named || name === `diploma in ${named}` || p.code.toLowerCase() === named;
  });
  return program?.id ?? null;
}
