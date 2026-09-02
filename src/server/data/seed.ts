/**
 * The seeded database.
 *
 * V9 narrowed this to one school year, 2026-2027, and eight Diplomas. Earlier
 * years are gone: the registrar types a past record in by hand if one is ever
 * needed, and carrying two dead school years made every list longer without
 * making anything demonstrable.
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
import { CURRICULUM_SLOTS, buildCurricula } from './curricula';

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
const FRESHMAN_PROGRAM = 'prog-it';
const SEQUENTIAL_PROGRAM = 'prog-auto';

const ACADEMIC_YEAR_ID = 'ay-2026';
const ACADEMIC_YEAR_LABEL = '2026-2027';

/** [id, code, name, description] */
const DIPLOMA_ROWS: Array<[string, string, string, string]> = [
  ['prog-abet', 'ABET', 'Diploma in Agricultural Biosystems Engineering Technology', 'Farm power, agricultural structures, irrigation and post-harvest machinery.'],
  ['prog-auto', 'AUTO', 'Diploma in Automotive Technology', 'Engine systems, chassis, drivetrain and automotive electrical systems.'],
  ['prog-cet', 'CET', 'Diploma in Civil Engineering Technology', 'Construction materials, surveying, reinforced concrete and plumbing works.'],
  ['prog-hrt', 'HRT', 'Diploma in Hotel and Restaurant Technology', 'Front office, housekeeping, food and beverage service, and culinary arts.'],
  ['prog-hvacr', 'HVACR', 'Diploma in Heating, Ventilating, Air-Conditioning and Refrigeration Technology', 'Domestic, room and commercial refrigeration and air-conditioning servicing.'],
  ['prog-iamt', 'IAMT', 'Diploma in Industrial Automation and Mechatronics Technology', 'Electronics, programmable logic controllers, motor control and robotics.'],
  ['prog-it', 'IT', 'Diploma in Information Technology', 'Programming, networking, database management and web development.'],
  ['prog-met', 'MET', 'Diploma in Mechanical Engineering Technology', 'Machine shop practice, welding, machine tool operation and industrial maintenance.'],
];

function makePrograms(): Program[] {
  return DIPLOMA_ROWS.map(([id, code, name, description]) => ({
    id,
    code,
    name,
    description,
    programType: 'DIPLOMA',
    yearsToComplete: 3,
    isActive: true,
    createdAt: T.created,
  }));
}

function makeCurricula(): Curriculum[] {
  return DIPLOMA_ROWS.map(([id, code]) => ({
    id: `cur-${id.replace('prog-', '')}`,
    programId: id,
    code: `${code}-2026`,
    name: `${code} Curriculum ${ACADEMIC_YEAR_LABEL}`,
    effectiveYear: ACADEMIC_YEAR_LABEL,
    isActive: true,
    createdAt: T.created,
  }));
}

const curriculumIdFor = (programId: string) => `cur-${programId.replace('prog-', '')}`;

/* ------------------------------------------------------------------ */
/* School year and semesters                                           */
/* ------------------------------------------------------------------ */

function makeAcademicYears(): AcademicYear[] {
  return [
    {
      id: ACADEMIC_YEAR_ID,
      label: ACADEMIC_YEAR_LABEL,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      isActive: true,
    },
  ];
}

function semesterId(programId: string, yearLevel: number, period: SemesterPeriod): string {
  return `sem-${programId.replace('prog-', '')}-y${yearLevel}-s${period === 'FIRST' ? 1 : 2}`;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Six per diploma — three year levels, two semesters each.
 *
 * Start dates are staggered by diploma so the per-diploma calendar is visibly
 * doing something; identical dates everywhere would look exactly like the
 * single global calendar V8 replaced.
 */
function makeSemesters(): Semester[] {
  const rows: Semester[] = [];
  DIPLOMA_ROWS.forEach(([programId], diplomaIndex) => {
    const drift = diplomaIndex * 2;
    for (let yearLevel = 1; yearLevel <= 3; yearLevel += 1) {
      rows.push({
        id: semesterId(programId, yearLevel, 'FIRST'),
        academicYearId: ACADEMIC_YEAR_ID,
        programId,
        yearLevel,
        semesterPeriod: 'FIRST',
        startDate: addDays('2026-08-03', drift),
        endDate: addDays('2026-12-18', drift),
        // Open only where the freshman walk-through runs.
        isActive: programId === FRESHMAN_PROGRAM && yearLevel === 1,
      });
      rows.push({
        id: semesterId(programId, yearLevel, 'SECOND'),
        academicYearId: ACADEMIC_YEAR_ID,
        programId,
        yearLevel,
        semesterPeriod: 'SECOND',
        startDate: addDays('2027-01-04', drift),
        endDate: addDays('2027-05-14', drift),
        // Open only where Sequential Enrollment is demonstrated: that
        // diploma's First Semester is closed and graded, and this is the
        // term a continuing trainee moves into.
        isActive: programId === SEQUENTIAL_PROGRAM && yearLevel === 1,
      });
    }
  });
  return rows;
}

/* ------------------------------------------------------------------ */
/* Faculty and accounts                                                */
/* ------------------------------------------------------------------ */

const TRAINER_NAMES: Array<[string, string]> = [
  ['Bienvenido', 'Cruz'], ['Dario', 'Fernandez'], ['Isabel', 'Castro'], ['Carmela', 'Reyes'],
  ['Manuel', 'Sarmiento'], ['Noel', 'Bautista'], ['Ramon', 'Aquino'], ['Teresa', 'Lopez'],
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
function facultyId(programId: string, yearLevel: number): string {
  return `fac-${programId.replace('prog-', '')}-y${yearLevel}`;
}

function makeFaculty(): Faculty[] {
  const rows: Faculty[] = [];
  let assistant = 0;
  DIPLOMA_ROWS.forEach(([programId, , name], index) => {
    for (let yearLevel = 1; yearLevel <= 3; yearLevel += 1) {
      const [first, last] =
        yearLevel === 1
          ? TRAINER_NAMES[index]
          : ASSISTANT_NAMES[assistant++ % ASSISTANT_NAMES.length];
      rows.push({
        id: facultyId(programId, yearLevel),
        employeeId: `EMP-${1000 + index * 3 + yearLevel}`,
        firstName: first,
        lastName: last,
        diploma: name.replace('Diploma in ', ''),
        position: yearLevel === 1 ? 'Senior Trainer' : 'Trainer II',
        email: `${first.charAt(0).toLowerCase()}${last.toLowerCase()}@rtc-korphil.example.ph`,
        contactNumber: `0917-100-${String(1000 + index * 3 + yearLevel)}`,
        isActive: true,
        createdAt: T.created,
      });
    }
  });
  return rows;
}

function makeUsers(students: Student[]): User[] {
  const base = {
    status: 'APPROVED' as const,
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
      role: 'REGISTRAR',
      facultyId: null,
      studentId: null,
    },
  ];

  // One login per diploma, held by that diploma's Year 1 trainer.
  DIPLOMA_ROWS.forEach(([programId, code], index) => {
    const [first, last] = TRAINER_NAMES[index];
    users.push({
      ...base,
      id: `usr-trainer-${code.toLowerCase()}`,
      email: `${code.toLowerCase()}.trainer@rtc-korphil.example.ph`,
      password: 'trainer123',
      firstName: first,
      lastName: last,
      role: 'TRAINER',
      facultyId: facultyId(programId, 1),
      studentId: null,
    });
  });

  // The trainee login sits on the Sequential Enrollment trainee, because
  // theirs is the only record with finished, graded semester behind it — a
  // portal opened on a freshman would show an empty evaluation.
  const trainee =
    students.find((s) => s.programId === SEQUENTIAL_PROGRAM) ?? students[0];
  if (trainee) {
    users.push({
      ...base,
      id: 'usr-trainee',
      email: 'trainee@rtc-korphil.example.ph',
      password: 'trainee123',
      firstName: trainee.firstName,
      lastName: trainee.lastName,
      role: 'TRAINEE',
      facultyId: null,
      studentId: trainee.id,
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
];

interface StudentPlan {
  student: Student;
  programId: string;
  yearLevel: number;
  /** Carries the unresolved INC that blocks their Sequential Enrollment. */
  blocked: boolean;
}

function makeStudents(): StudentPlan[] {
  const plans: StudentPlan[] = [];
  let n = 0;

  {
    {
      for (const member of CAST) {
        const { first, middle, last, programId } = member;
        // Everyone in this dataset is a Year 1 trainee of the 2026-2027
        // intake; the two scenarios differ by which semester is open to
        // them, not by year level.
        const yearLevel = 1;
        const entryYear = 2026;
        n += 1;

        plans.push({
          programId,
          yearLevel,
          blocked: Boolean(member.blocked),
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

/** 1.00 highest, 3.00 the passing cutoff. No percentages anywhere. */
const GRADE_POOL = ['1.00', '1.25', '1.50', '1.75', '2.00', '2.25', '2.50', '2.75', '3.00'];

function gradeFor(seed: number): string {
  return GRADE_POOL[seed % GRADE_POOL.length];
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
  email: string;
  password: string;
  name: string;
  role: User['role'];
  detail: string;
}> = (() => {
  const students = makeStudents().map((p) => p.student);
  return makeUsers(students).map((user) => {
    const facultyRow = user.facultyId
      ? makeFaculty().find((f) => f.id === user.facultyId)
      : undefined;
    return {
      email: user.email,
      password: user.password,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      detail:
        user.role === 'TRAINER'
          ? (facultyRow?.diploma ?? 'Trainer')
          : user.role === 'TRAINEE'
            ? 'Continuing trainee · Sequential Enrollment demo'
            : 'Full registrar access',
    };
  });
})();

export function createSeedDatabase(): Database {
  const programs = makePrograms();
  const curricula = makeCurricula();
  const { subjects, programSubjects } = buildCurricula(
    programs.map((p) => ({ id: p.id, code: p.code })),
    curriculumIdFor,
    T.created,
  );
  const academicYears = makeAcademicYears();
  const semesters = makeSemesters();
  const faculty = makeFaculty();
  const sections = makeSections();

  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  /* ---- Schedules: one per subject, per diploma, per semester ---- */
  const classSchedules: ClassSchedule[] = [];
  const facultyAssignments: FacultyAssignment[] = [];
  let scheduleSeq = 0;

  for (const [programId, code] of DIPLOMA_ROWS) {
    for (const { yearLevel, semesterPeriod } of CURRICULUM_SLOTS) {
      const mappings = programSubjects.filter(
        (ps) =>
          ps.curriculumId === curriculumIdFor(programId) &&
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
          semesterId: semesterId(programId, yearLevel, semesterPeriod),
          subjectId: subject.id,
          sectionId: sectionId(programId, yearLevel),
          facultyId: facultyId(programId, yearLevel),
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
          facultyId: facultyId(programId, yearLevel),
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

  for (const plan of plans) {
    const isSequential = plan.programId === SEQUENTIAL_PROGRAM;
    // The freshman cohort sits in First Semester; the continuing cohort has
    // completed it. Either way only one enrolment is seeded per trainee.
    const period: SemesterPeriod = 'FIRST';
    const graded = isSequential;

    const semId = semesterId(plan.programId, plan.yearLevel, period);
    const mappings = programSubjects.filter(
      (ps) =>
        ps.curriculumId === curriculumIdFor(plan.programId) &&
        ps.yearLevel === plan.yearLevel &&
        ps.semesterPeriod === period,
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
      // find and genuinely blocks their Sequential Enrollment.
      const isInc = graded && incHolders.has(plan.student.id) && index === 0;
      const finalGrade = graded ? (isInc ? 'INC' : gradeFor(rowSeq)) : null;

      enrollmentSubjects.push({
        id: `es-${rowSeq}`,
        enrollmentId,
        subjectId: subject.id,
        classScheduleId: scheduleFor(semId, subject.id)?.id ?? null,
        units: subject.units,
        finalGrade,
        completionGrade: null,
        gradeStatus: !graded
          ? 'ENROLLED_NOT_GRADED'
          : isInc
            ? 'INC_PENDING'
            : Number(finalGrade) <= 3
              ? 'PASSED'
              : 'FAILED',
        gradedAt: graded ? T.sem1Graded : null,
        gradedByUserId: graded ? 'usr-registrar' : null,
      });
    });

    enrollments.push({
      id: enrollmentId,
      studentId: plan.student.id,
      semesterId: semId,
      enrolledAt: T.created,
      // The continuing cohort's First Semester is finished; the freshman
      // cohort is sitting in theirs right now.
      status: graded ? 'COMPLETED' : 'ENROLLED',
      totalUnits,
    });
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
