/**
 * Academic catalog: programs, curricula, subjects, sections, the
 * curriculum↔subject mapping, school years and terms.
 *
 * The Registrar owns all of it. Records are deactivated, never deleted —
 * history points at them.
 */

import type {
  AcademicYear,
  Curriculum,
  CsvRowError,
  Program,
  ProgramSubject,
  ProgramType,
  Section,
  Semester,
  SemesterPeriod,
  Subject,
} from '@/types';
import { semesterPeriodLabel } from '@/types';
import type {
  CurriculumImportResult,
  CurriculumImportRow,
  CurriculumView,
  SectionView,
  SemesterView,
  SubjectMappingView,
} from '@/types/views';
import { badRequest, duplicate, notFound, validationFailed } from '@/lib/api-error';
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
  /** Defaults to a Diploma — the centre's main offering. */
  programType?: ProgramType;
}

export function createProgram(input: ProgramInput): Program {
  const actor = requireRole('REGISTRAR');
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
    programType: input.programType ?? 'DIPLOMA',
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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
        isRequired: ps.isRequired,
      };
    })
    .sort((a, b) => {
      if (a.yearLevel !== b.yearLevel) return a.yearLevel - b.yearLevel;
      const order: Record<SemesterPeriod, number> = { FIRST: 1, SECOND: 2 };
      if (a.semesterPeriod !== b.semesterPeriod) {
        return order[a.semesterPeriod] - order[b.semesterPeriod];
      }
      return a.subject.code.localeCompare(b.subject.code);
    });
}

export interface MapSubjectInput {
  curriculumId: string;
  subjectId: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  isRequired: boolean;
  prerequisiteSubjectIds?: string[];
  prerequisiteStanding?: number | null;
  prerequisiteNote?: string;
}

export function mapSubjectToCurriculum(input: MapSubjectInput): SubjectMappingView[] {
  const actor = requireRole('REGISTRAR');
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
    isRequired: input.isRequired,
    prerequisiteSubjectIds: [...(input.prerequisiteSubjectIds ?? [])],
    prerequisiteStanding: input.prerequisiteStanding ?? null,
    prerequisiteNote: (input.prerequisiteNote ?? '').trim(),
  };
  db.programSubjects.push(mapping);

  recordAudit({
    action: 'SUBJECT_MAPPED',
    recordType: 'ProgramSubject',
    recordId: mapping.id,
    actor,
    detail: `${subject.code} mapped into ${curriculum.code} (${semesterPeriodLabel(mapping.yearLevel, mapping.semesterPeriod)}).`,
    after: { ...mapping },
  });
  return listCurriculumSubjects(input.curriculumId);
}

export function unmapSubject(programSubjectId: string): SubjectMappingView[] {
  const actor = requireRole('REGISTRAR');
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

/**
 * Bulk curriculum import. Each row is one subject a curriculum requires; the
 * curriculum itself (matched by code) is created on first sight and updated
 * on repeat imports, and every row not already mapped is added — re-uploading
 * a revised sheet extends a curriculum without disturbing what's already
 * there. Validated in full before anything is written.
 */
export function importCurriculum(rows: CurriculumImportRow[]): CurriculumImportResult {
  const actor = requireRole('REGISTRAR');

  if (rows.length === 0) {
    throw badRequest('The file contained no data rows.');
  }

  interface Resolved {
    row: CurriculumImportRow;
    curriculumCode: string;
    programId: string;
    subjectId: string;
    yearLevel: number;
  }

  const errors: CsvRowError[] = [];
  const resolved: Resolved[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    const curriculumCode = row.curriculumCode?.trim().toUpperCase() ?? '';
    if (!curriculumCode) {
      errors.push({ row: rowNumber, field: 'curriculumCode', message: 'Curriculum code is required.' });
    }

    const programCode = row.programCode?.trim().toUpperCase() ?? '';
    const program = db.programs.find((p) => p.code.toUpperCase() === programCode);
    if (!programCode) {
      errors.push({ row: rowNumber, field: 'programCode', message: 'Program code is required.' });
    } else if (!program) {
      errors.push({ row: rowNumber, field: 'programCode', message: `Unknown program code "${row.programCode}".` });
    }

    const subjectCode = row.subjectCode?.trim().toUpperCase() ?? '';
    const subject = db.subjects.find((s) => s.code.toUpperCase() === subjectCode);
    if (!subjectCode) {
      errors.push({ row: rowNumber, field: 'subjectCode', message: 'Subject code is required.' });
    } else if (!subject) {
      errors.push({ row: rowNumber, field: 'subjectCode', message: `Unknown subject code "${row.subjectCode}".` });
    }

    const yearLevel = Number(row.yearLevel);
    if (!Number.isFinite(yearLevel) || yearLevel < 1 || yearLevel > 6) {
      errors.push({ row: rowNumber, field: 'yearLevel', message: 'Year level must be a number from 1 to 6.' });
    }

    if (row.semesterPeriod !== 'FIRST' && row.semesterPeriod !== 'SECOND') {
      errors.push({ row: rowNumber, field: 'semesterPeriod', message: 'Semester must be FIRST or SECOND.' });
    }

    if (curriculumCode && program && subject) {
      resolved.push({
        row,
        curriculumCode,
        programId: program.id,
        subjectId: subject.id,
        yearLevel: Math.max(1, Math.round(yearLevel)),
      });
    }
  });

  if (errors.length > 0) {
    throw validationFailed(
      `${errors.length} problem${errors.length === 1 ? '' : 's'} found. Nothing was imported — fix the file and try again.`,
      { rowErrors: errors },
    );
  }

  const curriculaByCode = new Map<string, Curriculum>();
  for (const c of db.curricula) curriculaByCode.set(c.code.toUpperCase(), c);
  const touched = new Set<string>();
  const toCreateCurricula: Curriculum[] = [];
  const toCreateMappings: ProgramSubject[] = [];
  let curriculaUpdated = 0;
  let subjectsMapped = 0;

  for (const item of resolved) {
    let curriculum = curriculaByCode.get(item.curriculumCode);
    if (!curriculum) {
      curriculum = {
        id: nextId('cur'),
        programId: item.programId,
        code: item.curriculumCode,
        name: item.row.curriculumName?.trim() || item.curriculumCode,
        effectiveYear: item.row.effectiveYear?.trim() ?? '',
        isActive: true,
        createdAt: nowIso(),
      };
      curriculaByCode.set(item.curriculumCode, curriculum);
      toCreateCurricula.push(curriculum);
    } else if (!touched.has(curriculum.id)) {
      if (item.row.curriculumName?.trim()) curriculum.name = item.row.curriculumName.trim();
      if (item.row.effectiveYear?.trim()) curriculum.effectiveYear = item.row.effectiveYear.trim();
      curriculaUpdated += 1;
    }
    touched.add(curriculum.id);

    const alreadyMapped =
      db.programSubjects.some(
        (ps) => ps.curriculumId === curriculum!.id && ps.subjectId === item.subjectId,
      ) || toCreateMappings.some((ps) => ps.curriculumId === curriculum!.id && ps.subjectId === item.subjectId);

    if (!alreadyMapped) {
      toCreateMappings.push({
        id: nextId('ps'),
        curriculumId: curriculum.id,
        subjectId: item.subjectId,
        yearLevel: item.yearLevel,
        semesterPeriod: item.row.semesterPeriod,
        isRequired: true,
        // The CSV import carries no prerequisite columns; a registrar sets
        // them afterwards from the curriculum screen.
        prerequisiteSubjectIds: [],
        prerequisiteStanding: null,
        prerequisiteNote: '',
      });
      subjectsMapped += 1;
    }
  }

  db.curricula.push(...toCreateCurricula);
  db.programSubjects.push(...toCreateMappings);

  recordAudit({
    action: 'CURRICULUM_UPDATED',
    recordType: 'Curriculum',
    recordId: [...touched].join(','),
    actor,
    detail: `Curriculum import: ${toCreateCurricula.length} curricula created, ${curriculaUpdated} updated, ${subjectsMapped} subject(s) mapped.`,
    after: { curriculaCreated: toCreateCurricula.length, curriculaUpdated, subjectsMapped },
  });

  return {
    curriculaCreated: toCreateCurricula.length,
    curriculaUpdated,
    subjectsMapped,
  };
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
  const actor = requireRole('REGISTRAR');
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
  const actor = requireRole('REGISTRAR');
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

export interface SemesterFilters {
  academicYearId?: string;
  programId?: string;
  yearLevel?: number;
}

export function listSemesters(filters: SemesterFilters = {}): SemesterView[] {
  const order: Record<SemesterPeriod, number> = { FIRST: 1, SECOND: 2 };
  return db.semesters
    .filter((s) => !filters.academicYearId || s.academicYearId === filters.academicYearId)
    .filter((s) => !filters.programId || s.programId === filters.programId)
    .filter((s) => filters.yearLevel === undefined || s.yearLevel === filters.yearLevel)
    .sort((a, b) => {
      const yearA = db.academicYears.find((y) => y.id === a.academicYearId)?.label ?? '';
      const yearB = db.academicYears.find((y) => y.id === b.academicYearId)?.label ?? '';
      if (yearA !== yearB) return yearB.localeCompare(yearA);
      const codeA = db.programs.find((p) => p.id === a.programId)?.code ?? '';
      const codeB = db.programs.find((p) => p.id === b.programId)?.code ?? '';
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      if (a.yearLevel !== b.yearLevel) return a.yearLevel - b.yearLevel;
      return order[a.semesterPeriod] - order[b.semesterPeriod];
    })
    .map(toSemesterView);
}

/**
 * The open semester for one diploma and year level.
 *
 * V8 replaced a global `getActiveSemester()` with this. Year 1, 2 and 3
 * cohorts of a diploma run at the same time, and diplomas run on their own
 * calendars, so "the active semester" is only answerable once you say for
 * whom. Callers must supply both; there is deliberately no global fallback.
 */
export function getActiveSemesterFor(
  programId: string,
  yearLevel: number,
): SemesterView | null {
  const found = db.semesters.find(
    (s) => s.isActive && s.programId === programId && s.yearLevel === yearLevel,
  );
  return found ? toSemesterView(found) : null;
}

/** Every currently open semester, across all diplomas. For overviews only. */
export function listActiveSemesters(): SemesterView[] {
  return listSemesters().filter((s) => s.isActive);
}

export interface SemesterInput {
  academicYearId: string;
  programId: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  startDate: string;
  endDate: string;
}

/**
 * Creates one grading period for one diploma.
 *
 * This is the first step of a cycle: nothing in a diploma can be enrolled
 * until the semester it would be enrolled into exists.
 */
export function createSemester(input: SemesterInput): SemesterView {
  const actor = requireRole('REGISTRAR');
  const year = db.academicYears.find((y) => y.id === input.academicYearId);
  if (!year) throw notFound('That school year could not be found.');
  const program = getProgram(input.programId);

  const yearLevel = Math.round(input.yearLevel);
  if (!Number.isFinite(yearLevel) || yearLevel < 1 || yearLevel > program.yearsToComplete) {
    throw badRequest(
      `Year level must be between 1 and ${program.yearsToComplete} for ${program.code}.`,
    );
  }
  if (input.semesterPeriod !== 'FIRST' && input.semesterPeriod !== 'SECOND') {
    throw badRequest('Semester must be either the 1st or the 2nd.');
  }
  if (!input.startDate || !input.endDate) {
    throw badRequest('A semester needs both a start and an end date.');
  }
  if (input.endDate < input.startDate) {
    throw badRequest('The semester ends before it starts.');
  }

  const clash = db.semesters.find(
    (s) =>
      s.academicYearId === input.academicYearId &&
      s.programId === input.programId &&
      s.yearLevel === yearLevel &&
      s.semesterPeriod === input.semesterPeriod,
  );
  if (clash) {
    throw duplicate(
      `${program.code} already has a ${semesterPeriodLabel(yearLevel, input.semesterPeriod)} for ${year.label}.`,
    );
  }

  const semester: Semester = {
    id: nextId('sem'),
    academicYearId: input.academicYearId,
    programId: input.programId,
    yearLevel,
    semesterPeriod: input.semesterPeriod,
    startDate: input.startDate,
    endDate: input.endDate,
    isActive: false,
  };
  db.semesters.push(semester);

  recordAudit({
    action: 'SEMESTER_CREATED',
    recordType: 'Semester',
    recordId: semester.id,
    actor,
    detail: `${toSemesterView(semester).label} created.`,
    after: { ...semester },
  });
  return toSemesterView(semester);
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

  // No grading periods are created here any more. Diplomas run on their own
  // calendars, so the registrar creates each semester deliberately with
  // `createSemester` — auto-generating four with the school year's own dates
  // would be wrong for every diploma at once.

  recordAudit({
    action: 'ACADEMIC_YEAR_CREATED',
    recordType: 'AcademicYear',
    actor,
    recordId: year.id,
    detail: `School year ${label} created. Semesters are added per diploma.`,
    after: { ...year },
  });
  return clone(year);
}

/**
 * Open or close one grading period.
 *
 * Exclusivity is scoped to (diploma, year level), not global. Two semesters
 * being open at once is now the ordinary case — DCMT Year 1 and DCMT Year 2
 * run side by side, as do IT Year 1 and HRT Year 1. What must never happen is
 * two open semesters for the *same* diploma and year level, because that is
 * the pair everything resolves against.
 */
export function setSemesterActive(semesterId: string, isActive: boolean): SemesterView[] {
  const actor = requireRole('REGISTRAR');
  const semester = db.semesters.find((s) => s.id === semesterId);
  if (!semester) throw notFound('That semester could not be found.');

  if (isActive) {
    for (const other of db.semesters) {
      if (
        other.programId === semester.programId &&
        other.yearLevel === semester.yearLevel &&
        other.id !== semester.id
      ) {
        other.isActive = false;
      }
    }
    semester.isActive = true;
    // A school year counts as current while any of its semesters is open.
    for (const year of db.academicYears) {
      year.isActive = db.semesters.some((s) => s.isActive && s.academicYearId === year.id);
    }
  } else {
    semester.isActive = false;
  }

  recordAudit({
    action: isActive ? 'SEMESTER_ACTIVATED' : 'SEMESTER_DEACTIVATED',
    recordType: 'Semester',
    recordId: semester.id,
    actor,
    detail: `${toSemesterView(semester).label} ${isActive ? 'opened' : 'closed'}.`,
  });
  return listSemesters();
}
