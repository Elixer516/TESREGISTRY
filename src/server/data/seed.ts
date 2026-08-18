/**
 * The seed dataset.
 *
 * Every screen in the app must be demonstrable straight after load, so this
 * file ships a complete, internally consistent centre: every enrollment points
 * at a real semester and schedule, every grade at a real enrollment subject,
 * every trainer login at a real faculty record.
 *
 * The academic year is split into two Semesters (1st / 2nd), and each
 * Semester is split into two Terms (1st / 2nd) — four grading periods per
 * year. `sem-2025-1-1` reads as "2025-2026, 1st Semester, 1st Term".
 */

import type {
  AcademicYear,
  AuditLog,
  ClassSchedule,
  Curriculum,
  DayCode,
  DocumentRequest,
  Enrollment,
  EnrollmentSubject,
  Faculty,
  FacultyAssignment,
  GradeCompletion,
  Notification,
  PreviousSchoolRecord,
  Program,
  ProgramSubject,
  Section,
  Semester,
  SemesterPeriod,
  Student,
  StudentStatus,
  Subject,
  Term,
  TorDocument,
  TrainerAvailability,
  User,
} from '@/types';
import type { Database } from '../repositories/db';
import { deriveGradeStatus } from '../services/grade-rules';

/* ------------------------------------------------------------------ */
/* Users — five demo logins, one per role, plus extra trainer accounts */
/* ------------------------------------------------------------------ */

export interface DemoAccount {
  role: User['role'];
  email: string;
  password: string;
  name: string;
}

/** Shown on the login screen. There is no signup backend to register against. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    role: 'REGISTRAR',
    email: 'registrar@rtc-korphil.example.ph',
    password: 'registrar123',
    name: 'Maria Santos',
  },
  {
    role: 'TRAINING_OFFICER',
    email: 'training@rtc-korphil.example.ph',
    password: 'training123',
    name: 'Jose Dela Cruz',
  },
  {
    role: 'TRAINER',
    email: 'trainer@rtc-korphil.example.ph',
    password: 'trainer123',
    name: 'Ramon Aquino',
  },
  {
    role: 'IT_ADMIN',
    email: 'itadmin@rtc-korphil.example.ph',
    password: 'itadmin123',
    name: 'Paolo Garcia',
  },
  {
    role: 'TRAINEE',
    email: 'trainee@rtc-korphil.example.ph',
    password: 'trainee123',
    name: 'Andrea Lim',
  },
] as const;

const T = {
  y2024: '2024-08-05T08:00:00.000Z',
  y2025: '2025-08-04T08:00:00.000Z',
  recent: '2025-09-12T02:30:00.000Z',
  recent2: '2025-09-18T06:15:00.000Z',
  recent3: '2025-09-22T01:05:00.000Z',
} as const;

function makeUsers(): User[] {
  const base = {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: T.y2024,
    updatedAt: T.y2024,
    studentId: null,
  };
  return [
    {
      ...base,
      id: 'usr-registrar',
      email: 'registrar@rtc-korphil.example.ph',
      password: 'registrar123',
      firstName: 'Maria',
      lastName: 'Santos',
      role: 'REGISTRAR',
      status: 'APPROVED',
      facultyId: null,
    },
    {
      ...base,
      id: 'usr-training',
      email: 'training@rtc-korphil.example.ph',
      password: 'training123',
      firstName: 'Jose',
      lastName: 'Dela Cruz',
      role: 'TRAINING_OFFICER',
      status: 'APPROVED',
      facultyId: null,
    },
    {
      ...base,
      id: 'usr-trainer',
      email: 'trainer@rtc-korphil.example.ph',
      password: 'trainer123',
      firstName: 'Ramon',
      lastName: 'Aquino',
      role: 'TRAINER',
      status: 'APPROVED',
      facultyId: 'fac-1',
    },
    {
      ...base,
      id: 'usr-trainer-2',
      email: 'lmendoza@rtc-korphil.example.ph',
      password: 'trainer123',
      firstName: 'Liza',
      lastName: 'Mendoza',
      role: 'TRAINER',
      status: 'APPROVED',
      facultyId: 'fac-2',
    },
    {
      ...base,
      id: 'usr-trainer-3',
      email: 'nbautista@rtc-korphil.example.ph',
      password: 'trainer123',
      firstName: 'Noel',
      lastName: 'Bautista',
      role: 'TRAINER',
      status: 'APPROVED',
      facultyId: 'fac-3',
    },
    {
      ...base,
      id: 'usr-trainer-4',
      email: 'creyes@rtc-korphil.example.ph',
      password: 'trainer123',
      firstName: 'Carmela',
      lastName: 'Reyes',
      role: 'TRAINER',
      status: 'PENDING',
      facultyId: 'fac-4',
    },
    {
      ...base,
      id: 'usr-admin',
      email: 'itadmin@rtc-korphil.example.ph',
      password: 'itadmin123',
      firstName: 'Paolo',
      lastName: 'Garcia',
      role: 'IT_ADMIN',
      status: 'APPROVED',
      facultyId: null,
    },
    {
      ...base,
      id: 'usr-trainee',
      email: 'trainee@rtc-korphil.example.ph',
      password: 'trainee123',
      firstName: 'Andrea',
      lastName: 'Lim',
      role: 'TRAINEE',
      status: 'APPROVED',
      facultyId: null,
      studentId: 'stu-1',
    },
    {
      ...base,
      id: 'usr-registrar-2',
      email: 'aclerk@rtc-korphil.example.ph',
      password: 'registrar123',
      firstName: 'Ana',
      lastName: 'Villareal',
      role: 'REGISTRAR',
      status: 'SUSPENDED',
      facultyId: null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Faculty — trainers, one department per Diploma program               */
/* ------------------------------------------------------------------ */

function makeFaculty(): Faculty[] {
  const rows: Array<[string, string, string, string, string, string, string]> = [
    ['fac-1', 'EMP-1001', 'Ramon', 'Aquino', 'Information Technology', 'Senior Trainer', '0917-100-1001'],
    ['fac-2', 'EMP-1002', 'Liza', 'Mendoza', 'Information Technology', 'Trainer II', '0917-100-1002'],
    ['fac-3', 'EMP-1003', 'Noel', 'Bautista', 'Industrial Automation and Mechatronics Technology', 'Trainer II', '0917-100-1003'],
    ['fac-4', 'EMP-1004', 'Carmela', 'Reyes', 'Hotel and Restaurant Technology', 'Trainer I', '0917-100-1004'],
    ['fac-5', 'EMP-1005', 'Arturo', 'Villanueva', 'Hotel and Restaurant Technology', 'Senior Trainer', '0917-100-1005'],
    ['fac-6', 'EMP-1006', 'Grace', 'Salazar', 'General Education', 'Instructor III', '0917-100-1006'],
    ['fac-7', 'EMP-1007', 'Dario', 'Fernandez', 'Automotive Technology', 'Senior Trainer', '0917-100-1007'],
    ['fac-8', 'EMP-1008', 'Isabel', 'Castro', 'Civil Engineering Technology', 'Trainer II', '0917-100-1008'],
    ['fac-9', 'EMP-1009', 'Manuel', 'Reyes', 'Heating, Ventilating, Air-Conditioning/Refrigeration Technology', 'Trainer I', '0917-100-1009'],
    ['fac-10', 'EMP-1010', 'Teresa', 'Lopez', 'Mechanical Engineering Technology', 'Senior Trainer', '0917-100-1010'],
    ['fac-11', 'EMP-1011', 'Bienvenido', 'Cruz', 'Agricultural Biosystems Engineering Technology', 'Trainer II', '0917-100-1011'],
    ['fac-12', 'EMP-1012', 'Rosario', 'Domingo', 'Information Technology', 'Trainer I', '0917-100-1012'],
  ];
  return rows.map(([id, employeeId, firstName, lastName, department, position, contactNumber]) => ({
    id,
    employeeId,
    firstName,
    lastName,
    department,
    position,
    email: `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}@rtc-korphil.example.ph`,
    contactNumber,
    isActive: true,
    createdAt: T.y2024,
  }));
}

/* ------------------------------------------------------------------ */
/* Programs and curricula — the centre's eight Diploma offerings        */
/* ------------------------------------------------------------------ */

function makePrograms(): Program[] {
  const rows: Array<[string, string, string, string]> = [
    ['prog-abet', 'ABET', 'Diploma in Agricultural Biosystems Engineering Technology', 'Farm power, agricultural structures, irrigation and post-harvest machinery.'],
    ['prog-auto', 'AUTO', 'Diploma in Automotive Technology', 'Engine systems, chassis, drivetrain and automotive electrical systems.'],
    ['prog-cet', 'CET', 'Diploma in Civil Engineering Technology', 'Construction materials, surveying, reinforced concrete and plumbing works.'],
    ['prog-hrt', 'HRT', 'Diploma in Hotel and Restaurant Technology', 'Front office, housekeeping, food and beverage service, and culinary arts.'],
    ['prog-hvacr', 'HVACR', 'Diploma in Heating, Ventilating, Air-Conditioning/Refrigeration Technology', 'Domestic, room and commercial refrigeration and air-conditioning servicing.'],
    ['prog-iamt', 'IAMT', 'Diploma in Industrial Automation and Mechatronics Technology', 'Electronics, programmable logic controllers, motor control and robotics.'],
    ['prog-it', 'IT', 'Diploma in Information Technology', 'Programming, networking, database management and web development.'],
    ['prog-met', 'MET', 'Diploma in Mechanical Engineering Technology', 'Machine shop practice, welding, machine tool operation and industrial maintenance.'],
  ];
  return rows.map(([id, code, name, description]) => ({
    id,
    code,
    name,
    description,
    yearsToComplete: 2,
    isActive: true,
    createdAt: T.y2024,
  }));
}

function makeCurricula(): Curriculum[] {
  const programIds = [
    'prog-abet',
    'prog-auto',
    'prog-cet',
    'prog-hrt',
    'prog-hvacr',
    'prog-iamt',
    'prog-it',
    'prog-met',
  ];
  return programIds.map((programId) => {
    const code = programId.replace('prog-', '').toUpperCase();
    return {
      id: `cur-${programId.replace('prog-', '')}`,
      programId,
      code: `${code}-2025`,
      name: `${code} Curriculum 2025`,
      effectiveYear: '2025-2026',
      isActive: true,
      createdAt: T.y2024,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Subjects — one record per subject, shared across curricula          */
/* ------------------------------------------------------------------ */

interface SubjectSeed {
  id: string;
  code: string;
  title: string;
  units: number;
  lec: number;
  lab: number;
}

const SUBJECT_SEEDS: SubjectSeed[] = [
  // Shared general education — mapped into every curriculum.
  { id: 'subj-ge101', code: 'GE101', title: 'Purposive Communication', units: 3, lec: 3, lab: 0 },
  { id: 'subj-ge102', code: 'GE102', title: 'Mathematics in the Modern World', units: 3, lec: 3, lab: 0 },

  // Information Technology
  { id: 'subj-it101', code: 'IT101', title: 'Introduction to Computing', units: 3, lec: 3, lab: 0 },
  { id: 'subj-it102', code: 'IT102', title: 'Computer Programming 1', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it103', code: 'IT103', title: 'Discrete Mathematics', units: 3, lec: 3, lab: 0 },
  { id: 'subj-it104', code: 'IT104', title: 'Computer Programming 2', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it105', code: 'IT105', title: 'Data Structures and Algorithms', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it106', code: 'IT106', title: 'Networking Fundamentals', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it107', code: 'IT107', title: 'Database Management Systems', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it108', code: 'IT108', title: 'Systems Analysis and Design', units: 3, lec: 3, lab: 0 },
  { id: 'subj-it201', code: 'IT201', title: 'Web Development', units: 4, lec: 2, lab: 6 },
  { id: 'subj-it202', code: 'IT202', title: 'Information Assurance and Security', units: 3, lec: 3, lab: 0 },

  // Automotive Technology
  { id: 'subj-auto101', code: 'AUTO101', title: 'Automotive Shop Practices and Safety', units: 4, lec: 1, lab: 9 },
  { id: 'subj-auto102', code: 'AUTO102', title: 'Engine Systems 1', units: 5, lec: 2, lab: 9 },
  { id: 'subj-auto103', code: 'AUTO103', title: 'Engine Systems 2', units: 5, lec: 2, lab: 9 },
  { id: 'subj-auto104', code: 'AUTO104', title: 'Chassis and Drivetrain Systems', units: 5, lec: 2, lab: 9 },
  { id: 'subj-auto105', code: 'AUTO105', title: 'Automotive Electrical Systems', units: 5, lec: 2, lab: 9 },
  { id: 'subj-auto106', code: 'AUTO106', title: 'Brake and Suspension Systems', units: 4, lec: 1, lab: 9 },

  // Civil Engineering Technology
  { id: 'subj-cet101', code: 'CET101', title: 'Construction Materials and Testing', units: 4, lec: 2, lab: 6 },
  { id: 'subj-cet102', code: 'CET102', title: 'Technical Drafting for Civil Works', units: 3, lec: 1, lab: 6 },
  { id: 'subj-cet103', code: 'CET103', title: 'Surveying 1', units: 5, lec: 2, lab: 9 },
  { id: 'subj-cet104', code: 'CET104', title: 'Reinforced Concrete Construction', units: 5, lec: 2, lab: 9 },
  { id: 'subj-cet105', code: 'CET105', title: 'Plumbing and Sanitary Works', units: 4, lec: 1, lab: 9 },

  // Hotel and Restaurant Technology
  { id: 'subj-hrt101', code: 'HRT101', title: 'Front Office Operations', units: 4, lec: 2, lab: 6 },
  { id: 'subj-hrt102', code: 'HRT102', title: 'Housekeeping Operations', units: 4, lec: 1, lab: 9 },
  { id: 'subj-hrt103', code: 'HRT103', title: 'Food and Beverage Service', units: 4, lec: 1, lab: 9 },
  { id: 'subj-hrt104', code: 'HRT104', title: 'Culinary Fundamentals', units: 5, lec: 1, lab: 12 },
  { id: 'subj-hrt105', code: 'HRT105', title: 'Bread and Pastry Production', units: 4, lec: 1, lab: 9 },

  // Heating, Ventilating, Air-Conditioning/Refrigeration Technology
  { id: 'subj-hvacr101', code: 'HVACR101', title: 'Basic Refrigeration Principles', units: 4, lec: 2, lab: 6 },
  { id: 'subj-hvacr102', code: 'HVACR102', title: 'Domestic Refrigeration Servicing', units: 5, lec: 2, lab: 9 },
  { id: 'subj-hvacr103', code: 'HVACR103', title: 'Room Air-Conditioning Servicing', units: 5, lec: 2, lab: 9 },
  { id: 'subj-hvacr104', code: 'HVACR104', title: 'Commercial Refrigeration Systems', units: 5, lec: 2, lab: 9 },

  // Industrial Automation and Mechatronics Technology
  { id: 'subj-iamt101', code: 'IAMT101', title: 'Electronics Fundamentals', units: 4, lec: 2, lab: 6 },
  { id: 'subj-iamt102', code: 'IAMT102', title: 'Programmable Logic Controllers 1', units: 5, lec: 2, lab: 9 },
  { id: 'subj-iamt103', code: 'IAMT103', title: 'Industrial Motor Control', units: 5, lec: 2, lab: 9 },
  { id: 'subj-iamt104', code: 'IAMT104', title: 'Robotics and Automation Systems', units: 5, lec: 2, lab: 9 },

  // Mechanical Engineering Technology
  { id: 'subj-met101', code: 'MET101', title: 'Machine Shop Theory', units: 4, lec: 2, lab: 6 },
  { id: 'subj-met102', code: 'MET102', title: 'Welding Technology 1', units: 5, lec: 1, lab: 12 },
  { id: 'subj-met103', code: 'MET103', title: 'Machine Tool Operations', units: 5, lec: 2, lab: 9 },
  { id: 'subj-met104', code: 'MET104', title: 'Industrial Maintenance and Mechanical Systems', units: 5, lec: 2, lab: 9 },

  // Agricultural Biosystems Engineering Technology
  { id: 'subj-abet101', code: 'ABET101', title: 'Farm Power and Machinery', units: 4, lec: 2, lab: 6 },
  { id: 'subj-abet102', code: 'ABET102', title: 'Agricultural Structures and Irrigation', units: 4, lec: 2, lab: 6 },
  { id: 'subj-abet103', code: 'ABET103', title: 'Post-Harvest Technology', units: 4, lec: 2, lab: 6 },
  { id: 'subj-abet104', code: 'ABET104', title: 'Agri-Machinery Fabrication and Repair', units: 5, lec: 2, lab: 9 },
];

function makeSubjects(): Subject[] {
  return SUBJECT_SEEDS.map((s) => ({
    id: s.id,
    code: s.code,
    title: s.title,
    description: `${s.title} — competency unit under the ${s.code.replace(/\d+/g, '')} cluster.`,
    units: s.units,
    lectureHours: s.lec,
    labHours: s.lab,
    isActive: true,
    createdAt: T.y2024,
  }));
}

export function subjectUnits(subjectId: string): number {
  const found = SUBJECT_SEEDS.find((s) => s.id === subjectId);
  return found ? found.units : 0;
}

/**
 * Curriculum mapping — (yearLevel, semesterPeriod, term). GE101/GE102 are
 * mapped into all eight curricula from the same two Subject records; they are
 * never duplicated.
 */
const PROGRAM_SUBJECT_SEEDS: Array<[string, string, number, SemesterPeriod, Term]> = [
  // General education — every program, Year 1, 1st Semester.
  ['cur-abet', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-abet', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-auto', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-auto', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-cet', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-cet', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-hrt', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-hrt', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-hvacr', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-hvacr', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-iamt', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-iamt', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-it', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-it', 'subj-ge102', 1, 'FIRST', 'SECOND'],
  ['cur-met', 'subj-ge101', 1, 'FIRST', 'FIRST'],
  ['cur-met', 'subj-ge102', 1, 'FIRST', 'SECOND'],

  // Information Technology
  ['cur-it', 'subj-it101', 1, 'FIRST', 'FIRST'],
  ['cur-it', 'subj-it102', 1, 'FIRST', 'FIRST'],
  ['cur-it', 'subj-it103', 1, 'FIRST', 'SECOND'],
  ['cur-it', 'subj-it104', 1, 'FIRST', 'SECOND'],
  ['cur-it', 'subj-it105', 1, 'SECOND', 'FIRST'],
  ['cur-it', 'subj-it106', 1, 'SECOND', 'FIRST'],
  ['cur-it', 'subj-it107', 1, 'SECOND', 'SECOND'],
  ['cur-it', 'subj-it108', 1, 'SECOND', 'SECOND'],
  ['cur-it', 'subj-it201', 2, 'FIRST', 'FIRST'],
  ['cur-it', 'subj-it202', 2, 'FIRST', 'FIRST'],

  // Automotive Technology
  ['cur-auto', 'subj-auto101', 1, 'FIRST', 'FIRST'],
  ['cur-auto', 'subj-auto102', 1, 'FIRST', 'FIRST'],
  ['cur-auto', 'subj-auto103', 1, 'FIRST', 'SECOND'],
  ['cur-auto', 'subj-auto104', 1, 'FIRST', 'SECOND'],
  ['cur-auto', 'subj-auto105', 1, 'SECOND', 'FIRST'],
  ['cur-auto', 'subj-auto106', 1, 'SECOND', 'SECOND'],

  // Civil Engineering Technology
  ['cur-cet', 'subj-cet101', 1, 'FIRST', 'FIRST'],
  ['cur-cet', 'subj-cet102', 1, 'FIRST', 'FIRST'],
  ['cur-cet', 'subj-cet103', 1, 'FIRST', 'SECOND'],
  ['cur-cet', 'subj-cet104', 1, 'SECOND', 'FIRST'],
  ['cur-cet', 'subj-cet105', 1, 'SECOND', 'SECOND'],

  // Hotel and Restaurant Technology
  ['cur-hrt', 'subj-hrt101', 1, 'FIRST', 'FIRST'],
  ['cur-hrt', 'subj-hrt102', 1, 'FIRST', 'FIRST'],
  ['cur-hrt', 'subj-hrt103', 1, 'FIRST', 'SECOND'],
  ['cur-hrt', 'subj-hrt104', 1, 'SECOND', 'FIRST'],
  ['cur-hrt', 'subj-hrt105', 1, 'SECOND', 'SECOND'],

  // HVACR
  ['cur-hvacr', 'subj-hvacr101', 1, 'FIRST', 'FIRST'],
  ['cur-hvacr', 'subj-hvacr102', 1, 'FIRST', 'SECOND'],
  ['cur-hvacr', 'subj-hvacr103', 1, 'SECOND', 'FIRST'],
  ['cur-hvacr', 'subj-hvacr104', 1, 'SECOND', 'SECOND'],

  // Industrial Automation and Mechatronics Technology
  ['cur-iamt', 'subj-iamt101', 1, 'FIRST', 'FIRST'],
  ['cur-iamt', 'subj-iamt102', 1, 'FIRST', 'SECOND'],
  ['cur-iamt', 'subj-iamt103', 1, 'SECOND', 'FIRST'],
  ['cur-iamt', 'subj-iamt104', 1, 'SECOND', 'SECOND'],

  // Mechanical Engineering Technology
  ['cur-met', 'subj-met101', 1, 'FIRST', 'FIRST'],
  ['cur-met', 'subj-met102', 1, 'FIRST', 'SECOND'],
  ['cur-met', 'subj-met103', 1, 'SECOND', 'FIRST'],
  ['cur-met', 'subj-met104', 1, 'SECOND', 'SECOND'],

  // Agricultural Biosystems Engineering Technology
  ['cur-abet', 'subj-abet101', 1, 'FIRST', 'FIRST'],
  ['cur-abet', 'subj-abet102', 1, 'FIRST', 'SECOND'],
  ['cur-abet', 'subj-abet103', 1, 'SECOND', 'FIRST'],
  ['cur-abet', 'subj-abet104', 1, 'SECOND', 'SECOND'],
];

function makeProgramSubjects(): ProgramSubject[] {
  return PROGRAM_SUBJECT_SEEDS.map(([curriculumId, subjectId, yearLevel, semesterPeriod, term], i) => ({
    id: `ps-${i + 1}`,
    curriculumId,
    subjectId,
    yearLevel,
    semesterPeriod,
    term,
    isRequired: true,
  }));
}

/* ------------------------------------------------------------------ */
/* Academic years and semesters                                        */
/* ------------------------------------------------------------------ */

function makeAcademicYears(): AcademicYear[] {
  return [
    { id: 'ay-2024', label: '2024-2025', startDate: '2024-08-01', endDate: '2025-07-31', isActive: false },
    { id: 'ay-2025', label: '2025-2026', startDate: '2025-08-01', endDate: '2026-07-31', isActive: true },
    { id: 'ay-2026', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-07-31', isActive: false },
  ];
}

/**
 * Four grading periods per year: 1st Semester (1st & 2nd Term), then
 * 2nd Semester (1st & 2nd Term). `sem-2025-1-1` is the one active term — it
 * is what gates grade encoding.
 */
function makeSemesters(): Semester[] {
  const spec: Array<[string, string, SemesterPeriod, Term, string, string, boolean]> = [
    ['sem-2024-1-1', 'ay-2024', 'FIRST', 'FIRST', '2024-08-05', '2024-10-04', false],
    ['sem-2024-1-2', 'ay-2024', 'FIRST', 'SECOND', '2024-10-07', '2024-12-20', false],
    ['sem-2024-2-1', 'ay-2024', 'SECOND', 'FIRST', '2025-01-06', '2025-03-07', false],
    ['sem-2024-2-2', 'ay-2024', 'SECOND', 'SECOND', '2025-03-10', '2025-05-16', false],

    ['sem-2025-1-1', 'ay-2025', 'FIRST', 'FIRST', '2025-08-04', '2025-10-03', true],
    ['sem-2025-1-2', 'ay-2025', 'FIRST', 'SECOND', '2025-10-06', '2025-12-19', false],
    ['sem-2025-2-1', 'ay-2025', 'SECOND', 'FIRST', '2026-01-05', '2026-03-06', false],
    ['sem-2025-2-2', 'ay-2025', 'SECOND', 'SECOND', '2026-03-09', '2026-05-15', false],

    ['sem-2026-1-1', 'ay-2026', 'FIRST', 'FIRST', '2026-08-03', '2026-10-02', false],
    ['sem-2026-1-2', 'ay-2026', 'FIRST', 'SECOND', '2026-10-05', '2026-12-18', false],
    ['sem-2026-2-1', 'ay-2026', 'SECOND', 'FIRST', '2027-01-04', '2027-03-05', false],
    ['sem-2026-2-2', 'ay-2026', 'SECOND', 'SECOND', '2027-03-08', '2027-05-14', false],
  ];
  return spec.map(([id, academicYearId, semesterPeriod, term, startDate, endDate, isActive]) => ({
    id,
    academicYearId,
    semesterPeriod,
    term,
    startDate,
    endDate,
    isActive,
  }));
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function makeSections(): Section[] {
  const spec: Array<[string, string, string, number, number]> = [
    ['sec-it1a', 'IT-1A', 'prog-it', 1, 35],
    ['sec-it2a', 'IT-2A', 'prog-it', 2, 30],
    ['sec-auto1a', 'AUTO-1A', 'prog-auto', 1, 25],
    ['sec-cet1a', 'CET-1A', 'prog-cet', 1, 25],
    ['sec-hrt1a', 'HRT-1A', 'prog-hrt', 1, 25],
    ['sec-hvacr1a', 'HVACR-1A', 'prog-hvacr', 1, 25],
    ['sec-iamt1a', 'IAMT-1A', 'prog-iamt', 1, 25],
    ['sec-met1a', 'MET-1A', 'prog-met', 1, 25],
    ['sec-abet1a', 'ABET-1A', 'prog-abet', 1, 25],
  ];
  return spec.map(([id, code, programId, yearLevel, capacity]) => ({
    id,
    code,
    programId,
    yearLevel,
    capacity,
    isActive: true,
    createdAt: T.y2024,
  }));
}

/* ------------------------------------------------------------------ */
/* Class schedules                                                     */
/* ------------------------------------------------------------------ */

interface ScheduleSeed {
  id: string;
  semesterId: string;
  subjectId: string;
  sectionId: string;
  facultyId: string;
  days: DayCode[];
  start: string;
  end: string;
  room: string;
  status: ClassSchedule['status'];
}

/**
 * The active term (sem-2025-1-1) carries the bulk of the published
 * schedules, one section at a time.
 *
 * `sch-it-102` and `sch-iamt-101` deliberately share Computer Lab 1 on TTh
 * with *adjacent* ranges (09:00–11:00 and 08:00–09:00). Because time ranges
 * are half-open they do not conflict today — nudge either one by a minute
 * and the room rule fires, which is exactly how the conflict modal gets
 * demonstrated.
 */
const SCHEDULE_SEEDS: ScheduleSeed[] = [
  // Information Technology — Year 1
  { id: 'sch-it-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-it1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '08:00', end: '09:00', room: 'Room 101', status: 'PUBLISHED' },
  { id: 'sch-it-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-it101', sectionId: 'sec-it1a', facultyId: 'fac-1', days: ['M', 'W', 'F'], start: '09:00', end: '10:00', room: 'Room 201', status: 'PUBLISHED' },
  { id: 'sch-it-102', semesterId: 'sem-2025-1-1', subjectId: 'subj-it102', sectionId: 'sec-it1a', facultyId: 'fac-2', days: ['T', 'Th'], start: '09:00', end: '11:00', room: 'Computer Lab 1', status: 'PUBLISHED' },

  // Information Technology — Year 2
  { id: 'sch-it2-201', semesterId: 'sem-2025-1-1', subjectId: 'subj-it201', sectionId: 'sec-it2a', facultyId: 'fac-1', days: ['M', 'W', 'F'], start: '10:00', end: '12:00', room: 'Computer Lab 2', status: 'PUBLISHED' },
  { id: 'sch-it2-202', semesterId: 'sem-2025-1-1', subjectId: 'subj-it202', sectionId: 'sec-it2a', facultyId: 'fac-12', days: ['T', 'Th'], start: '13:00', end: '15:00', room: 'Room 202', status: 'PUBLISHED' },

  // Automotive Technology
  { id: 'sch-auto-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-auto1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '10:00', end: '11:00', room: 'Room 101', status: 'PUBLISHED' },
  { id: 'sch-auto-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-auto101', sectionId: 'sec-auto1a', facultyId: 'fac-7', days: ['M', 'W', 'F'], start: '07:00', end: '09:00', room: 'Automotive Shop', status: 'PUBLISHED' },
  { id: 'sch-auto-102', semesterId: 'sem-2025-1-1', subjectId: 'subj-auto102', sectionId: 'sec-auto1a', facultyId: 'fac-7', days: ['T', 'Th'], start: '08:00', end: '10:00', room: 'Automotive Shop', status: 'PUBLISHED' },

  // Civil Engineering Technology
  { id: 'sch-cet-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-cet1a', facultyId: 'fac-6', days: ['T', 'Th'], start: '08:00', end: '09:00', room: 'Room 102', status: 'PUBLISHED' },
  { id: 'sch-cet-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-cet101', sectionId: 'sec-cet1a', facultyId: 'fac-8', days: ['M', 'W', 'F'], start: '08:00', end: '10:00', room: 'Civil Tech Lab', status: 'PUBLISHED' },
  { id: 'sch-cet-102', semesterId: 'sem-2025-1-1', subjectId: 'subj-cet102', sectionId: 'sec-cet1a', facultyId: 'fac-8', days: ['T', 'Th'], start: '10:00', end: '12:00', room: 'Drafting Room', status: 'PUBLISHED' },

  // Hotel and Restaurant Technology
  { id: 'sch-hrt-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-hrt1a', facultyId: 'fac-6', days: ['T', 'Th'], start: '10:00', end: '11:00', room: 'Room 103', status: 'PUBLISHED' },
  { id: 'sch-hrt-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-hrt101', sectionId: 'sec-hrt1a', facultyId: 'fac-4', days: ['M', 'W', 'F'], start: '08:00', end: '10:00', room: 'Front Office Lab', status: 'PUBLISHED' },
  { id: 'sch-hrt-102', semesterId: 'sem-2025-1-1', subjectId: 'subj-hrt102', sectionId: 'sec-hrt1a', facultyId: 'fac-5', days: ['T', 'Th'], start: '08:00', end: '11:00', room: 'Housekeeping Lab', status: 'PUBLISHED' },

  // HVACR
  { id: 'sch-hvacr-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-hvacr1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '13:00', end: '14:00', room: 'Room 104', status: 'PUBLISHED' },
  { id: 'sch-hvacr-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-hvacr101', sectionId: 'sec-hvacr1a', facultyId: 'fac-9', days: ['T', 'Th'], start: '08:00', end: '11:00', room: 'HVAC Lab', status: 'PUBLISHED' },

  // Industrial Automation and Mechatronics Technology
  { id: 'sch-iamt-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-iamt1a', facultyId: 'fac-6', days: ['T', 'Th'], start: '13:00', end: '14:00', room: 'Room 105', status: 'PUBLISHED' },
  { id: 'sch-iamt-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-iamt101', sectionId: 'sec-iamt1a', facultyId: 'fac-3', days: ['T', 'Th'], start: '08:00', end: '09:00', room: 'Computer Lab 1', status: 'PUBLISHED' },

  // Mechanical Engineering Technology
  { id: 'sch-met-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-met1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '14:00', end: '15:00', room: 'Room 106', status: 'PUBLISHED' },
  { id: 'sch-met-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-met101', sectionId: 'sec-met1a', facultyId: 'fac-10', days: ['T', 'Th'], start: '08:00', end: '11:00', room: 'Machine Shop', status: 'PUBLISHED' },

  // Agricultural Biosystems Engineering Technology
  { id: 'sch-abet-ge', semesterId: 'sem-2025-1-1', subjectId: 'subj-ge101', sectionId: 'sec-abet1a', facultyId: 'fac-6', days: ['T', 'Th'], start: '14:00', end: '15:00', room: 'Room 107', status: 'PUBLISHED' },
  { id: 'sch-abet-101', semesterId: 'sem-2025-1-1', subjectId: 'subj-abet101', sectionId: 'sec-abet1a', facultyId: 'fac-11', days: ['M', 'W', 'F'], start: '08:00', end: '11:00', room: 'Agri Mechanics Shop', status: 'PUBLISHED' },

  // Second-term subjects, still being planned — DRAFT rows are visible to
  // the Training Department only.
  { id: 'sch-it-103-draft', semesterId: 'sem-2025-1-1', subjectId: 'subj-it103', sectionId: 'sec-it1a', facultyId: 'fac-1', days: ['M', 'W', 'F'], start: '13:00', end: '14:00', room: 'Room 201', status: 'DRAFT' },
  { id: 'sch-hrt-103-draft', semesterId: 'sem-2025-1-1', subjectId: 'subj-hrt103', sectionId: 'sec-hrt1a', facultyId: 'fac-4', days: ['M', 'W', 'F'], start: '13:00', end: '15:00', room: 'F&B Lab', status: 'DRAFT' },

  // Historical terms (2024-2025, IT Year 1), so every past enrollment points
  // at a real schedule.
  { id: 'sch-h-ge1', semesterId: 'sem-2024-1-1', subjectId: 'subj-ge101', sectionId: 'sec-it1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '08:00', end: '09:00', room: 'Room 101', status: 'PUBLISHED' },
  { id: 'sch-h-it101', semesterId: 'sem-2024-1-1', subjectId: 'subj-it101', sectionId: 'sec-it1a', facultyId: 'fac-1', days: ['M', 'W', 'F'], start: '09:00', end: '10:00', room: 'Room 201', status: 'PUBLISHED' },
  { id: 'sch-h-it102', semesterId: 'sem-2024-1-1', subjectId: 'subj-it102', sectionId: 'sec-it1a', facultyId: 'fac-2', days: ['T', 'Th'], start: '09:00', end: '11:00', room: 'Computer Lab 1', status: 'PUBLISHED' },
  { id: 'sch-h-ge2', semesterId: 'sem-2024-1-2', subjectId: 'subj-ge102', sectionId: 'sec-it1a', facultyId: 'fac-6', days: ['M', 'W', 'F'], start: '08:00', end: '10:00', room: 'Room 101', status: 'PUBLISHED' },
  { id: 'sch-h-it103', semesterId: 'sem-2024-1-2', subjectId: 'subj-it103', sectionId: 'sec-it1a', facultyId: 'fac-1', days: ['T', 'Th'], start: '13:00', end: '15:00', room: 'Room 201', status: 'PUBLISHED' },
];

function makeClassSchedules(): ClassSchedule[] {
  return SCHEDULE_SEEDS.map((s) => ({
    id: s.id,
    semesterId: s.semesterId,
    subjectId: s.subjectId,
    sectionId: s.sectionId,
    facultyId: s.facultyId,
    days: [...s.days],
    startTime: s.start,
    endTime: s.end,
    room: s.room,
    status: s.status,
    createdAt: T.y2025,
    updatedAt: T.y2025,
  }));
}

function makeFacultyAssignments(): FacultyAssignment[] {
  return SCHEDULE_SEEDS.map((s, i) => ({
    id: `fa-${i + 1}`,
    facultyId: s.facultyId,
    classScheduleId: s.id,
    assignedAt: T.y2025,
  }));
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

interface StudentSeed {
  id: string;
  num: string;
  first: string;
  middle: string;
  last: string;
  sex: Student['sex'];
  programId: string;
  curriculumId: string | null;
  sectionId: string | null;
  yearLevel: number;
  status: StudentStatus;
  transferee?: boolean;
  rejectionReason?: string;
}

const STUDENT_SEEDS: StudentSeed[] = [
  // ---- Information Technology, Year 2 — full academic history
  { id: 'stu-1', num: '2024-00001', first: 'Andrea', middle: 'Cruz', last: 'Lim', sex: 'FEMALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it2a', yearLevel: 2, status: 'ACTIVE' },
  { id: 'stu-2', num: '2024-00002', first: 'Bryan', middle: 'Perez', last: 'Ocampo', sex: 'MALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it2a', yearLevel: 2, status: 'ACTIVE' },
  { id: 'stu-3', num: '2024-00003', first: 'Chloe', middle: 'Reyes', last: 'Navarro', sex: 'FEMALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it2a', yearLevel: 2, status: 'ACTIVE' },
  { id: 'stu-22', num: '2024-00022', first: 'Wilma', middle: 'Soriano', last: 'Tolentino', sex: 'FEMALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it2a', yearLevel: 2, status: 'ACTIVE', transferee: true },

  // ---- Information Technology, Year 1 — enrolled in the active term
  { id: 'stu-4', num: '2025-00004', first: 'Daniel', middle: 'Uy', last: 'Torres', sex: 'MALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-5', num: '2025-00005', first: 'Erika', middle: 'Lopez', last: 'Villamor', sex: 'FEMALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-23', num: '2025-00023', first: 'Marco', middle: 'Uy', last: 'Reyes', sex: 'MALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-24', num: '2025-00024', first: 'Bianca', middle: 'Cruz', last: 'Fernandez', sex: 'FEMALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Industrial Automation and Mechatronics Technology
  { id: 'stu-6', num: '2025-00006', first: 'Francis', middle: 'Yap', last: 'Delgado', sex: 'MALE', programId: 'prog-iamt', curriculumId: 'cur-iamt', sectionId: 'sec-iamt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-7', num: '2025-00007', first: 'Grace', middle: 'Uy', last: 'Antonio', sex: 'FEMALE', programId: 'prog-iamt', curriculumId: 'cur-iamt', sectionId: 'sec-iamt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-8', num: '2025-00008', first: 'Hannah', middle: 'Bello', last: 'Cruz', sex: 'FEMALE', programId: 'prog-iamt', curriculumId: 'cur-iamt', sectionId: 'sec-iamt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-34', num: '2025-00034', first: 'Julius', middle: 'Domingo', last: 'Ramirez', sex: 'MALE', programId: 'prog-iamt', curriculumId: 'cur-iamt', sectionId: 'sec-iamt1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Hotel and Restaurant Technology
  { id: 'stu-9', num: '2025-00009', first: 'Ivan', middle: 'Diaz', last: 'Marquez', sex: 'MALE', programId: 'prog-hrt', curriculumId: 'cur-hrt', sectionId: 'sec-hrt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-10', num: '2025-00010', first: 'Jasmine', middle: 'Cano', last: 'Ruiz', sex: 'FEMALE', programId: 'prog-hrt', curriculumId: 'cur-hrt', sectionId: 'sec-hrt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-31', num: '2025-00031', first: 'Kristine', middle: 'Bautista', last: 'Salonga', sex: 'FEMALE', programId: 'prog-hrt', curriculumId: 'cur-hrt', sectionId: 'sec-hrt1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-32', num: '2025-00032', first: 'Leo', middle: 'Mendoza', last: 'Aquino', sex: 'MALE', programId: 'prog-hrt', curriculumId: 'cur-hrt', sectionId: 'sec-hrt1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- HVACR
  { id: 'stu-11', num: '2025-00011', first: 'Kevin', middle: 'Rosal', last: 'Alcantara', sex: 'MALE', programId: 'prog-hvacr', curriculumId: 'cur-hvacr', sectionId: 'sec-hvacr1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-12', num: '2025-00012', first: 'Lorna', middle: 'Vega', last: 'Batac', sex: 'FEMALE', programId: 'prog-hvacr', curriculumId: 'cur-hvacr', sectionId: 'sec-hvacr1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-33', num: '2025-00033', first: 'Marvin', middle: 'Santos', last: 'Ilagan', sex: 'MALE', programId: 'prog-hvacr', curriculumId: 'cur-hvacr', sectionId: 'sec-hvacr1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Agricultural Biosystems Engineering Technology
  { id: 'stu-13', num: '2025-00013', first: 'Miguel', middle: 'Santos', last: 'Ferrer', sex: 'MALE', programId: 'prog-abet', curriculumId: 'cur-abet', sectionId: 'sec-abet1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-14', num: '2025-00014', first: 'Nadine', middle: 'Ilagan', last: 'Pascual', sex: 'FEMALE', programId: 'prog-abet', curriculumId: 'cur-abet', sectionId: 'sec-abet1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-38', num: '2025-00038', first: 'Orlando', middle: 'Villar', last: 'Mercado', sex: 'MALE', programId: 'prog-abet', curriculumId: 'cur-abet', sectionId: 'sec-abet1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Automotive Technology
  { id: 'stu-25', num: '2025-00025', first: 'Patrick', middle: 'Gomez', last: 'Ramos', sex: 'MALE', programId: 'prog-auto', curriculumId: 'cur-auto', sectionId: 'sec-auto1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-26', num: '2025-00026', first: 'Queenie', middle: 'Torres', last: 'Villaflor', sex: 'FEMALE', programId: 'prog-auto', curriculumId: 'cur-auto', sectionId: 'sec-auto1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-27', num: '2025-00027', first: 'Ronaldo', middle: 'Perez', last: 'Salazar', sex: 'MALE', programId: 'prog-auto', curriculumId: 'cur-auto', sectionId: 'sec-auto1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Civil Engineering Technology
  { id: 'stu-28', num: '2025-00028', first: 'Samantha', middle: 'Cruz', last: 'Bernardo', sex: 'FEMALE', programId: 'prog-cet', curriculumId: 'cur-cet', sectionId: 'sec-cet1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-29', num: '2025-00029', first: 'Timothy', middle: 'Aguilar', last: 'Navarro', sex: 'MALE', programId: 'prog-cet', curriculumId: 'cur-cet', sectionId: 'sec-cet1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-30', num: '2025-00030', first: 'Vanessa', middle: 'Reyes', last: 'Castillo', sex: 'FEMALE', programId: 'prog-cet', curriculumId: 'cur-cet', sectionId: 'sec-cet1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Mechanical Engineering Technology
  { id: 'stu-35', num: '2025-00035', first: 'Wendell', middle: 'Ocampo', last: 'Marasigan', sex: 'MALE', programId: 'prog-met', curriculumId: 'cur-met', sectionId: 'sec-met1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-36', num: '2025-00036', first: 'Ximena', middle: 'Torres', last: 'Villegas', sex: 'FEMALE', programId: 'prog-met', curriculumId: 'cur-met', sectionId: 'sec-met1a', yearLevel: 1, status: 'ACTIVE' },
  { id: 'stu-37', num: '2025-00037', first: 'Yusuf', middle: 'Alonzo', last: 'Rivera', sex: 'MALE', programId: 'prog-met', curriculumId: 'cur-met', sectionId: 'sec-met1a', yearLevel: 1, status: 'ACTIVE' },

  // ---- Other standings
  { id: 'stu-15', num: '2025-00015', first: 'Oscar', middle: 'Gomez', last: 'Guzman', sex: 'MALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: null, yearLevel: 1, status: 'APPROVED' },
  { id: 'stu-16', num: '2025-00016', first: 'Patricia', middle: 'Lim', last: 'Solis', sex: 'FEMALE', programId: 'prog-iamt', curriculumId: 'cur-iamt', sectionId: 'sec-iamt1a', yearLevel: 1, status: 'INACTIVE' },
  { id: 'stu-17', num: '2023-00017', first: 'Rafael', middle: 'Ong', last: 'Domingo', sex: 'MALE', programId: 'prog-it', curriculumId: 'cur-it', sectionId: 'sec-it2a', yearLevel: 2, status: 'GRADUATED' },
  { id: 'stu-18', num: '2025-00018', first: 'Sofia', middle: 'Mata', last: 'Cabrera', sex: 'FEMALE', programId: 'prog-hrt', curriculumId: 'cur-hrt', sectionId: 'sec-hrt1a', yearLevel: 1, status: 'DROPPED' },
  { id: 'stu-42', num: '2025-00042', first: 'Anthony', middle: 'Reyes', last: 'Bautista', sex: 'MALE', programId: 'prog-hvacr', curriculumId: 'cur-hvacr', sectionId: 'sec-hvacr1a', yearLevel: 1, status: 'INACTIVE' },
  { id: 'stu-43', num: '2025-00043', first: 'Bea', middle: 'Santos', last: 'Villareal', sex: 'FEMALE', programId: 'prog-cet', curriculumId: 'cur-cet', sectionId: 'sec-cet1a', yearLevel: 1, status: 'DROPPED' },

  // ---- Applications awaiting the registrar
  { id: 'stu-19', num: '2026-00019', first: 'Teodoro', middle: 'Rivera', last: 'Ramos', sex: 'MALE', programId: 'prog-it', curriculumId: null, sectionId: null, yearLevel: 1, status: 'PENDING' },
  { id: 'stu-20', num: '2026-00020', first: 'Ursula', middle: 'Panganiban', last: 'Bautista', sex: 'FEMALE', programId: 'prog-abet', curriculumId: null, sectionId: null, yearLevel: 1, status: 'PENDING' },
  { id: 'stu-39', num: '2026-00039', first: 'Camille', middle: 'Torres', last: 'Aguirre', sex: 'FEMALE', programId: 'prog-auto', curriculumId: null, sectionId: null, yearLevel: 1, status: 'PENDING' },
  { id: 'stu-40', num: '2026-00040', first: 'Diego', middle: 'Ramos', last: 'Villanueva', sex: 'MALE', programId: 'prog-cet', curriculumId: null, sectionId: null, yearLevel: 1, status: 'PENDING' },
  { id: 'stu-21', num: '2026-00021', first: 'Victor', middle: 'Salas', last: 'Enriquez', sex: 'MALE', programId: 'prog-iamt', curriculumId: null, sectionId: null, yearLevel: 1, status: 'REJECTED', rejectionReason: 'Incomplete admission requirements — missing Form 137 and birth certificate.' },
  { id: 'stu-41', num: '2026-00041', first: 'Ella', middle: 'Marquez', last: 'Domingo', sex: 'FEMALE', programId: 'prog-met', curriculumId: null, sectionId: null, yearLevel: 1, status: 'REJECTED', rejectionReason: 'Duplicate application already on file under a different student number.' },
];

function makeStudents(): Student[] {
  return STUDENT_SEEDS.map((s, i) => ({
    id: s.id,
    studentNumber: s.num,
    firstName: s.first,
    middleName: s.middle,
    lastName: s.last,
    email: `${s.first.toLowerCase()}.${s.last.toLowerCase()}@trainee.example.ph`,
    contactNumber: `0918-200-${String(1000 + i).padStart(4, '0')}`,
    address: `${100 + i} Sampaguita St., Talomo District, Davao City`,
    birthDate: `200${(i % 6) + 2}-0${(i % 9) + 1}-1${i % 9}`,
    sex: s.sex,
    programId: s.programId,
    curriculumId: s.curriculumId,
    sectionId: s.sectionId,
    yearLevel: s.yearLevel,
    status: s.status,
    isTransferee: s.transferee ?? false,
    rejectionReason: s.rejectionReason ?? null,
    approvedAt: s.status === 'PENDING' || s.status === 'REJECTED' ? null : T.y2024,
    createdAt: T.y2024,
    updatedAt: T.y2024,
  }));
}

/* ------------------------------------------------------------------ */
/* Enrollments and grades                                              */
/* ------------------------------------------------------------------ */

interface EnrollmentSeed {
  studentId: string;
  semesterId: string;
  status: Enrollment['status'];
  /** [subjectId, classScheduleId, finalGrade, completionGrade] */
  rows: Array<[string, string, string | null, string | null]>;
}

const ENROLLMENT_SEEDS: EnrollmentSeed[] = [
  // ---- Andrea Lim: clean record across three terms
  {
    studentId: 'stu-1', semesterId: 'sem-2024-1-1', status: 'COMPLETED',
    rows: [
      ['subj-ge101', 'sch-h-ge1', '1.50', null],
      ['subj-it101', 'sch-h-it101', '1.75', null],
      ['subj-it102', 'sch-h-it102', '2.00', null],
    ],
  },
  {
    studentId: 'stu-1', semesterId: 'sem-2024-1-2', status: 'COMPLETED',
    rows: [
      ['subj-ge102', 'sch-h-ge2', '2.25', null],
      ['subj-it103', 'sch-h-it103', '2.50', null],
    ],
  },
  {
    studentId: 'stu-1', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [['subj-it201', 'sch-it2-201', null, null]],
  },

  // ---- Bryan Ocampo: one failure, one exactly-at-the-cutoff pass
  {
    studentId: 'stu-2', semesterId: 'sem-2024-1-1', status: 'COMPLETED',
    rows: [
      ['subj-ge101', 'sch-h-ge1', '2.75', null],
      ['subj-it101', 'sch-h-it101', '2.00', null],
      ['subj-it102', 'sch-h-it102', '5.00', null],
    ],
  },
  {
    studentId: 'stu-2', semesterId: 'sem-2024-1-2', status: 'COMPLETED',
    rows: [
      ['subj-ge102', 'sch-h-ge2', '2.00', null],
      ['subj-it103', 'sch-h-it103', '3.00', null],
    ],
  },
  {
    studentId: 'stu-2', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [['subj-it201', 'sch-it2-201', null, null]],
  },

  // ---- Chloe Navarro: carries an UNRESOLVED INC — her 2024-1-1 GWA reads 0.000
  {
    studentId: 'stu-3', semesterId: 'sem-2024-1-1', status: 'COMPLETED',
    rows: [
      ['subj-ge101', 'sch-h-ge1', '1.75', null],
      ['subj-it101', 'sch-h-it101', '1.25', null],
      ['subj-it102', 'sch-h-it102', 'INC', null],
    ],
  },
  {
    studentId: 'stu-3', semesterId: 'sem-2024-1-2', status: 'COMPLETED',
    rows: [
      ['subj-ge102', 'sch-h-ge2', '1.50', null],
      ['subj-it103', 'sch-h-it103', '1.75', null],
    ],
  },
  {
    studentId: 'stu-3', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [['subj-it201', 'sch-it2-201', null, null]],
  },

  // ---- Wilma Tolentino: transferee whose INC was COMPLETED (INC is retained)
  {
    studentId: 'stu-22', semesterId: 'sem-2024-1-2', status: 'COMPLETED',
    rows: [
      ['subj-ge102', 'sch-h-ge2', '2.25', null],
      ['subj-it103', 'sch-h-it103', 'INC', '2.00'],
    ],
  },
  {
    studentId: 'stu-22', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [['subj-it201', 'sch-it2-201', null, null]],
  },

  // ---- IT Year 1, active term, awaiting encoding
  {
    studentId: 'stu-4', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-it-ge', null, null],
      ['subj-it101', 'sch-it-101', null, null],
      ['subj-it102', 'sch-it-102', null, null],
    ],
  },
  {
    studentId: 'stu-5', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-it-ge', '1.50', null],
      ['subj-it101', 'sch-it-101', null, null],
      ['subj-it102', 'sch-it-102', null, null],
    ],
  },
  {
    studentId: 'stu-23', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-it-ge', null, null],
      ['subj-it101', 'sch-it-101', null, null],
      ['subj-it102', 'sch-it-102', null, null],
    ],
  },
  {
    studentId: 'stu-24', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-it-ge', '2.00', null],
      ['subj-it101', 'sch-it-101', '1.75', null],
      ['subj-it102', 'sch-it-102', null, null],
    ],
  },

  // ---- Industrial Automation and Mechatronics Technology
  {
    studentId: 'stu-6', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-iamt-ge', null, null],
      ['subj-iamt101', 'sch-iamt-101', '1.75', null],
    ],
  },
  {
    studentId: 'stu-7', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-iamt-ge', null, null],
      ['subj-iamt101', 'sch-iamt-101', '2.25', null],
    ],
  },
  {
    studentId: 'stu-8', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-iamt-ge', null, null],
      ['subj-iamt101', 'sch-iamt-101', null, null],
    ],
  },
  {
    studentId: 'stu-34', semesterId: 'sem-2025-1-1', status: 'ENROLLED',
    rows: [
      ['subj-ge101', 'sch-iamt-ge', '2.50', null],
      ['subj-iamt101', 'sch-iamt-101', null, null],
    ],
  },

  // ---- Hotel and Restaurant Technology
  { studentId: 'stu-9', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hrt-ge', null, null], ['subj-hrt101', 'sch-hrt-101', '1.50', null], ['subj-hrt102', 'sch-hrt-102', null, null]] },
  { studentId: 'stu-10', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hrt-ge', null, null], ['subj-hrt101', 'sch-hrt-101', null, null], ['subj-hrt102', 'sch-hrt-102', null, null]] },
  { studentId: 'stu-31', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hrt-ge', null, null], ['subj-hrt101', 'sch-hrt-101', null, null], ['subj-hrt102', 'sch-hrt-102', '2.00', null]] },
  { studentId: 'stu-32', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hrt-ge', null, null], ['subj-hrt101', 'sch-hrt-101', null, null], ['subj-hrt102', 'sch-hrt-102', null, null]] },

  // ---- HVACR
  { studentId: 'stu-11', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hvacr-ge', null, null], ['subj-hvacr101', 'sch-hvacr-101', '2.00', null]] },
  { studentId: 'stu-12', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hvacr-ge', null, null], ['subj-hvacr101', 'sch-hvacr-101', null, null]] },
  { studentId: 'stu-33', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-hvacr-ge', '1.75', null], ['subj-hvacr101', 'sch-hvacr-101', null, null]] },

  // ---- Agricultural Biosystems Engineering Technology
  { studentId: 'stu-13', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-abet-ge', null, null], ['subj-abet101', 'sch-abet-101', '1.75', null]] },
  { studentId: 'stu-14', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-abet-ge', null, null], ['subj-abet101', 'sch-abet-101', null, null]] },
  { studentId: 'stu-38', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-abet-ge', null, null], ['subj-abet101', 'sch-abet-101', null, null]] },

  // ---- Automotive Technology
  { studentId: 'stu-25', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-auto-ge', null, null], ['subj-auto101', 'sch-auto-101', '1.50', null], ['subj-auto102', 'sch-auto-102', null, null]] },
  { studentId: 'stu-26', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-auto-ge', null, null], ['subj-auto101', 'sch-auto-101', null, null], ['subj-auto102', 'sch-auto-102', null, null]] },
  { studentId: 'stu-27', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-auto-ge', null, null], ['subj-auto101', 'sch-auto-101', null, null], ['subj-auto102', 'sch-auto-102', '2.25', null]] },

  // ---- Civil Engineering Technology
  { studentId: 'stu-28', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-cet-ge', null, null], ['subj-cet101', 'sch-cet-101', '1.75', null], ['subj-cet102', 'sch-cet-102', null, null]] },
  { studentId: 'stu-29', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-cet-ge', null, null], ['subj-cet101', 'sch-cet-101', null, null], ['subj-cet102', 'sch-cet-102', null, null]] },
  { studentId: 'stu-30', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-cet-ge', null, null], ['subj-cet101', 'sch-cet-101', null, null], ['subj-cet102', 'sch-cet-102', '2.00', null]] },

  // ---- Mechanical Engineering Technology
  { studentId: 'stu-35', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-met-ge', null, null], ['subj-met101', 'sch-met-101', '1.50', null]] },
  { studentId: 'stu-36', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-met-ge', null, null], ['subj-met101', 'sch-met-101', null, null]] },
  { studentId: 'stu-37', semesterId: 'sem-2025-1-1', status: 'ENROLLED', rows: [['subj-ge101', 'sch-met-ge', '2.25', null], ['subj-met101', 'sch-met-101', null, null]] },

  // ---- Graduated student, complete history
  {
    studentId: 'stu-17', semesterId: 'sem-2024-1-1', status: 'COMPLETED',
    rows: [
      ['subj-ge101', 'sch-h-ge1', '1.25', null],
      ['subj-it101', 'sch-h-it101', '1.50', null],
      ['subj-it102', 'sch-h-it102', '1.25', null],
    ],
  },
  {
    studentId: 'stu-17', semesterId: 'sem-2024-1-2', status: 'COMPLETED',
    rows: [
      ['subj-ge102', 'sch-h-ge2', '1.75', null],
      ['subj-it103', 'sch-h-it103', '1.50', null],
    ],
  },

  // ---- Dropped students
  { studentId: 'stu-18', semesterId: 'sem-2024-1-1', status: 'DROPPED', rows: [] },
  { studentId: 'stu-43', semesterId: 'sem-2024-1-1', status: 'DROPPED', rows: [] },
];

interface EnrollmentBundle {
  enrollments: Enrollment[];
  enrollmentSubjects: EnrollmentSubject[];
  gradeCompletions: GradeCompletion[];
}

function makeEnrollments(): EnrollmentBundle {
  const enrollments: Enrollment[] = [];
  const enrollmentSubjects: EnrollmentSubject[] = [];
  const gradeCompletions: GradeCompletion[] = [];

  ENROLLMENT_SEEDS.forEach((seed, index) => {
    const enrollmentId = `enr-${index + 1}`;
    let totalUnits = 0;

    seed.rows.forEach(([subjectId, scheduleId, finalGrade, completionGrade], rowIndex) => {
      // Units are copied from the subject AT ENROLLMENT TIME and then owned by
      // this row — later edits to the Subject never reach back into history.
      const units = subjectUnits(subjectId);
      totalUnits += units;
      const gradeStatus = deriveGradeStatus(finalGrade, completionGrade);
      enrollmentSubjects.push({
        id: `es-${index + 1}-${rowIndex + 1}`,
        enrollmentId,
        subjectId,
        classScheduleId: scheduleId,
        units,
        finalGrade,
        completionGrade,
        gradeStatus,
        gradedAt: finalGrade ? T.recent : null,
        gradedByUserId: finalGrade ? 'usr-registrar' : null,
      });
    });

    enrollments.push({
      id: enrollmentId,
      studentId: seed.studentId,
      semesterId: seed.semesterId,
      enrolledAt: seed.semesterId.startsWith('sem-2024') ? T.y2024 : T.y2025,
      status: seed.status,
      totalUnits,
    });
  });

  // Wilma's INC on IT103 was completed — the INC stays visible on the record
  // and the completion grade rides alongside it.
  const wilmaInc = enrollmentSubjects.find(
    (es) => es.subjectId === 'subj-it103' && es.finalGrade === 'INC' && es.completionGrade === '2.00',
  );
  if (wilmaInc) {
    gradeCompletions.push({
      id: 'gc-1',
      enrollmentSubjectId: wilmaInc.id,
      kind: 'COMPLETION',
      previousFinalGrade: 'INC',
      previousCompletionGrade: null,
      previousGradeStatus: 'INC_PENDING',
      newFinalGrade: 'INC',
      newCompletionGrade: '2.00',
      newGradeStatus: 'INC_RESOLVED',
      remarks: 'Submitted the outstanding laboratory requirement and sat the make-up exam.',
      processedByUserId: 'usr-registrar',
      processedAt: T.recent2,
    });
  }

  return { enrollments, enrollmentSubjects, gradeCompletions };
}

/* ------------------------------------------------------------------ */
/* Previous school records + an uploaded transcript                    */
/* ------------------------------------------------------------------ */

function makePreviousSchoolRecords(): PreviousSchoolRecord[] {
  const rows: Array<[string, string, string, number, string]> = [
    ['IT111', 'Introduction to Information Technology', '1.75', 3, '2023-2024'],
    ['MATH101', 'College Algebra', '2.00', 3, '2023-2024'],
    ['ENG101', 'Communication Arts 1', '1.50', 3, '2023-2024'],
    ['PE101', 'Physical Fitness', '1.25', 2, '2023-2024'],
  ];
  return rows.map(([courseCode, courseTitle, grade, units, schoolYear], i) => ({
    id: `psr-${i + 1}`,
    studentId: 'stu-22',
    schoolName: 'Davao Central College',
    schoolYear,
    courseCode,
    courseTitle,
    grade,
    units,
    createdAt: T.y2025,
  }));
}

/**
 * A tiny but structurally valid PDF, built at load time so the transcript
 * viewer, the download action and the magic-byte check all have something real
 * to work against without shipping a binary asset.
 */
function makeSampleTranscriptDataUrl(): string {
  const pdf = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 936]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj',
    '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    '5 0 obj<</Length 150>>stream',
    'BT /F1 14 Tf 60 860 Td (DAVAO CENTRAL COLLEGE) Tj ET',
    'BT /F1 11 Tf 60 830 Td (Official Transcript of Records - Wilma S. Tolentino) Tj ET',
    'BT /F1 9 Tf 60 800 Td (Scanned copy submitted to RTC KorPhil Davao.) Tj ET',
    'endstream endobj',
    'trailer<</Size 6/Root 1 0 R>>',
    '%%EOF',
  ].join('\n');

  let binary = '';
  for (let i = 0; i < pdf.length; i += 1) binary += pdf.charAt(i);
  return `data:application/pdf;base64,${btoa(binary)}`;
}

function makeTorDocuments(): TorDocument[] {
  const dataUrl = makeSampleTranscriptDataUrl();
  return [
    {
      id: 'tor-1',
      studentId: 'stu-22',
      fileName: 'tolentino-wilma-tor.pdf',
      fileSize: Math.round((dataUrl.length * 3) / 4),
      dataUrl,
      version: 1,
      uploadedByUserId: 'usr-registrar',
      uploadedAt: T.y2025,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Document requests                                                   */
/* ------------------------------------------------------------------ */

function makeDocumentRequests(): DocumentRequest[] {
  const spec: Array<[string, string, DocumentRequest['documentType'], DocumentRequest['status'], string, string]> = [
    ['dr-1', 'stu-1', 'CERT_ENROLLMENT', 'PENDING', 'Scholarship application', 'usr-trainee'],
    ['dr-2', 'stu-2', 'TOR', 'PROCESSING', 'Transfer to another institution', 'usr-registrar'],
    ['dr-3', 'stu-17', 'DIPLOMA', 'READY', 'Employment requirement', 'usr-registrar'],
    ['dr-4', 'stu-17', 'TOR', 'RELEASED', 'Board examination requirement', 'usr-registrar'],
    ['dr-5', 'stu-16', 'GOOD_MORAL', 'CANCELLED', 'Requested by mistake', 'usr-registrar'],
    ['dr-6', 'stu-1', 'GSA', 'PENDING', 'Latin honors evaluation', 'usr-trainee'],
    ['dr-7', 'stu-42', 'CERT_ENROLLMENT', 'PENDING', 'Company sponsorship requirement', 'usr-registrar'],
    ['dr-8', 'stu-13', 'GOOD_MORAL', 'PROCESSING', 'Apprenticeship application', 'usr-registrar'],
  ];
  return spec.map(([id, studentId, documentType, status, purpose, requestedByUserId]) => ({
    id,
    studentId,
    documentType,
    purpose,
    status,
    requestedByUserId,
    requestedAt: T.recent,
    updatedAt: T.recent2,
    releasedAt: status === 'RELEASED' ? T.recent3 : null,
    remarks: status === 'CANCELLED' ? 'Cancelled at the requester’s instruction.' : '',
  }));
}

/* ------------------------------------------------------------------ */
/* Trainer availability                                                */
/* ------------------------------------------------------------------ */

function makeTrainerAvailability(): TrainerAvailability[] {
  return [
    {
      id: 'av-1',
      facultyId: 'fac-1',
      semesterId: 'sem-2025-1-2',
      days: ['M', 'W', 'F'],
      startTime: '08:00',
      endTime: '12:00',
      notes: 'Prefer morning laboratory blocks. Unavailable Tuesdays for industry consultancy.',
      status: 'SUBMITTED',
      submittedAt: T.recent,
      reviewedByUserId: null,
      reviewedAt: null,
    },
    {
      id: 'av-2',
      facultyId: 'fac-2',
      semesterId: 'sem-2025-1-2',
      days: ['T', 'Th'],
      startTime: '13:00',
      endTime: '17:00',
      notes: 'Afternoons only.',
      status: 'INCORPORATED',
      submittedAt: T.y2025,
      reviewedByUserId: 'usr-training',
      reviewedAt: T.recent2,
    },
    {
      id: 'av-3',
      facultyId: 'fac-5',
      semesterId: 'sem-2025-1-2',
      days: ['M', 'T', 'W', 'Th', 'F'],
      startTime: '07:00',
      endTime: '11:00',
      notes: 'The kitchen and F&B labs run coolest in the morning — strongly prefer early slots.',
      status: 'SUBMITTED',
      submittedAt: T.recent2,
      reviewedByUserId: null,
      reviewedAt: null,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Audit trail + notifications                                         */
/* ------------------------------------------------------------------ */

function makeAuditLogs(): AuditLog[] {
  const spec: Array<[AuditLog['action'], string, string, string, string, string]> = [
    ['LOGIN_SUCCESS', 'User', 'usr-registrar', 'Maria Santos (Registrar)', 'Signed in from the registrar workstation.', T.recent3],
    ['LOGIN_FAILED', 'User', 'usr-registrar-2', 'aclerk@rtc-korphil.example.ph', 'Incorrect password supplied.', T.recent3],
    ['USER_SUSPENDED', 'User', 'usr-registrar-2', 'Paolo Garcia (IT Administrator)', 'Account suspended pending HR clearance.', T.recent2],
    ['STUDENT_APPROVED', 'Student', 'stu-14', 'Maria Santos (Registrar)', 'Application approved and ABET curriculum assigned.', T.recent2],
    ['ENROLLMENT_CREATED', 'Enrollment', 'enr-4', 'Maria Santos (Registrar)', 'Enrolled for 2025-2026 · 1st Semester · 1st Term.', T.recent2],
    ['GRADE_ENCODED', 'EnrollmentSubject', 'es-13-2', 'Maria Santos (Registrar)', 'Grade 1.50 encoded for HRT101.', T.recent],
    ['INC_COMPLETED', 'EnrollmentSubject', 'es-9-2', 'Maria Santos (Registrar)', 'INC completed with 2.00 — original INC retained.', T.recent2],
    ['SCHEDULE_PUBLISHED', 'ClassSchedule', 'sch-hrt-101', 'Jose Dela Cruz (Training Department)', 'HRT101 for HRT-1A published.', T.y2025],
    ['SCHEDULE_CONFLICT_BLOCKED', 'ClassSchedule', 'sch-iamt-101', 'Jose Dela Cruz (Training Department)', 'Save blocked — Computer Lab 1 already booked at that time.', T.y2025],
    ['DOCUMENT_STATUS_CHANGED', 'DocumentRequest', 'dr-3', 'Maria Santos (Registrar)', 'Diploma marked Ready for Release.', T.recent2],
    ['DOCUMENT_GENERATED', 'GeneratedDocument', 'dr-4', 'Maria Santos (Registrar)', 'Transcript of Records generated and released.', T.recent3],
    ['TOR_UPLOADED', 'TorDocument', 'tor-1', 'Maria Santos (Registrar)', 'Previous-school transcript uploaded for Wilma Tolentino.', T.y2025],
    ['AVAILABILITY_SUBMITTED', 'TrainerAvailability', 'av-1', 'Ramon Aquino (Trainer)', 'Availability submitted for 2025-2026 · 1st Semester · 2nd Term.', T.recent],
    ['AVAILABILITY_INCORPORATED', 'TrainerAvailability', 'av-2', 'Jose Dela Cruz (Training Department)', 'Availability marked as incorporated into planning.', T.recent2],
    ['USER_CREATED', 'User', 'usr-trainer-4', 'Paolo Garcia (IT Administrator)', 'Trainer account created and linked to EMP-1004.', T.recent],
  ];
  return spec.map(([action, recordType, recordId, userLabel, detail, createdAt], i) => ({
    id: `aud-${i + 1}`,
    action,
    recordType,
    recordId,
    userId: null,
    userLabel,
    before: null,
    after: null,
    detail,
    createdAt,
  }));
}

function makeNotifications(): Notification[] {
  const spec: Array<[string, Notification['category'], string, string, string | null, boolean]> = [
    ['usr-trainee', 'SCHEDULE', 'Class schedule published', 'Your schedule for 2025-2026 · 1st Semester · 1st Term is now available.', '/portal/schedule', false],
    ['usr-trainee', 'DOCUMENT', 'Request received', 'Your Certificate of Enrollment request is pending review.', '/portal/requests', false],
    ['usr-registrar', 'DOCUMENT', 'New document request', 'Andrea Lim requested a Certificate of Enrollment.', '/documents', false],
    ['usr-registrar', 'DOCUMENT', 'Request ready', 'Rafael Domingo’s Diploma is ready for release.', '/documents', true],
    ['usr-trainer', 'AVAILABILITY', 'Availability received', 'Your availability for 2025-2026 · 1st Semester · 2nd Term was submitted.', '/availability', false],
    ['usr-training', 'AVAILABILITY', 'New availability submission', 'Arturo Villanueva submitted availability for review.', '/availability', false],
    ['usr-admin', 'ACCOUNT', 'Account awaiting review', 'Carmela Reyes registered and is pending approval.', '/users', false],
  ];
  return spec.map(([userId, category, title, body, link, isRead], i) => ({
    id: `ntf-${i + 1}`,
    userId,
    title,
    body,
    category,
    link,
    isRead,
    createdAt: i % 2 === 0 ? T.recent3 : T.recent2,
  }));
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

export function createSeedDatabase(): Database {
  const { enrollments, enrollmentSubjects, gradeCompletions } = makeEnrollments();

  return {
    users: makeUsers(),
    faculty: makeFaculty(),
    students: makeStudents(),
    programs: makePrograms(),
    curricula: makeCurricula(),
    subjects: makeSubjects(),
    programSubjects: makeProgramSubjects(),
    academicYears: makeAcademicYears(),
    semesters: makeSemesters(),
    sections: makeSections(),
    classSchedules: makeClassSchedules(),
    facultyAssignments: makeFacultyAssignments(),
    enrollments,
    enrollmentSubjects,
    gradeCompletions,
    previousSchoolRecords: makePreviousSchoolRecords(),
    torDocuments: makeTorDocuments(),
    documentRequests: makeDocumentRequests(),
    generatedDocuments: [],
    auditLogs: makeAuditLogs(),
    trainerAvailability: makeTrainerAvailability(),
    notifications: makeNotifications(),
  };
}
