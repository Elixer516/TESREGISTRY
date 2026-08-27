/**
 * Column aliases for the Curriculum import — one row per subject a
 * curriculum requires at a given year level and semester.
 *
 * The Term column is gone with V8. A file that still carries one imports
 * fine; the column is simply ignored.
 */
export const CURRICULUM_COLUMN_ALIASES: Record<string, string[]> = {
  curriculumCode: ['curriculum code', 'curriculum', 'code'],
  curriculumName: ['curriculum name', 'name'],
  programCode: ['program code', 'program'],
  effectiveYear: ['effective year', 'year effective', 'sy effective'],
  subjectCode: ['subject code', 'subject', 'course code'],
  yearLevel: ['year level', 'year'],
  semesterPeriod: ['semester', 'semester period'],
};

export const CURRICULUM_REQUIRED_FIELDS = [
  'curriculumCode',
  'programCode',
  'subjectCode',
  'yearLevel',
  'semesterPeriod',
] as const;

export const CURRICULUM_SAMPLE_CSV_TEMPLATE = [
  'Curriculum Code,Curriculum Name,Program Code,Effective Year,Subject Code,Year Level,Semester',
  'IT-2025,IT Curriculum 2025,IT,2025,GE101,1,FIRST',
  'IT-2025,IT Curriculum 2025,IT,2025,IT101,1,FIRST',
  'IT-2025,IT Curriculum 2025,IT,2025,IT102,1,FIRST',
].join('\n');

/** Coerces free text like "1st", "2nd Semester" into the FIRST/SECOND union. */
export function parseSemesterPeriod(value: string): 'FIRST' | 'SECOND' {
  return /2|second/i.test(value) ? 'SECOND' : 'FIRST';
}

