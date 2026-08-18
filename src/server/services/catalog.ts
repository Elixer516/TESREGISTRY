/**
 * Academic catalog: programs, curricula, subjects, sections, the
 * curriculum↔subject mapping, school years and terms.
 *
 * Training Department writes the catalog; the Registrar reads it and owns
 * school years and terms. Records are deactivated, never deleted — history
 * points at them.
 */

import type {
  AcademicYear,
  Curriculum,
  Program,
  ProgramSubject,
  Section,
  Semester,
  SemesterPeriod,
  Subject,
  Term,
} from '@/types';
import { ALL_SEMESTER_PERIODS, ALL_TERMS } from '@/types';
import type {
  CurriculumView,
  SectionView,
  SemesterView,
  SubjectMappingView,
} from '@/types/views';
import { badRequest, duplicate, notFound } from '@/lib/api-error';
import { cloneAll, db, nextId, nowIso, clone } from '../repositories/db';
import {
  getCurriculum,
  getProgram,
  getSubject,
  toSectionView,
  toSemesterView,
} from '../repositories/lookups';
import { requireRole } from '../auth';
import { recordAudit } from './audit';

/* ---------------------------------------------------------------- */
/* Programs                                                          */
/* ---------------------------------------------------------------- */

export function listPrograms(includeInactive = false): Program[] {
  const rows = includeInactive ? db.programs : db.programs.filter((p) => p.isActive);
  return cloneAll([...rows].sort((a, b) => a.code.localeCompare(b.code)));
}

export interface ProgramInput {
  code: string;
  name: string;
  description: string;
  yearsToComplete: number;
}

export function createProgram(input: ProgramInput): Program {
  const actor = requireRole('TRAINING_OFFICER');
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest('Program code is required.');
  if (!input.name.trim()) throw badRequest('Program name is required.');
  if (db.programs.some((p) => p.code.toUpperCase() === code)) {
    throw duplicate(`A program with the code ${code} already exists.`);
  }

  const program: Program = {
    id: nextId('prog'),
    code,
    name: input.name.trim(),
    description: input.description.trim(),
    yearsToComplete: Math.max(1, Math.round(input.yearsToComplete)),
    isActive: true,
    createdAt: nowIso(),
  };
  db.programs.push(program);

  recordAudit({
    action: 'PROGRAM_CREATED',
    recordType: 'Program',
    recordId: program.id,
    actor,
    detail: `Program ${program.code} created.`,
    after: { ...program },
  });
  return clone(program);
}

export function updateProgram(id: string, input: Partial<ProgramInput>): Program {
  const actor = requireRole('TRAINING_OFFICER');
  const program = getProgram(id);
  const before = { ...program };

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (!code) throw badRequest('Program code is required.');
    if (db.programs.some((p) => p.id !== id && p.code.toUpperCase() === code)) {
      throw duplicate(`A program with the code ${code} already exists.`);
    }
    program.code = code;
  }
  if (input.name !== undefined) program.name = input.name.trim();
  if (input.description !== undefined) program.description = input.description.trim();
  if (input.yearsToComplete !== undefined) {
    program.yearsToComplete = Math.max(1, Math.round(input.yearsToComplete));
  }

  recordAudit({
    action: 'PROGRAM_UPDATED',
    recordType: 'Program',
    recordId: program.id,
    actor,
    detail: `Program ${program.code} updated.`,
    before,
    after: { ...program },
  });
  return clone(program);
}

export function setProgramActive(id: string, isActive: boolean): Program {
  const actor = requireRole('TRAINING_OFFICER');
  const program = getProgram(id);
  const before = { ...program };
  program.isActive = isActive;

  recordAudit({
    action: 'PROGRAM_DEACTIVATED',
    recordType: 'Program',
    recordId: program.id,
    actor,
    detail: `Program ${program.code} ${isActive ? 'reactivated' : 'deactivated'}.`,
    before,
    after: { ...program },
  });
  return clone(program);
}

/* ---------------------------------------------------------------- */
/* Curricula                                                         */
/* ---------------------------------------------------------------- */

export function listCurricula(programId?: string): CurriculumView[] {
  const rows = programId
    ? db.curricula.filter((c) => c.programId === programId)
    : db.curricula;
  return rows.map((curriculum) => toCurriculumView(curriculum));
}

function toCurriculumView(curriculum: Curriculum): CurriculumView {
  const program = db.programs.find((p) => p.id === curriculum.programId);
  const mappings = db.programSubjects.filter((ps) => ps.curriculumId === curriculum.id);
  const totalUnits = mappings.reduce((sum, ps) => {
    const subject = db.subjects.find((s) => s.id === ps.subjectId);
    return sum + (subject?.units ?? 0);
  }, 0);
  return {
    id: curriculum.id,
    programId: curriculum.programId,
    programCode: program?.code ?? '—',
    code: curriculum.code,
    name: curriculum.name,
    effectiveYear: curriculum.effectiveYear,
    isActive: curriculum.isActive,
    subjectCount: mappings.length,
    totalUnits,
  };
}

export interface CurriculumInput {
  programId: string;
  code: string;
  name: string;
  effectiveYear: string;
}

export function createCurriculum(input: CurriculumInput): CurriculumView {
  const actor = requireRole('TRAINING_OFFICER');
  getProgram(input.programId);
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest('Curriculum code is required.');
  if (db.curricula.some((c) => c.code.toUpperCase() === code)) {
    throw duplicate(`A curriculum with the code ${code} already exists.`);
  }

  const curriculum: Curriculum = {
    id: nextId('cur'),
    programId: input.programId,
    code,
    name: input.name.trim() || code,
    effectiveYear: input.effectiveYear.trim(),
    isActive: true,
    createdAt: nowIso(),
  };
  db.curricula.push(curriculum);

  recordAudit({
    action: 'CURRICULUM_CREATED',
    recordType: 'Curriculum',
    recordId: curriculum.id,
    actor,
    detail: `Curriculum ${curriculum.code} created.`,
    after: { ...curriculum },
  });
  return toCurriculumView(curriculum);
}

export function setCurriculumActive(id: string, isActive: boolean): CurriculumView {
  const actor = requireRole('TRAINING_OFFICER');
  const curriculum = getCurriculum(id);
  const before = { ...curriculum };
  curriculum.isActive = isActive;
  recordAudit({
    action: 'CURRICULUM_UPDATED',
    recordType: 'Curriculum',
    recordId: curriculum.id,
    actor,
    detail: `Curriculum ${curriculum.code} ${isActive ? 'reactivated' : 'deactivated'}.`,
    before,
    after: { ...curriculum },
  });
  return toCurriculumView(curriculum);
}

/* ---------------------------------------------------------------- */
/* Subjects                                                          */
/* ---------------------------------------------------------------- */

export function listSubjects(includeInactive = false): Subject[] {
  const rows = includeInactive ? db.subjects : db.subjects.filter((s) => s.isActive);
  return cloneAll([...rows].sort((a, b) => a.code.localeCompare(b.code)));
}

export interface SubjectInput {
  code: string;
  title: string;
  description: string;
  units: number;
  lectureHours: number;
  labHours: number;
}

export function createSubject(input: SubjectInput): Subject {
  const actor = requireRole('TRAINING_OFFICER');
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest('Subject code is required.');
  if (!input.title.trim()) throw badRequest('Subject title is required.');
  if (input.units <= 0) throw badRequest('Units must be greater than zero.');
  if (db.subjects.some((s) => s.code.toUpperCase() === code)) {
    throw duplicate(
      `Subject ${code} already exists. Map the existing record into this curriculum instead of creating a second copy.`,
    );
  }

  const subject: Subject = {
    id: nextId('subj'),
    code,
    title: input.title.trim(),
    description: input.description.trim(),
    units: input.units,
    lectureHours: input.lectureHours,
    labHours: input.labHours,
    isActive: true,
    createdAt: nowIso(),
  };
  db.subjects.push(subject);

  recordAudit({
    action: 'SUBJECT_CREATED',
    recordType: 'Subject',
    recordId: subject.id,
    actor,
    detail: `Subject ${subject.code} created.`,
    after: { ...subject },
  });
  return clone(subject);
}

export function updateSubject(id: string, input: Partial<SubjectInput>): Subject {
  const actor = requireRole('TRAINING_OFFICER');
  const subject = getSubject(id);
  const before = { ...subject };

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (db.subjects.some((s) => s.id !== id && s.code.toUpperCase() === code)) {
      throw duplicate(`Subject ${code} already exists.`);
    }
    subject.code = code;
  }
  if (input.title !== undefined) subject.title = input.title.trim();
  if (input.description !== undefined) subject.description = input.description.trim();
  if (input.units !== undefined) {
    if (input.units <= 0) throw badRequest('Units must be greater than zero.');
    subject.units = input.units;
  }
  if (input.lectureHours !== undefined) subject.lectureHours = input.lectureHours;
  if (input.labHours !== undefined) subject.labHours = input.labHours;

  recordAudit({
    action: 'SUBJECT_UPDATED',
    recordType: 'Subject',
    recordId: subject.id,
    actor,
    detail: `Subject ${subject.code} updated. Existing enrollments keep the units they were enrolled with.`,
    before,
    after: { ...subject },
  });
  return clone(subject);
}

export function setSubjectActive(id: string, isActive: boolean): Subject {
  const actor = requireRole('TRAINING_OFFICER');
  const subject = getSubject(id);
  subject.isActive = isActive;
  recordAudit({
    action: 'SUBJECT_UPDATED',
    recordType: 'Subject',
    recordId: subject.id,
    actor,
    detail: `Subject ${subject.code} ${isActive ? 'reactivated' : 'deactivated'}.`,
  });
  return clone(subject);
}

/* ---------------------------------------------------------------- */
/* Curriculum ↔ subject mapping                                      */
/* ---------------------------------------------------------------- */

export function listCurriculumSubjects(curriculumId: string): SubjectMappingView[] {
  getCurriculum(curriculumId);
  return db.programSubjects
    .filter((ps) => ps.curriculumId === curriculumId)
    .map((ps) => {
      const subject = db.subjects.find((s) => s.id === ps.subjectId);
      if (!subject) throw notFound('A mapped subject is missing from the catalog.');
      return {
        programSubjectId: ps.id,
        subject: clone(subject),
        yearLevel: ps.yearLevel,
        semesterPeriod: ps.semesterPeriod,
        term: ps.term,
        isRequired: ps.isRequired,
      };
    })
    .sort((a, b) => {
      if (a.yearLevel !== b.yearLevel) return a.yearLevel - b.yearLevel;
      const order: Record<Term, number> = { FIRST: 1, SECOND: 2 };
      if (a.semesterPeriod !== b.semesterPeriod) {
        return order[a.semesterPeriod] - order[b.semesterPeriod];
      }
      if (a.term !== b.term) return order[a.term] - order[b.term];
      return a.subject.code.localeCompare(b.subject.code);
    });
}

export interface MapSubjectInput {
  curriculumId: string;
  subjectId: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  term: Term;
  isRequired: boolean;
}

export function mapSubjectToCurriculum(input: MapSubjectInput): SubjectMappingView[] {
  const actor = requireRole('TRAINING_OFFICER');
  const curriculum = getCurriculum(input.curriculumId);
  const subject = getSubject(input.subjectId);

  const exists = db.programSubjects.some(
    (ps) => ps.curriculumId === input.curriculumId && ps.subjectId === input.subjectId,
  );
  if (exists) {
    throw duplicate(`${subject.code} is already mapped into ${curriculum.code}.`);
  }

  const mapping: ProgramSubject = {
    id: nextId('ps'),
    curriculumId: input.curriculumId,
    subjectId: input.subjectId,
    yearLevel: Math.max(1, Math.round(input.yearLevel)),
    semesterPeriod: input.semesterPeriod,
    term: input.term,
    isRequired: input.isRequired,
  };
  db.programSubjects.push(mapping);

  recordAudit({
    action: 'SUBJECT_MAPPED',
    recordType: 'ProgramSubject',
    recordId: mapping.id,
    actor,
    detail: `${subject.code} mapped into ${curriculum.code} (Year ${mapping.yearLevel}, ${mapping.semesterPeriod} Semester, ${mapping.term} Term).`,
    after: { ...mapping },
  });
  return listCurriculumSubjects(input.curriculumId);
}

export function unmapSubject(programSubjectId: string): SubjectMappingView[] {
  const actor = requireRole('TRAINING_OFFICER');
  const index = db.programSubjects.findIndex((ps) => ps.id === programSubjectId);
  if (index === -1) throw notFound('That curriculum entry could not be found.');
  const [removed] = db.programSubjects.splice(index, 1);
  const subject = db.subjects.find((s) => s.id === removed.subjectId);

  recordAudit({
    action: 'SUBJECT_UNMAPPED',
    recordType: 'ProgramSubject',
    recordId: removed.id,
    actor,
    detail: `${subject?.code ?? 'Subject'} removed from the curriculum. The subject record itself is untouched.`,
    before: { ...removed },
  });
  return listCurriculumSubjects(removed.curriculumId);
}

/* ---------------------------------------------------------------- */
/* Sections                                                          */
/* ---------------------------------------------------------------- */

export function listSections(programId?: string): SectionView[] {
  const rows = programId
    ? db.sections.filter((s) => s.programId === programId)
    : db.sections;
  return [...rows].sort((a, b) => a.code.localeCompare(b.code)).map(toSectionView);
}

export interface SectionInput {
  code: string;
  programId: string;
  yearLevel: number;
  capacity: number;
}

export function createSection(input: SectionInput): SectionView {
  const actor = requireRole('TRAINING_OFFICER');
  getProgram(input.programId);
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest('Section code is required.');
  if (db.sections.some((s) => s.code.toUpperCase() === code)) {
    throw duplicate(`Section ${code} already exists.`);
  }

  const section: Section = {
    id: nextId('sec'),
    code,
    programId: input.programId,
    yearLevel: Math.max(1, Math.round(input.yearLevel)),
    capacity: Math.max(1, Math.round(input.capacity)),
    isActive: true,
    createdAt: nowIso(),
  };
  db.sections.push(section);

  recordAudit({
    action: 'SECTION_CREATED',
    recordType: 'Section',
    recordId: section.id,
    actor,
    detail: `Section ${section.code} created.`,
    after: { ...section },
  });
  return toSectionView(section);
}

export function setSectionActive(id: string, isActive: boolean): SectionView {
  const actor = requireRole('TRAINING_OFFICER');
  const section = db.sections.find((s) => s.id === id);
  if (!section) throw notFound('That section could not be found.');
  section.isActive = isActive;
  recordAudit({
    action: 'SECTION_UPDATED',
    recordType: 'Section',
    recordId: section.id,
    actor,
    detail: `Section ${section.code} ${isActive ? 'reactivated' : 'deactivated'}.`,
  });
  return toSectionView(section);
}

/* ---------------------------------------------------------------- */
/* School years and terms — Registrar-owned                          */
/* ---------------------------------------------------------------- */

export function listAcademicYears(): AcademicYear[] {
  return cloneAll(
    [...db.academicYears].sort((a, b) => b.label.localeCompare(a.label)),
  );
}

export function listSemesters(academicYearId?: string): SemesterView[] {
  const rows = academicYearId
    ? db.semesters.filter((s) => s.academicYearId === academicYearId)
    : db.semesters;
  const order: Record<Term, number> = { FIRST: 1, SECOND: 2 };
  return [...rows]
    .sort((a, b) => {
      const yearA = db.academicYears.find((y) => y.id === a.academicYearId)?.label ?? '';
      const yearB = db.academicYears.find((y) => y.id === b.academicYearId)?.label ?? '';
      if (yearA !== yearB) return yearB.localeCompare(yearA);
      if (a.semesterPeriod !== b.semesterPeriod) {
        return order[a.semesterPeriod] - order[b.semesterPeriod];
      }
      return order[a.term] - order[b.term];
    })
    .map(toSemesterView);
}

export function getActiveSemester(): SemesterView | null {
  const found = db.semesters.find((s) => s.isActive);
  return found ? toSemesterView(found) : null;
}

export interface AcademicYearInput {
  label: string;
  startDate: string;
  endDate: string;
}

export function createAcademicYear(input: AcademicYearInput): AcademicYear {
  const actor = requireRole('REGISTRAR');
  const label = input.label.trim();
  if (!/^\d{4}-\d{4}$/.test(label)) {
    throw badRequest('School year must be formatted as YYYY-YYYY, for example 2027-2028.');
  }
  if (db.academicYears.some((y) => y.label === label)) {
    throw duplicate(`School year ${label} already exists.`);
  }

  const year: AcademicYear = {
    id: nextId('ay'),
    label,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: false,
  };
  db.academicYears.push(year);

  // A school year is useless without its grading periods, so create all four
  // up front: 1st Semester (1st & 2nd Term) and 2nd Semester (1st & 2nd Term).
  for (const semesterPeriod of ALL_SEMESTER_PERIODS) {
    for (const term of ALL_TERMS) {
      const semester: Semester = {
        id: nextId('sem'),
        academicYearId: year.id,
        semesterPeriod,
        term,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: false,
      };
      db.semesters.push(semester);
    }
  }

  recordAudit({
    action: 'ACADEMIC_YEAR_CREATED',
    recordType: 'AcademicYear',
    actor,
    recordId: year.id,
    detail: `School year ${label} created with two semesters, each split into two terms.`,
    after: { ...year },
  });
  return clone(year);
}

/**
 * Activate a term. Exactly one term is active at a time — it is what gates
 * grade encoding, so two active terms would make "the active term" meaningless.
 */
export function setSemesterActive(semesterId: string, isActive: boolean): SemesterView[] {
  const actor = requireRole('REGISTRAR');
  const semester = db.semesters.find((s) => s.id === semesterId);
  if (!semester) throw notFound('That term could not be found.');

  if (isActive) {
    for (const other of db.semesters) other.isActive = false;
    semester.isActive = true;
    for (const year of db.academicYears) {
      year.isActive = year.id === semester.academicYearId;
    }
  } else {
    semester.isActive = false;
  }

  recordAudit({
    action: isActive ? 'SEMESTER_ACTIVATED' : 'SEMESTER_DEACTIVATED',
    recordType: 'Semester',
    recordId: semester.id,
    actor,
    detail: `${toSemesterView(semester).label} ${isActive ? 'set as the active term' : 'deactivated'}.`,
  });
  return listSemesters();
}
