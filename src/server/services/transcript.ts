/**
 * Graduation, and the Transcript of Records.
 *
 * Graduation is the Registrar's act, not a computed state. The system says
 * who is eligible — every subject of their curriculum passed or credited,
 * no INC left open — and the Registrar marks them graduated with the date
 * and the Special Order number TESDA issued, which is what the TOR prints.
 *
 * The TOR is laid out after the centre's own: the previous school's subjects
 * first, under that school's name and terms, then KorPhil's terms in the
 * order they were taken, then the graduation statement and SO number.
 * Derived on read like the Grade Evaluation, so it always matches the record.
 */

import type { Student } from '@/types';
import { SEMESTER_PERIOD_LABELS } from '@/types';
import type { GraduationCandidate, GraduationCheck, TranscriptBlock, TranscriptView } from '@/types/views';
import { badRequest } from '@/lib/api-error';
import { db, nowIso } from '../repositories/db';
import { getStudent, subjectLabel, toStudentView } from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';
import { creditsFor, previousRecordsFor } from './credits';
import { computeGwa, effectiveGrade, isPassing } from './grade-rules';
import { changeStudentStatus } from './students';
import { clearanceFor } from './clearance';

/** No role check — the reports and the portal compose it. */
export function graduationCheckFor(student: Student): GraduationCheck {
  const empty = { eligible: false, remaining: [], hasUnresolvedInc: false, subjectsRequired: 0, subjectsDone: 0 };
  if (!student.curriculumId) return empty;
  const mappings = db.programSubjects.filter((ps) => ps.curriculumId === student.curriculumId && ps.isRequired);
  if (mappings.length === 0) return empty;

  const enrollmentIds = new Set(
    db.enrollments.filter((e) => e.studentId === student.id && e.status !== 'DROPPED').map((e) => e.id),
  );
  const rows = db.enrollmentSubjects.filter((es) => enrollmentIds.has(es.enrollmentId));
  const passed = new Set(
    rows.filter((r) => isPassing(effectiveGrade(r.finalGrade, r.completionGrade))).map((r) => r.subjectId),
  );
  const credited = creditsFor(student.id);
  const hasUnresolvedInc = rows.some((r) => r.finalGrade === 'INC' && !r.completionGrade);

  const remaining: string[] = [];
  for (const mapping of mappings) {
    if (passed.has(mapping.subjectId) || credited.has(mapping.subjectId)) continue;
    remaining.push(subjectLabel(db.subjects.find((s) => s.id === mapping.subjectId)));
  }
  return {
    eligible: remaining.length === 0 && !hasUnresolvedInc,
    remaining,
    hasUnresolvedInc,
    subjectsRequired: mappings.length,
    subjectsDone: mappings.length - remaining.length,
  };
}

export function getGraduationCheck(studentId: string): GraduationCheck {
  requireRole('REGISTRAR');
  return graduationCheckFor(getStudent(studentId));
}

export interface GraduationInput {
  /** YYYY-MM-DD */
  graduatedOn: string;
  specialOrderNo: string;
  /** The trainee's NSTP serial number, which the TOR prints apart from the SO. */
  nstpSerialNo: string;
}

function validGraduation(input: Pick<GraduationInput, 'graduatedOn' | 'specialOrderNo'>): { on: string; so: string } {
  const on = input.graduatedOn?.trim() ?? '';
  const so = input.specialOrderNo?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) throw badRequest('Give the date of graduation.');
  if (!so) throw badRequest('Enter the Special Order No. TESDA issued — the TOR prints it.');
  if (so.length > 60) throw badRequest('The Special Order No. is limited to 60 characters.');
  return { on, so };
}

function validNstp(nstp: string, who: string): string {
  const value = nstp?.trim() ?? '';
  if (!value) throw badRequest(`Enter the NSTP Serial No. of ${who}.`);
  if (value.length > 60) throw badRequest(`The NSTP Serial No. of ${who} is too long.`);
  return value;
}

/**
 * Everything that must hold before a trainee can be marked graduated: every
 * curriculum subject passed or credited, no INC open, and a complete
 * clearance — every admission requirement on file.
 */
function assertReadyToGraduate(student: Student): void {
  const name = `${student.firstName} ${student.lastName}`;
  if (student.status === 'GRADUATED') {
    throw badRequest(`${name} is already marked graduated. Edit the graduation details instead.`);
  }
  const check = graduationCheckFor(student);
  if (!check.eligible) {
    throw badRequest(
      check.hasUnresolvedInc
        ? `${name} still has an unresolved INC. Resolve it before marking them graduated.`
        : `${name} is not yet eligible — still to pass: ${check.remaining.slice(0, 6).join(', ')}${
            check.remaining.length > 6 ? ` and ${check.remaining.length - 6} more` : ''
          }.`,
    );
  }
  const clearance = clearanceFor(student);
  if (!clearance.complete) {
    throw badRequest(`${name} still needs these requirements marked as completed: ${clearance.missing.join(', ')}.`);
  }
}

function graduate(student: Student, on: string, so: string, nstp: string, actor: ReturnType<typeof requireRole>) {
  changeStudentStatus(student, 'GRADUATED', undefined, actor);
  student.graduatedAt = `${on}T00:00:00.000Z`;
  student.specialOrderNo = so;
  student.nstpSerialNo = nstp;
  student.updatedAt = nowIso();
  recordAudit({
    action: 'TRAINEE_GRADUATED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `${student.firstName} ${student.lastName} graduated on ${on}. Special Order No. ${so}. NSTP Serial No. ${nstp}.`,
    after: { graduatedAt: student.graduatedAt, specialOrderNo: so, nstpSerialNo: nstp },
  });
}

/** Marks a trainee graduated, with the date, SO number and NSTP number the TOR prints. */
export function markGraduated(studentId: string, input: GraduationInput) {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  assertReadyToGraduate(student);
  const { on, so } = validGraduation(input);
  graduate(student, on, so, validNstp(input.nstpSerialNo, `${student.firstName} ${student.lastName}`), actor);
  return toStudentView(student);
}

/**
 * Graduates several trainees under one Special Order and date — TESDA issues
 * one SO for a whole batch. Each keeps their own NSTP serial number. Checked
 * in full first: if any one of them is not ready, nobody is graduated.
 */
export function markGraduatedBatch(
  shared: { graduatedOn: string; specialOrderNo: string },
  entries: Array<{ studentId: string; nstpSerialNo: string }>,
) {
  const actor = requireRole('REGISTRAR');
  if (entries.length === 0) throw badRequest('Choose at least one trainee.');
  const { on, so } = validGraduation(shared);
  const ready = entries.map((entry) => {
    const student = getStudent(entry.studentId);
    assertReadyToGraduate(student);
    return { student, nstp: validNstp(entry.nstpSerialNo, `${student.firstName} ${student.lastName}`) };
  });
  for (const { student, nstp } of ready) graduate(student, on, so, nstp, actor);
  return ready.map(({ student }) => toStudentView(student));
}

/** Every trainee who has passed their whole curriculum and is not yet graduated. */
export function listGraduationCandidates(programId?: string): GraduationCandidate[] {
  requireRole('REGISTRAR');
  return db.students
    .filter((s) => !s.archivedAt && s.status !== 'GRADUATED' && !['PENDING', 'REJECTED', 'DROPPED'].includes(s.status))
    .filter((s) => !programId || s.programId === programId)
    .filter((s) => graduationCheckFor(s).eligible)
    .map((s) => {
      const program = db.programs.find((p) => p.id === s.programId);
      return {
        studentId: s.id,
        studentNumber: s.studentNumber,
        name: `${s.lastName}, ${s.firstName}`,
        programCode: program?.code ?? '—',
        programName: program?.name ?? '—',
        email: s.email,
        nstpSerialNo: s.nstpSerialNo,
        clearance: clearanceFor(s),
      };
    })
    .sort((a, b) => a.programCode.localeCompare(b.programCode) || a.name.localeCompare(b.name));
}

/** Corrects the date or SO number of a graduation already recorded. */
export function updateGraduation(studentId: string, input: GraduationInput) {
  const actor = requireRole('REGISTRAR');
  const student = getStudent(studentId);
  if (student.status !== 'GRADUATED') throw badRequest('This trainee has not been marked graduated.');
  const { on, so } = validGraduation(input);
  const nstp = validNstp(input.nstpSerialNo, `${student.firstName} ${student.lastName}`);
  const before = { graduatedAt: student.graduatedAt, specialOrderNo: student.specialOrderNo, nstpSerialNo: student.nstpSerialNo };
  student.graduatedAt = `${on}T00:00:00.000Z`;
  student.specialOrderNo = so;
  student.nstpSerialNo = nstp;
  student.updatedAt = nowIso();
  recordAudit({
    action: 'GRADUATION_UPDATED',
    recordType: 'Student',
    recordId: student.id,
    actor,
    detail: `Graduation details of ${student.firstName} ${student.lastName} updated.`,
    before,
    after: { graduatedAt: student.graduatedAt, specialOrderNo: so },
  });
  return toStudentView(student);
}

/* ---------------------------------------------------------------- */
/* The TOR                                                           */
/* ---------------------------------------------------------------- */

const PERIOD_WORDS = { FIRST: 'First Semester', SECOND: 'Second Semester', SUMMER: 'Summer' } as const;

export function getTranscript(studentId: string): TranscriptView {
  requireRole('REGISTRAR');
  const student = getStudent(studentId);
  const program = db.programs.find((p) => p.id === student.programId);

  // The previous school(s), each with its own terms, in the order typed.
  const previousSchools: TranscriptView['previousSchools'] = [];
  for (const record of previousRecordsFor(studentId)) {
    let school = previousSchools.find((s) => s.schoolName === record.schoolName);
    if (!school) {
      school = { schoolName: record.schoolName, blocks: [] };
      previousSchools.push(school);
    }
    const heading = record.schoolYear || 'Subjects taken';
    let block = school.blocks.find((b) => b.heading === heading);
    if (!block) {
      block = { heading, rows: [] };
      school.blocks.push(block);
    }
    const counted = record.grade === 'INC' ? record.completionGrade : record.grade;
    block.rows.push({
      courseCode: record.courseCode,
      courseTitle: record.courseTitle,
      rating: record.grade,
      completion: record.grade === 'INC' ? record.completionGrade : '',
      // A failed subject earns nothing, and the centre's TOR writes a dash.
      units: counted && counted !== '5.00' && counted !== 'INC' ? String(record.units) : '-',
    });
  }

  // KorPhil's own terms, in the order they were taken.
  const enrollments = db.enrollments
    .filter((e) => e.studentId === studentId)
    .map((enrollment) => ({ enrollment, semester: db.semesters.find((s) => s.id === enrollment.semesterId) }))
    .filter((p): p is { enrollment: typeof p.enrollment; semester: NonNullable<typeof p.semester> } => Boolean(p.semester))
    .sort((a, b) => a.semester.startDate.localeCompare(b.semester.startDate));

  const blocks: TranscriptBlock[] = [];
  const gwaRows: Parameters<typeof computeGwa>[0] = [];
  for (const { enrollment, semester } of enrollments) {
    const year = db.academicYears.find((y) => y.id === semester.academicYearId);
    // A Summer sits in the calendar year it is taken: "Summer 2027".
    const heading =
      semester.semesterPeriod === 'SUMMER'
        ? `Summer ${semester.startDate.slice(0, 4)}`
        : `${PERIOD_WORDS[semester.semesterPeriod] ?? SEMESTER_PERIOD_LABELS[semester.semesterPeriod]} ${year?.label ?? ''}`.trim();
    const rows = db.enrollmentSubjects
      .filter((es) => es.enrollmentId === enrollment.id)
      .map((es) => {
        const subject = db.subjects.find((s) => s.id === es.subjectId);
        gwaRows.push({ units: es.units, finalGrade: es.finalGrade, completionGrade: es.completionGrade, excludedFromGwa: es.excludedFromGwa });
        return {
          courseCode: subject?.code.trim() ?? '',
          courseTitle: subject?.title ?? '',
          rating: es.finalGrade ?? '',
          completion: es.completionGrade ?? '',
          units: es.excludedFromGwa ? `(${es.units.toFixed(1)})` : es.units.toFixed(1),
        };
      });
    blocks.push({ heading, rows });
  }

  const credits = [...creditsFor(studentId).values()];
  const credited: TranscriptBlock | null = credits.length
    ? {
        heading: 'Credited subjects',
        rows: credits.map((credit) => {
          const subject = db.subjects.find((s) => s.id === credit.subjectId);
          return {
            courseCode: subject?.code.trim() ?? '',
            courseTitle: subject?.title ?? '',
            rating: 'CRD',
            completion: '',
            units: (subject?.units ?? 0).toFixed(1),
          };
        }),
      }
    : null;

  const number = student.studentNumber;
  return {
    student: toStudentView(student),
    // "22-007": the intake year and the trainee's sequence, as the centre numbers its TORs.
    torNumber: `${number.slice(2, 4)}-${number.slice(-3)}`,
    courseName: program?.name ?? '',
    previousSchools,
    blocks,
    credited,
    graduation: graduationCheckFor(student),
    clearance: clearanceFor(student),
    nstpSerialNo: student.nstpSerialNo,
    graduatedOn: student.graduatedAt ? student.graduatedAt.slice(0, 10) : null,
    specialOrderNo: student.specialOrderNo,
    overallGwa: computeGwa(gwaRows).gwa,
    generatedAt: nowIso(),
  };
}
