/**
 * Trainees with something outstanding: admission requirements not yet on
 * file, and subjects with no grade yet or an INC not yet completed.
 *
 * One list, read two ways: the Registrar's report covers every diploma, and
 * a head trainer's summary covers the diploma they head. Derived on read —
 * nothing here is stored.
 */

import type { Student } from '@/types';
import { semesterPeriodLabel } from '@/types';
import type { LackingReport, LackingSubject, LackingTraineeView } from '@/types/views';
import { lastFirst } from '@/lib/format';
import { scholarshipFromText, scholarshipSpec } from '@/lib/scholarships';
import { db, nowIso } from '../repositories/db';
import { batchOfStudent, facultyDisplayName, subjectLabel } from '../repositories/lookups';
import { requireRole } from '../auth';
import { clearanceFor } from './clearance';
import { deadlineFor } from './grade-deadlines';

/** Trainees still at the centre: admitted, not graduated, not dropped. */
function inScope(student: Student): boolean {
  return (
    !student.archivedAt &&
    !student.graduatedAt &&
    ['APPROVED', 'ACTIVE', 'INACTIVE'].includes(student.status)
  );
}

function subjectsOutstanding(student: Student): LackingSubject[] {
  const out: LackingSubject[] = [];
  for (const enrollment of db.enrollments) {
    if (enrollment.studentId !== student.id || enrollment.status === 'DROPPED') continue;
    const semester = db.semesters.find((s) => s.id === enrollment.semesterId);
    const year = semester ? db.academicYears.find((y) => y.id === semester.academicYearId) : undefined;
    for (const row of db.enrollmentSubjects) {
      if (row.enrollmentId !== enrollment.id) continue;
      const isInc = row.finalGrade === 'INC' && !row.completionGrade;
      if (row.finalGrade !== null && !isInc) continue;
      const subject = db.subjects.find((s) => s.id === row.subjectId);
      const schedule = row.classScheduleId ? db.classSchedules.find((c) => c.id === row.classScheduleId) : undefined;
      out.push({
        enrollmentSubjectId: row.id,
        subjectCode: subjectLabel(subject),
        subjectTitle: subject?.title ?? '',
        termLabel: semester ? semesterPeriodLabel(semester.yearLevel, semester.semesterPeriod) : '—',
        academicYearLabel: year?.label ?? '—',
        trainerName: facultyDisplayName(schedule?.facultyId ?? null) || '—',
        state: isInc ? 'INC' : 'NO_GRADE',
        termOpen: Boolean(semester?.isActive),
        overdue:
          !isInc &&
          Boolean(schedule) &&
          deadlineFor(schedule!, db.gradingSheets.find((g) => g.classScheduleId === schedule!.id)).state === 'OVERDUE',
      });
    }
  }
  return out.sort(
    (a, b) => a.academicYearLabel.localeCompare(b.academicYearLabel) || a.termLabel.localeCompare(b.termLabel),
  );
}

function rowFor(student: Student): LackingTraineeView | null {
  const missingRequirements = clearanceFor(student).missing;
  const subjects = subjectsOutstanding(student);
  if (missingRequirements.length === 0 && subjects.length === 0) return null;
  const program = db.programs.find((p) => p.id === student.programId);
  const section = student.sectionId ? db.sections.find((s) => s.id === student.sectionId) : undefined;
  const latest = db.enrollments
    .filter((e) => e.studentId === student.id)
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))[0];
  return {
    studentId: student.id,
    studentNumber: student.studentNumber,
    name: lastFirst(student),
    programId: student.programId ?? '',
    programCode: program?.code ?? '—',
    yearLevel: student.yearLevel,
    sectionCode: section?.code ?? '—',
    batch: batchOfStudent(student),
    scholarship: scholarshipSpec(latest?.scholarship ?? scholarshipFromText(student.scholarshipType ?? '')).label,
    missingRequirements,
    subjects,
  };
}

export function lackingFor(programId?: string): LackingReport {
  const rows = db.students
    .filter((s) => inScope(s) && (!programId || s.programId === programId))
    .map(rowFor)
    .filter((r): r is LackingTraineeView => r !== null)
    .sort(
      (a, b) =>
        a.programCode.localeCompare(b.programCode) || a.yearLevel - b.yearLevel || a.name.localeCompare(b.name),
    );
  const program = programId ? db.programs.find((p) => p.id === programId) : undefined;
  return {
    generatedAt: nowIso(),
    scopeLabel: program ? `${program.code} — ${program.name}` : 'All diplomas',
    traineesInScope: db.students.filter((s) => inScope(s) && (!programId || s.programId === programId)).length,
    rows,
  };
}

/** The Registrar's report: every diploma, or one. */
export function getLackingReport(filters: { programId?: string } = {}): LackingReport {
  requireRole('REGISTRAR');
  return lackingFor(filters.programId || undefined);
}
