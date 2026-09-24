/**
 * The seeded database.
 *
 * V9 narrowed this to one working school year, 2026-2027. The three years
 * before it exist only to hold the finishing trainee's history, and only
 * their diploma has semesters in them; every other list stays one year long.
 *
 * Almost nothing here is hand-listed any more. Curricula come from
 * `./curricula`, and sections, schedules, enrolments and grading sheets are
 * generated from them — which is what guarantees the property V9 asked for:
 * no blank schedules, and no semester with nothing in it.
 *
 * The shape of the year is deliberate, so the whole path can be demonstrated
 * from seed data alone:
 *
 *   1st Semester   CLOSED. Every class graded, every grading sheet APPROVED.
 *                  This is what gives the Grade Evaluation Form content.
 *   2nd Semester   OPEN. Everyone enrolled, nothing graded yet. This is what
 *                  a trainer signs in to grade, and what the registrar
 *                  reviews.
 *
 * One trainee per diploma is left with an unresolved INC from 1st Semester,
 * so the zero-GWA rule and the enrolment gate both have something real to
 * act on.
 */

import type {
  AcademicYear,
  AuditLog,
  ClassSchedule,
  Curriculum,
  DayCode,
  Enrollment,
  EnrollmentDocument,
  EnrollmentSubject,
  Faculty,
  FacultyAssignment,
  GradeCompletion,
  GradingSheet,
  GradingSheetRow,
  Program,
  Section,
  Semester,
  SemesterPeriod,
  Student,
  Subject,
  User,
} from '@/types';
import type { Database } from '../repositories/db';
import { BLANK_PROFILE } from './blank-profile';
import { CURRICULA, DIPLOMAS, buildCurricula, termsFor } from './curricula';
import { deriveGradeStatus, gradeForPercentage } from '../services/grade-rules';
import { DEFAULT_TRAINEE_PASSWORD } from '@/lib/passwords';

/* ------------------------------------------------------------------ */
/* Fixed points                                                        */
/* ------------------------------------------------------------------ */

const T = {
  created: '2026-06-01T08:00:00.000Z',
  sem1Graded: '2026-12-15T08:00:00.000Z',
  sem2Enrolled: '2027-01-05T08:00:00.000Z',
};

/* ------------------------------------------------------------------ */
/* The two demonstration scenarios                                     */
/* ------------------------------------------------------------------ */

/**
 * This dataset exists to run two walk-throughs, and nothing else.
 *
 *   1. A FRESHMAN arrives with no record at all: they apply, are approved,
 *      are enrolled, are graded, and appear on a Grade Evaluation Form.
 *      That needs a diploma whose Year 1 FIRST semester is open.
 *
 *   2. A CONTINUING trainee who already finished Year 1 First Semester
 *      proceeds to the next one. That needs a diploma whose Year 1 FIRST
 *      semester is closed and fully graded, with the SECOND one open.
 *
 * Those two requirements contradict each other inside one diploma, because
 * `setSemesterActive` allows exactly one open semester per diploma and year
 * level — opening one closes the other. So each scenario gets its own
 * diploma, which is what the per-diploma semester model is for. Running both
 * in Information Technology would mean one of them could never be set up.
 */
const FRESHMAN_PROGRAM = 'prog-dit';
const SEQUENTIAL_PROGRAM = 'prog-dat';

const ACADEMIC_YEAR_ID = 'ay-2026';
const ACADEMIC_YEAR_LABEL = '2026-2027';

/**
 * The centre's real Diplomas, from the curriculum documents rather than from
 * a list kept here. Thirteen of them, and DIT carries two curricula: the 2022
 * edition trainees are still finishing under, and the 2024 revision new
 * intakes go onto.
 */
const DIPLOMA_ROWS: Array<[string, string, string, string]> = DIPLOMAS.map(
  (d) => [d.id, d.code, d.name, d.description],
);

function makePrograms(): Program[] {
  return DIPLOMAS.map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    description: d.description,
    programType: 'DIPLOMA',
    yearsToComplete: d.years,
    isActive: true,
    createdAt: T.created,
  }));
}

/**
 * One row per curriculum document, not per diploma.
 *
 * `isActive` means **open for new intake**, never "usable": a superseded
 * edition keeps working for every trainee already enrolled under it, which is
 * the whole reason it is kept. DIT's 2022 edition is therefore inactive and
 * entirely functional at the same time.
 */
function makeCurricula(): Curriculum[] {
  return CURRICULA.map((c) => ({
    id: c.id,
    programId: c.programId,
    code: c.code,
    name: c.name + (c.versionLabel ? ` (${c.versionLabel} edition)` : ''),
    effectiveYear: curriculumYear(c.effectivity),
    isActive: !c.supersededBy,
    createdAt: T.created,
  }));
}

/**
 * The year a curriculum edition took effect — what the Grade Evaluation
 * prints as its Batch.
 *
 * Read from the document's own effectivity line ("Revised Training Year
 * 2022-2025" is 2022). Several of the centre's documents carry no year at
 * all, only their length ("5 Academic Semester, 1 Semester Internship");
 * those are the editions current in 2025, when the centre's present set of
 * curricula was issued.
 */
function curriculumYear(effectivity: string): string {
  return /\b(19|20)\d{2}\b/.exec(effectivity)?.[0] ?? CURRENT_CURRICULUM_YEAR;
}

const CURRENT_CURRICULUM_YEAR = '2025';

/** The edition a new intake joins: the one nothing has superseded. */
const curriculumIdFor = (programId: string) =>
  CURRICULA.find((c) => c.programId === programId && !c.supersededBy)?.id ??
  CURRICULA.find((c) => c.programId === programId)?.id ??
  '';

/* ------------------------------------------------------------------ */
/* School year and semesters                                           */
/* ------------------------------------------------------------------ */

/**
 * The three school years behind the current one.
 *
 * They exist for the finishing trainee: a record that runs from First Year to
 * Third has to have been taken over three school years, and printing all of
 * it under 2026-2027 put their First Year in the same term the current intake
 * is sitting now. Only her diploma has semesters in them.
 */
const PAST_YEARS = [
  { id: 'ay-2023', label: '2023-2024', yearsBack: 3 },
  { id: 'ay-2024', label: '2024-2025', yearsBack: 2 },
  { id: 'ay-2025', label: '2025-2026', yearsBack: 1 },
] as const;

function makeAcademicYears(): AcademicYear[] {
  return [
    ...PAST_YEARS.map((y) => ({
      id: y.id,
      label: y.label,
      startDate: `${2026 - y.yearsBack}-08-01`,
      endDate: `${2027 - y.yearsBack}-07-31`,
      isActive: false,
    })),
    {
      id: ACADEMIC_YEAR_ID,
      label: ACADEMIC_YEAR_LABEL,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      isActive: true,
    },
  ];
}

function shiftYears(iso: string, years: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

/** The finishing trainee's diploma, one past school year per year level. */
const HISTORY_PROGRAM = SEQUENTIAL_PROGRAM;

function historySemesterId(yearLevel: number, period: SemesterPeriod): string {
  const year = PAST_YEARS[yearLevel - 1];
  return `${semesterId(HISTORY_PROGRAM, yearLevel, period)}-${year.id}`;
}

/**
 * Year 1 in 2023-2024, Year 2 in 2024-2025, Year 3 in 2025-2026 — the terms
 * a trainee who entered in 2023 actually sat, all of them closed.
 */
function makeHistorySemesters(): Semester[] {
  const drift = DIPLOMA_ROWS.findIndex(([id]) => id === HISTORY_PROGRAM) * 2;
  return termsFor(curriculumIdFor(HISTORY_PROGRAM))
    .filter(({ yearLevel }) => yearLevel <= PAST_YEARS.length)
    .map(({ yearLevel, semesterPeriod }) => {
      const back = PAST_YEARS[yearLevel - 1].yearsBack;
      const window = TERM_DATES[semesterPeriod];
      return {
        id: historySemesterId(yearLevel, semesterPeriod),
        academicYearId: PAST_YEARS[yearLevel - 1].id,
        programId: HISTORY_PROGRAM,
        yearLevel,
        semesterPeriod,
        startDate: shiftYears(addDays(window.start, drift), back),
        endDate: shiftYears(addDays(window.end, drift), back),
        isActive: false,
      };
    });
}

const PERIOD_SUFFIX: Record<SemesterPeriod, string> = {
  FIRST: 's1',
  SECOND: 's2',
  SUMMER: 'sum',
};

function semesterId(programId: string, yearLevel: number, period: SemesterPeriod): string {
  return `sem-${programId.replace('prog-', '')}-y${yearLevel}-${PERIOD_SUFFIX[period]}`;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * One semester per term the diploma's own curriculum runs.
 *
 * Not a fixed six. The curricula have different shapes — five carry a Summer
 * practicum and eight do not, and of those five some place it after First Year
 * and others after Second — so the calendar is generated from each
 * curriculum's terms rather than from a loop that assumes everyone is alike.
 *
 * Start dates are staggered by diploma so the per-diploma calendar is visibly
 * doing something; identical dates everywhere would look exactly like the
 * single global calendar V8 replaced.
 */
const TERM_DATES: Record<SemesterPeriod, { start: string; end: string }> = {
  FIRST: { start: '2026-08-03', end: '2026-12-18' },
  SECOND: { start: '2027-01-04', end: '2027-05-14' },
  SUMMER: { start: '2027-05-24', end: '2027-07-16' },
};

function makeSemesters(): Semester[] {
  const rows: Semester[] = [];
  const seen = new Set<string>();

  DIPLOMA_ROWS.forEach(([programId], diplomaIndex) => {
    const drift = diplomaIndex * 2;
    // Every term any of this diploma's curricula uses. A diploma with two
    // editions needs the union, or a trainee on the older one would have no
    // calendar to enrol into.
    for (const curriculum of CURRICULA.filter((c) => c.programId === programId)) {
      for (const { yearLevel, semesterPeriod } of termsFor(curriculum.id)) {
        const id = semesterId(programId, yearLevel, semesterPeriod);
        if (seen.has(id)) continue;
        seen.add(id);
        const window = TERM_DATES[semesterPeriod];
        rows.push({
          id,
          academicYearId: ACADEMIC_YEAR_ID,
          programId,
          yearLevel,
          semesterPeriod,
          startDate: addDays(window.start, drift),
          endDate: addDays(window.end, drift),
          // Exactly one open term per diploma and year level. The freshman
          // walk-through needs an open First; the Sequential Enrollment one
          // needs a closed, fully graded First and an open Second.
          isActive:
            yearLevel === 1 &&
            ((programId === FRESHMAN_PROGRAM && semesterPeriod === 'FIRST') ||
              (programId === SEQUENTIAL_PROGRAM && semesterPeriod === 'SECOND')),
        });
      }
    }
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/* Faculty and accounts                                                */
/* ------------------------------------------------------------------ */

/**
 * One head trainer per diploma. Long enough for all thirteen — indexing this
 * by diploma is only safe while it is, and it silently produced `undefined`
 * the moment the real curricula took the count from eight to thirteen.
 */
const TRAINER_NAMES: Array<[string, string]> = [
  ['Bienvenido', 'Cruz'], ['Dario', 'Fernandez'], ['Isabel', 'Castro'], ['Carmela', 'Reyes'],
  ['Manuel', 'Sarmiento'], ['Noel', 'Bautista'], ['Ramon', 'Aquino'], ['Teresa', 'Lopez'],
  ['Virgilio', 'Mendoza'], ['Adelina', 'Panganiban'], ['Rogelio', 'Katigbak'],
  ['Marisol', 'Buenaventura'], ['Efren', 'Dimaculangan'],
];
const ASSISTANT_NAMES: Array<[string, string]> = [
  ['Alma', 'Gutierrez'], ['Bert', 'Nolasco'], ['Cely', 'Padilla'], ['Danilo', 'Rosales'],
  ['Elena', 'Marquez'], ['Fidel', 'Solano'], ['Gina', 'Tolentino'], ['Hector', 'Umali'],
  ['Iris', 'Valdez'], ['Jomar', 'Wenceslao'], ['Karla', 'Ybanez'], ['Lito', 'Zamora'],
  ['Mila', 'Abadilla'], ['Nestor', 'Bacani'], ['Olive', 'Cabral'], ['Pablo', 'Dizon'],
];

/**
 * Three trainers per diploma, one per year level.
 *
 * Splitting by year level is what keeps the generated timetable free of
 * clashes: a trainer teaches one section, so their week cannot collide with
 * itself. The Year 1 trainer of each diploma is the one given a login, which
 * is why the demo accounts all have a full class list.
 */
/**
 * How many trainers share one diploma's year level.
 *
 * The centre's own Grade Evaluation shows a different trainer against nearly
 * every subject, so one per year level made the printed form look wrong. More
 * than one is safe because a trainer still belongs to exactly one (diploma,
 * year level) and therefore to one section, whose classes are all at distinct
 * times — which is the property that keeps the generated timetable free of
 * clashes. Drawing from a shared pool across diplomas would break it.
 */
const TRAINERS_PER_YEAR = 5;

function facultyId(programId: string, yearLevel: number, slot = 0): string {
  return `fac-${programId.replace('prog-', '')}-y${yearLevel}-${slot}`;
}

function makeFaculty(): Faculty[] {
  const rows: Faculty[] = [];
  let assistant = 0;
  let employee = 1000;
  DIPLOMA_ROWS.forEach(([programId, , name], index) => {
    for (let yearLevel = 1; yearLevel <= 3; yearLevel += 1) {
      for (let slot = 0; slot < TRAINERS_PER_YEAR; slot += 1) {
        // Slot 0 of Year 1 is the trainer given a login, so every demo trainer
        // account still opens onto a full class list.
        const [first, last] =
          yearLevel === 1 && slot === 0
            ? TRAINER_NAMES[index % TRAINER_NAMES.length]
            : ASSISTANT_NAMES[assistant++ % ASSISTANT_NAMES.length];
        employee += 1;
        rows.push({
          id: facultyId(programId, yearLevel, slot),
          employeeId: `EMP-${employee}`,
          firstName: first,
          lastName: last,
          diploma: name.replace('Diploma in ', ''),
          position: yearLevel === 1 && slot === 0 ? 'Senior Trainer' : 'Trainer II',
          email: `${first.charAt(0).toLowerCase()}${last.toLowerCase()}${employee}@rtc-korphil.example.ph`,
          contactNumber: `0917-100-${String(employee)}`,
          isActive: true,
          createdAt: T.created,
        });
      }
    }
  });
  return rows;
}

function makeUsers(students: Student[]): User[] {
  const base = {
    status: 'APPROVED' as const,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: T.created,
    updatedAt: T.created,
  };

  const users: User[] = [
    {
      ...base,
      id: 'usr-registrar',
      email: 'registrar@rtc-korphil.example.ph',
      password: 'registrar123',
      firstName: 'Maria',
      lastName: 'Santos',
      title: 'Ms.',
      position: 'Registrar I',
      role: 'REGISTRAR',
      facultyId: null,
      studentId: null,
    },
  ];

  // The centre's IT Administrator: looks after trainee sign-ins.
  users.push({
    ...base,
    id: 'usr-itadmin',
    email: 'itadmin@rtc-korphil.example.ph',
    password: 'itadmin123',
    firstName: 'Arnel',
    lastName: 'Villanueva',
    title: 'Mr.',
    position: 'IT Officer',
    role: 'IT_ADMIN',
    facultyId: null,
    studentId: null,
  });

  // One login per diploma, held by that diploma's Year 1 trainer.
  DIPLOMA_ROWS.forEach(([programId, code], index) => {
    const [first, last] = TRAINER_NAMES[index % TRAINER_NAMES.length];
    users.push({
      ...base,
      id: `usr-trainer-${code.toLowerCase()}`,
      email: `${code.toLowerCase()}.trainer@rtc-korphil.example.ph`,
      password: 'trainer123',
      firstName: first,
      lastName: last,
      title: '',
      position: 'Senior Trainer',
      role: 'TRAINER',
      facultyId: facultyId(programId, 1),
      studentId: null,
    });
  });

  // Every approved trainee has a sign-in: their ID Number and the default
  // password, to be changed at first sign-in — exactly what approval makes.
  //
  // The exception is the portal's demo trainee, the Sequential Enrollment
  // trainee, whose record has a finished, graded semester behind it. They
  // have already chosen their own password, so the walk-through opens
  // straight onto a portal with something in it.
  const demoTrainee = students.find((s) => s.programId === SEQUENTIAL_PROGRAM) ?? students[0];
  for (const student of students) {
    const isDemo = student.id === demoTrainee?.id;
    users.push({
      ...base,
      id: isDemo ? 'usr-trainee' : `usr-trainee-${student.id}`,
      email: student.email,
      password: isDemo ? 'trainee123' : DEFAULT_TRAINEE_PASSWORD,
      mustChangePassword: !isDemo,
      firstName: student.firstName,
      lastName: student.lastName,
      title: '',
      position: '',
      role: 'TRAINEE',
      facultyId: null,
      studentId: student.id,
    });
  }

  return users;
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function sectionId(programId: string, yearLevel: number): string {
  return `sec-${programId.replace('prog-', '')}${yearLevel}a`;
}

function makeSections(): Section[] {
  const rows: Section[] = [];
  for (const [programId, code] of DIPLOMA_ROWS) {
    for (let yearLevel = 1; yearLevel <= 3; yearLevel += 1) {
      rows.push({
        id: sectionId(programId, yearLevel),
        code: `${code}-${yearLevel}A`,
        programId,
        yearLevel,
        capacity: 30,
        isActive: true,
        createdAt: T.created,
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Timetable                                                           */
/* ------------------------------------------------------------------ */

/**
 * Eight non-overlapping weekly slots — two day patterns × four time bands.
 *
 * A semester carries at most eight subjects, so every subject gets a real
 * time and room. That is what "no blank schedules" means in practice: the
 * grid is generated from the curriculum rather than hand-listed and left
 * with holes.
 */
const TIME_SLOTS: Array<{ days: DayCode[]; start: string; end: string }> = [
  { days: ['M', 'W', 'F'], start: '07:00', end: '09:00' },
  { days: ['M', 'W', 'F'], start: '09:00', end: '11:00' },
  { days: ['M', 'W', 'F'], start: '13:00', end: '15:00' },
  { days: ['M', 'W', 'F'], start: '15:00', end: '17:00' },
  { days: ['T', 'Th'], start: '07:00', end: '09:00' },
  { days: ['T', 'Th'], start: '09:00', end: '11:00' },
  { days: ['T', 'Th'], start: '13:00', end: '15:00' },
  { days: ['T', 'Th'], start: '15:00', end: '17:00' },
];

function roomFor(code: string, subject: Subject, index: number): string {
  if (subject.labHours > 0) return `${code} Laboratory ${(index % 2) + 1}`;
  return `Room ${200 + (index % 8) + 1}`;
}

/* ------------------------------------------------------------------ */
/* Trainees                                                            */
/* ------------------------------------------------------------------ */


/** Trainees per year level. Year 1 is the largest intake, as in reality. */
/**
 * The whole cast, by name, because a controlled demonstration set is small
 * enough to write down and much easier to reason about than a generator.
 *
 * `sequential: true` marks the trainee the Sequential Enrollment walk-through
 * is built around. `blocked: true` marks the one classmate carrying an
 * unresolved INC — kept deliberately, so the demonstration can show the gate
 * refusing someone as well as letting someone through. Every other continuing
 * trainee is cleanly passed and eligible.
 */
interface CastMember {
  first: string;
  middle: string;
  last: string;
  programId: string;
  sequential?: boolean;
  blocked?: boolean;
  /**
   * A trainee at the end of the programme: enrolled in and graded for every
   * term their curriculum runs, First Year through Third.
   *
   * Everyone else in this dataset sits in a single term, which is enough to
   * demonstrate enrolling and grading but leaves the Grade Evaluation Form
   * showing one semester — so the thing the form exists for, a whole
   * programme read end to end, could not be seen at all.
   */
  graduating?: boolean;
}

const CAST: CastMember[] = [
  // Freshman diploma — classmates already sitting in the open First Semester,
  // so the applicant joins a real class rather than an empty one.
  { first: 'Andrea', middle: 'Cruz', last: 'Ocampo', programId: FRESHMAN_PROGRAM },
  { first: 'Bryan', middle: 'Reyes', last: 'Marquez', programId: FRESHMAN_PROGRAM },
  { first: 'Chloe', middle: 'Santos', last: 'Solis', programId: FRESHMAN_PROGRAM },

  // Sequential-enrollment diploma — First Semester finished and graded.
  { first: 'Kevin', middle: 'Santos', last: 'Rivera', programId: SEQUENTIAL_PROGRAM, sequential: true },
  { first: 'Lorna', middle: 'Perez', last: 'Antonio', programId: SEQUENTIAL_PROGRAM },
  { first: 'Miguel', middle: 'Uy', last: 'Pascual', programId: SEQUENTIAL_PROGRAM },
  { first: 'Nadine', middle: 'Diaz', last: 'Enriquez', programId: SEQUENTIAL_PROGRAM, blocked: true },

  // Finishing: every term of the diploma behind them, graded, awaiting
  // graduation. This is the record a complete Grade Evaluation is printed
  // from, and the one a Completion or TOR would eventually be built on.
  { first: 'Patricia', middle: 'Lim', last: 'Gonzales', programId: SEQUENTIAL_PROGRAM, graduating: true },
];

interface StudentPlan {
  student: Student;
  programId: string;
  yearLevel: number;
  /** Carries the unresolved INC that blocks their Sequential Enrollment. */
  blocked: boolean;
  /** Enrolled in and graded for every term of the curriculum. */
  graduating: boolean;
}

function makeStudents(): StudentPlan[] {
  const plans: StudentPlan[] = [];
  let n = 0;

  {
    {
      for (const member of CAST) {
        const { first, middle, last, programId } = member;
        // Most of this dataset is a Year 1 trainee of the 2026-2027 intake;
        // the two walk-through scenarios differ by which semester is open to
        // them, not by year level. The finishing trainee is the exception,
        // and entered three years earlier.
        const yearLevel = member.graduating ? 3 : 1;
        const entryYear = member.graduating ? 2023 : 2026;
        n += 1;

        plans.push({
          programId,
          yearLevel,
          blocked: Boolean(member.blocked),
          graduating: Boolean(member.graduating),
          student: {
            ...BLANK_PROFILE,
            id: `stu-${n}`,
            studentNumber: `${entryYear}-${String(n).padStart(5, '0')}`,
            firstName: first,
            middleName: middle,
            lastName: last,
            extensionName: '',
            email: `${first.toLowerCase()}.${last.toLowerCase()}${n}@trainee.example.ph`,
            contactNumber: `0918-200-${String(1000 + n).padStart(4, '0')}`,
            address: `${100 + n} Sampaguita St., Brgy. Bago Gallera, Davao City, Davao del Sur`,
            addressRegion: 'R11',
            addressProvince: 'Davao del Sur',
            addressCityMunicipality: 'Davao City',
            addressBarangay: 'Bago Gallera',
            addressDistrict: 'District II (Talomo)',
            addressStreet: `${100 + n} Sampaguita St.`,
            birthDate: `${entryYear - 18}-0${(n % 9) + 1}-1${n % 9}`,
            birthPlace: 'Davao City, Davao del Sur',
            birthRegion: 'R11',
            birthProvince: 'Davao del Sur',
            birthCityMunicipality: 'Davao City',
            sex: n % 2 === 0 ? 'FEMALE' : 'MALE',
            civilStatus: 'Single',
            nationality: 'Filipino',
            bloodType: ['O+', 'A+', 'B+', 'AB+'][n % 4],
            employmentStatus: 'Student',
            disability: '',
            disabilitySpecify: '',
            socialMedia: 'Facebook',
            socialMediaAccount: `${first.toLowerCase()}.${last.toLowerCase()}`,
            emergencyContactLastName: last,
            emergencyContactFirstName: middle,
            emergencyContactMiddleName: '',
            emergencyContactRelationship: n % 2 === 0 ? 'Mother' : 'Father',
            emergencyContactNumber: `0917-300-${String(2000 + n).padStart(4, '0')}`,
            emergencyContactAddress: `${100 + n} Sampaguita St., Davao City`,
            highestEducation: 'Senior High School Graduate',
            classification: 'Student',
            scholarshipType: '',
            learnerId: `LID-${String(1000 + n)}`,
            applicantStanding: 'SHS_GRADUATE',
            referenceCode: '',
            driveFolderId: null,
            secondarySchool: 'Davao City National High School',
            secondarySchoolYearAttended: String(entryYear - 1),
            basisOfAdmission: 'Form 138',
            dateAdmitted: `${entryYear}-06-15`,
            nstpSerialNo: '',
            graduatedAt: null,
            departureReason: null,
            departureNote: '',
            departedAt: null,
            specialOrderNo: null,
            programId,
            curriculumId: curriculumIdFor(programId),
            sectionId: sectionId(programId, yearLevel),
            yearLevel,
            status: 'ACTIVE',
            isTransferee: false,
            rejectionReason: null,
            approvedAt: T.created,
            archivedAt: null,
            createdAt: T.created,
            updatedAt: T.created,
          },
        });
      }
    }
  }

  return plans;
}

/**
 * No pre-seeded applications.
 *
 * The freshman walk-through begins by submitting one live, and a Pending tab
 * that already has strangers in it makes that submission hard to spot. If the
 * public form cannot be reached on the day, the registrar can still create the
 * record by hand from Students.
 */
function makeApplicants(): Student[] {
  return [];
}

/* ------------------------------------------------------------------ */
/* Grades                                                              */
/* ------------------------------------------------------------------ */

/**
 * The passing band of the official scale (TESDA Circular 021 s. 2023). The
 * demo cohort all pass; 4.00 and 5.00 exist in `GRADE_POINTS` but are not
 * dealt out here.
 */
const PERCENTAGE_POOL = [99, 97, 94, 91, 88, 85, 82, 79, 76];

function percentageOf(seed: number): number {
  return PERCENTAGE_POOL[seed % PERCENTAGE_POOL.length];
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

/**
 * What the login page offers as one-click demo logins.
 *
 * Derived from the seeded users rather than hand-listed, so it cannot drift
 * from the accounts that actually exist.
 */
export const DEMO_ACCOUNTS: Array<{
  /** What goes in the sign-in box: an email for staff, an ID Number for a trainee. */
  email: string;
  password: string;
  name: string;
  role: User['role'];
  detail: string;
}> = (() => {
  const students = makeStudents().map((p) => p.student);
  const users = makeUsers(students);
  // Every trainee has an account, but two show both paths: the demo trainee
  // who has already changed their password, and a freshman on the default.
  const freshman = users.find((u) => u.role === 'TRAINEE' && u.mustChangePassword);
  return users
    .filter((u) => u.role !== 'TRAINEE' || u.id === 'usr-trainee' || u.id === freshman?.id)
    .map((user) => {
      const facultyRow = user.facultyId
        ? makeFaculty().find((f) => f.id === user.facultyId)
        : undefined;
      const student = user.studentId ? students.find((s) => s.id === user.studentId) : undefined;
      return {
        email: student ? student.studentNumber : user.email,
        password: user.password,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        detail:
          user.role === 'TRAINER'
            ? (facultyRow?.diploma ?? 'Trainer')
            : user.role === 'TRAINEE'
              ? user.mustChangePassword
                ? 'Freshman · first sign-in, must change the default password'
                : 'Continuing trainee · Sequential Enrollment demo'
              : user.role === 'IT_ADMIN'
                ? 'Resets trainee passwords'
                : 'Full registrar access',
      };
    });
})();

export function createSeedDatabase(): Database {
  const programs = makePrograms();
  const curricula = makeCurricula();
  const { subjects, programSubjects } = buildCurricula(T.created);
  const academicYears = makeAcademicYears();
  const semesters = [...makeHistorySemesters(), ...makeSemesters()];
  const faculty = makeFaculty();
  const sections = makeSections();

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  /* ---- Schedules: one per subject, per diploma, per semester ---- */
  const classSchedules: ClassSchedule[] = [];
  const facultyAssignments: FacultyAssignment[] = [];
  let scheduleSeq = 0;

  for (const [programId, code] of DIPLOMA_ROWS) {
    // Classes are published for the edition a new intake joins. An older
    // edition's trainees keep their own curriculum, but they are past the
    // years this demonstration covers, so scheduling both would double the
    // timetable to no purpose.
    const currentCurriculum = curriculumIdFor(programId);
    // The finishing trainee's past terms were taught too, so their classes
    // exist and the evaluation can name who taught each one.
    const runs = termsFor(currentCurriculum).flatMap((term) => [
      { ...term, semId: semesterId(programId, term.yearLevel, term.semesterPeriod) },
      ...(programId === HISTORY_PROGRAM && term.yearLevel <= PAST_YEARS.length
        ? [{ ...term, semId: historySemesterId(term.yearLevel, term.semesterPeriod) }]
        : []),
    ]);
    for (const { yearLevel, semesterPeriod, semId } of runs) {
      const mappings = programSubjects.filter(
        (ps) =>
          ps.curriculumId === currentCurriculum &&
          ps.yearLevel === yearLevel &&
          ps.semesterPeriod === semesterPeriod,
      );
      mappings.forEach((mapping, index) => {
        const subject = subjectById.get(mapping.subjectId);
        if (!subject) return;
        scheduleSeq += 1;
        const slot = TIME_SLOTS[index % TIME_SLOTS.length];
        const id = `sch-${scheduleSeq}`;
        classSchedules.push({
          id,
          semesterId: semId,
          subjectId: subject.id,
          sectionId: sectionId(programId, yearLevel),
          facultyId: facultyId(programId, yearLevel, index % TRAINERS_PER_YEAR),
          days: [...slot.days],
          startTime: slot.start,
          endTime: slot.end,
          room: roomFor(code, subject, index),
          status: 'PUBLISHED',
          createdAt: T.created,
          updatedAt: T.created,
        });
        facultyAssignments.push({
          id: `fa-${scheduleSeq}`,
          facultyId: facultyId(programId, yearLevel, index % TRAINERS_PER_YEAR),
          classScheduleId: id,
          assignedAt: T.created,
        });
      });
    }
  }

  const scheduleFor = (semId: string, subjectId: string) =>
    classSchedules.find((s) => s.semesterId === semId && s.subjectId === subjectId);

  /* ---- Trainees ---- */
  const plans = makeStudents();
  const students = plans.map((p) => p.student);
  const applicants = makeApplicants();
  const allStudents = [...students, ...applicants];

  /* ---- Enrolments: 1st semester graded, 2nd semester open ---- */
  const enrollments: Enrollment[] = [];
  const enrollmentSubjects: EnrollmentSubject[] = [];
  let enrollmentSeq = 0;
  let rowSeq = 0;

  /**
   * Enrolments, shaped by which scenario the trainee belongs to.
   *
   * FRESHMAN diploma — the classmates sit in the OPEN First Semester,
   * enrolled and ungraded. That is the term the applicant will be enrolled
   * into during the walk-through, so they join a class that already has
   * people in it, and the trainer has a real sheet to fill.
   *
   * SEQUENTIAL diploma — the trainees have FINISHED First Semester with
   * grades on record, and are deliberately NOT enrolled in Second Semester.
   * Leaving that enrolment unmade is the whole point: it is what the
   * registrar performs on the day.
   */
  const incHolders = new Set(
    plans.filter((p) => p.blocked).map((p) => p.student.id),
  );
  // The account the trainee portal signs in to — the same pick as makeUsers.
  const portalTraineeId = plans.find((p) => p.programId === SEQUENTIAL_PROGRAM)?.student.id;

  for (const plan of plans) {
    const isSequential = plan.programId === SEQUENTIAL_PROGRAM;

    // Which terms this trainee has a record in.
    //
    // Most sit in one: the freshman cohort in the open First Semester, the
    // continuing cohort in a First Semester they have finished. The trainee
    // at the end of the programme has every term the curriculum runs, which
    // is what gives the Grade Evaluation a whole diploma to print rather
    // than a single semester.
    const terms = plan.graduating
      ? termsFor(curriculumIdFor(plan.programId))
      : [{ yearLevel: plan.yearLevel, semesterPeriod: 'FIRST' as SemesterPeriod }];

    for (const term of terms) {
      const graded = plan.graduating || isSequential;
      // The finishing trainee sat each year in its own school year.
      const semId = plan.graduating
        ? historySemesterId(term.yearLevel, term.semesterPeriod)
        : semesterId(plan.programId, term.yearLevel, term.semesterPeriod);
      const semester = semesters.find((sem) => sem.id === semId);
      const enrolledAt = plan.graduating && semester ? `${semester.startDate}T08:00:00.000Z` : T.created;
      const gradedAt = plan.graduating && semester ? `${semester.endDate}T08:00:00.000Z` : T.sem1Graded;
      const mappings = programSubjects.filter(
        (ps) =>
          ps.curriculumId === curriculumIdFor(plan.programId) &&
          ps.yearLevel === term.yearLevel &&
          ps.semesterPeriod === term.semesterPeriod,
      );
      if (mappings.length === 0) continue;

      enrollmentSeq += 1;
      const enrollmentId = `enr-${enrollmentSeq}`;
      let totalUnits = 0;

      mappings.forEach((mapping, index) => {
        const subject = subjectById.get(mapping.subjectId);
        if (!subject) return;
        rowSeq += 1;
        totalUnits += subject.units;

        // The one INC lands on its holder's first subject, so it is easy to
        // find and genuinely blocks their Sequential Enrollment. A trainee
        // about to graduate never carries one — an unresolved INC is exactly
        // what would stop them.
        const isInc =
          graded && !plan.graduating && incHolders.has(plan.student.id) && index === 0;
        // A percentage first, then its transmutation - the same path a
        // trainer's entry takes, so the demo data cannot hold a grade that no
        // percentage would have produced.
        const finalPercentage = graded && !isInc ? percentageOf(rowSeq) : null;
        const finalGrade = graded
          ? isInc
            ? 'INC'
            : gradeForPercentage(finalPercentage as number)
          : null;

        enrollmentSubjects.push({
          id: `es-${rowSeq}`,
          enrollmentId,
          subjectId: subject.id,
          classScheduleId: scheduleFor(semId, subject.id)?.id ?? null,
          units: subject.units,
          excludedFromGwa: mapping.excludedFromGwa,
          enrolledAt,
          finalPercentage,
          finalGrade,
          completionGrade: null,
          completionPercentage: null,
          // Derived, never hand-written: the seed and the services must agree
          // on what a grade means, or the demo data contradicts the rules.
          gradeStatus: deriveGradeStatus(finalGrade, null),
          gradedAt: graded ? gradedAt : null,
          gradedByUserId: graded ? 'usr-registrar' : null,
        });
      });

      const viewed =
        graded && !incHolders.has(plan.student.id) && plan.student.id !== portalTraineeId;
      enrollments.push({
        id: enrollmentId,
        studentId: plan.student.id,
        semesterId: semId,
        enrolledAt,
        // The continuing cohort's First Semester is finished; the freshman
        // cohort is sitting in theirs right now.
        status: graded ? 'COMPLETED' : 'ENROLLED',
        totalUnits,
        remarks: '',
        // The trainee has confirmed viewing a finished term's grades — all
        // but the portal's demo trainee, who is left to confirm it in the
        // walk-through, and the INC holder, whose term is not finished.
        gradesViewedAt: viewed ? addDays(gradedAt.slice(0, 10), 2) + 'T09:00:00.000Z' : null,
        // Must be built exactly as the grade-viewing service builds it.
        gradesViewedSignature: viewed
          ? enrollmentSubjects
              .filter((es) => es.enrollmentId === enrollmentId)
              .map((es) => `${es.id}:${es.finalGrade ?? ''}:${es.completionGrade ?? ''}`)
              .sort()
              .join('|')
          : null,
      });
    }
  }

  /*
   * Grading sheets exist only where grades exist: the Sequential Enrollment
   * diploma's finished First Semester. The freshman diploma's open term has
   * none on purpose, so its trainer opens a blank sheet during the
   * walk-through rather than reviewing one that is already approved.
   */
  const gradingSheets: GradingSheet[] = [];
  let sheetSeq = 0;

  for (const schedule of classSchedules) {
    const semester = semesters.find((s) => s.id === schedule.semesterId);
    if (!semester || semester.semesterPeriod !== 'FIRST') continue;
    // Only the finished semester has sheets. Without this the freshman
    // diploma's OPEN term would also get sheets — marked approved, holding
    // nothing but null grades — and its trainer would open an approved,
    // empty sheet instead of a blank one to fill in.
    if (semester.programId !== SEQUENTIAL_PROGRAM) continue;
    // The finishing trainee's past terms are history; their sheets are not
    // part of this term's review queue.
    if (semester.academicYearId !== ACADEMIC_YEAR_ID) continue;

    const rows: GradingSheetRow[] = [];
    for (const enrollment of enrollments) {
      if (enrollment.semesterId !== schedule.semesterId) continue;
      const row = enrollmentSubjects.find(
        (es) => es.enrollmentId === enrollment.id && es.subjectId === schedule.subjectId,
      );
      if (!row) continue;
      rows.push({
        studentId: enrollment.studentId,
        marker: row.finalGrade === 'INC' ? 'INC' : null,
        percentage: row.finalPercentage,
        grade: row.finalGrade === 'INC' ? null : row.finalGrade,
        remarks: '',
      });
    }
    if (rows.length === 0) continue;

    sheetSeq += 1;
    gradingSheets.push({
      id: `gs-${sheetSeq}`,
      referenceNumber: `GS-202612-${String(sheetSeq).padStart(5, '0')}`,
      classScheduleId: schedule.id,
      status: 'APPROVED',
      rows,
      submittedByUserId: null,
      submittedAt: T.sem1Graded,
      reviewedByUserId: 'usr-registrar',
      reviewedAt: T.sem1Graded,
      registrarRemarks: '',
      submissionCount: 1,
      createdAt: T.sem1Graded,
      updatedAt: T.sem1Graded,
    });
  }

  const users = makeUsers(students);

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      action: 'ACADEMIC_YEAR_CREATED',
      recordType: 'AcademicYear',
      recordId: ACADEMIC_YEAR_ID,
      userId: 'usr-registrar',
      userLabel: 'Maria Santos',
      detail: `School year ${ACADEMIC_YEAR_LABEL} created. Semesters are added per diploma.`,
      before: null,
      after: null,
      createdAt: T.created,
    },
  ];

  const gradeCompletions: GradeCompletion[] = [];
  const enrollmentDocuments: EnrollmentDocument[] = [];

  return {
    users,
    faculty,
    students: allStudents,
    programs,
    curricula,
    subjects,
    programSubjects,
    academicYears,
    semesters,
    sections,
    classSchedules,
    facultyAssignments,
    enrollments,
    enrollmentSubjects,
    gradeCompletions,
    gradingSheets,
    enrollmentDocuments,
    auditLogs,
  };
}
