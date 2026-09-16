/**
 * Turns KorPhil's real curriculum documents into Subject and ProgramSubject
 * records.
 *
 * The data itself lives in `./korphil-curricula`, generated from the scanned
 * documents. This file is only the assembly, and it makes two choices that
 * earlier versions got the other way round.
 *
 * **A Subject belongs to one curriculum.** Until the real documents arrived,
 * this file kept one Subject per course code and mapped it into every
 * curriculum that used it — on the reasoning that "Understanding the Self" is
 * the same subject wherever it is taught. The documents disprove that.
 * Purposive Communication is `GE 101` in DABET, `GE ENG` in DCMT and `GE01`
 * in DMAT; Chemistry for Engineers is 4 units in DABET, 3 in DCMT and 2 in
 * DMET-MACH. Sharing one record would force a single code and a single unit
 * value onto all of them, which means overwriting what some department
 * actually wrote. So each curriculum line gets its own Subject, and editing
 * one diploma cannot disturb another.
 *
 * **A blank course code is valid.** Three diplomas — DCAT, DHT and DROT —
 * publish no codes at all, and classes at the centre sometimes start before a
 * subject has been given one. The code is a label, never an identifier, so
 * nothing here requires it or invents one to fill the gap.
 *
 * Prerequisites were resolved to titles at generation time, within each
 * curriculum. What could not be resolved was left in the note rather than
 * dropped: most of the remainder are TESDA qualifications ("ATS NC II") which
 * are genuinely not subjects, and printing them is more honest than pretending
 * the subject had no prerequisite at all.
 */

import type { ProgramSubject, SemesterPeriod, Subject } from '@/types';
import { CURRICULA, DIPLOMAS } from './korphil-curricula';
import type { CurriculumSpec } from './korphil-curricula';

export { CURRICULA, DIPLOMAS };
export type { CurriculumSpec };

/**
 * The terms one curriculum actually runs, in order.
 *
 * Not a constant, because the shape differs by diploma: five carry a Summer
 * practicum and the rest do not, and of those five some place it after First
 * Year and others after Second.
 */
export function termsFor(
  curriculumId: string,
): Array<{ yearLevel: number; semesterPeriod: SemesterPeriod }> {
  const curriculum = CURRICULA.find((c) => c.id === curriculumId);
  if (!curriculum) return [];
  return curriculum.terms.map((t) => ({
    yearLevel: t.yearLevel,
    semesterPeriod: t.period,
  }));
}

/** Every (yearLevel, period) pair any curriculum uses, deduplicated. */
export function allTermSlots(): Array<{
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
}> {
  const seen = new Set<string>();
  const out: Array<{ yearLevel: number; semesterPeriod: SemesterPeriod }> = [];
  for (const curriculum of CURRICULA) {
    for (const term of curriculum.terms) {
      const key = `${term.yearLevel}-${term.period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ yearLevel: term.yearLevel, semesterPeriod: term.period });
    }
  }
  return out;
}

export interface CurriculumBuild {
  subjects: Subject[];
  programSubjects: ProgramSubject[];
}

/**
 * Build the catalogue.
 *
 * Every subject is created before any prerequisite is resolved, so a
 * prerequisite may name a subject taught in a later term — which is normal,
 * since a document's prerequisite column refers backwards but is written
 * alongside the subject that needs it.
 */
export function buildCurricula(createdAt: string): CurriculumBuild {
  const subjects: Subject[] = [];
  const programSubjects: ProgramSubject[] = [];
  let subjectSeq = 0;
  let mappingSeq = 0;

  for (const curriculum of CURRICULA) {
    // Subject ids for this curriculum only, keyed by title. Titles are the
    // key rather than codes, because a code cannot identify anything when 144
    // rows across the centre have none.
    const idByTitle = new Map<string, string>();

    // One pass to mint every subject, so a prerequisite may name a subject
    // taught in a later term - which is normal, since a document's
    // prerequisite column refers backwards but is written beside the subject
    // that needs it.
    const lines: Array<{
      term: (typeof curriculum.terms)[number];
      spec: (typeof curriculum.terms)[number]['subjects'][number];
      subjectId: string;
    }> = [];

    for (const term of curriculum.terms) {
      for (const spec of term.subjects) {
        subjectSeq += 1;
        const subjectId = `subj-${subjectSeq}`;
        subjects.push({
          id: subjectId,
          code: spec.code,
          title: spec.title,
          description: spec.qualification ? `Leads to ${spec.qualification}.` : '',
          units: spec.units,
          lectureHours: spec.lecHours,
          labHours: spec.labHours,
          isActive: true,
          createdAt,
        });
        // First occurrence wins: a title repeated inside one curriculum is a
        // duplicate in the source document, and the prerequisite meant the
        // first one.
        if (!idByTitle.has(spec.title)) idByTitle.set(spec.title, subjectId);
        lines.push({ term, spec, subjectId });
      }
    }

    for (const { term, spec, subjectId } of lines) {
      const prerequisiteSubjectIds: string[] = [];
      for (const title of spec.prereqTitles) {
        const target = idByTitle.get(title);
        // Self-reference guard: at least one document lists a subject as its
        // own prerequisite. Dropping it is right, and the note still prints
        // what the document said.
        if (target && target !== subjectId) prerequisiteSubjectIds.push(target);
      }

      mappingSeq += 1;
      programSubjects.push({
        id: `ps-${mappingSeq}`,
        curriculumId: curriculum.id,
        subjectId,
        yearLevel: term.yearLevel,
        semesterPeriod: term.period,
        isRequired: true,
        prerequisiteSubjectIds,
        prerequisiteStanding: spec.standing,
        prerequisiteNote: spec.note,
        isNonAcademic: spec.nonAcademic,
      });
    }
  }

  return { subjects, programSubjects };
}
