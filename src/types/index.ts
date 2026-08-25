/**
 * Domain types for RegiStream.
 *
 * One definition per concept. Both halves of the app — the simulated backend in
 * `src/server` and the React frontend — import from here. Status fields are
 * union types, never loose strings.
 */

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export type Role = 'REGISTRAR' | 'TRAINEE';

export const ALL_ROLES: readonly Role[] = ['REGISTRAR', 'TRAINEE'] as const;

export const ROLE_LABELS: Record<Role, string> = {
  REGISTRAR: 'Registrar',
  TRAINEE: 'Trainee',
};

/** Staff roles — everyone who uses the main application shell. */
export const STAFF_ROLES: readonly Role[] = ['REGISTRAR'] as const;

/* ------------------------------------------------------------------ */
/* Status unions                                                       */
/* ------------------------------------------------------------------ */

export type StudentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'GRADUATED'
  | 'DROPPED';

export type UserAccountStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'DEACTIVATED';

export type GradeStatus =
  | 'ENROLLED_NOT_GRADED'
  | 'PASSED'
  | 'FAILED'
  | 'INC_PENDING'
  | 'INC_RESOLVED';

export type RequestStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'RELEASED' | 'CANCELLED';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED';

export type DocumentType =
  | 'TOR'
  | 'GOOD_MORAL'
  | 'CERT_ENROLLMENT'
  | 'DIPLOMA'
  | 'SPECIAL_ORDER'
  | 'GSA';

/**
 * The academic year is split into two Semesters, and each Semester is split
 * into two Terms — "1st Semester, 1st Term" through "2nd Semester, 2nd Term".
 * Nothing here is a loose string: a grading period is always the pair
 * (SemesterPeriod, Term).
 */
export type SemesterPeriod = 'FIRST' | 'SECOND';

export type Term = 'FIRST' | 'SECOND';

export type EnrollmentStatus = 'ENROLLED' | 'COMPLETED' | 'DROPPED';

/* ------------------------------------------------------------------ */
/* Student status subsets — three lists, deliberately NOT interchangeable */
/* ------------------------------------------------------------------ */

/** Every status a student record may hold (7). Used for display/legend only. */
export const ALL_STUDENT_STATUSES: readonly StudentStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ACTIVE',
  'INACTIVE',
  'GRADUATED',
  'DROPPED',
] as const;

/**
 * Students who have any standing with the centre — i.e. they got past the
 * application gate. Document search draws from this list, so a PENDING or
 * REJECTED applicant can never be issued a document.
 */
export const ANY_STANDING_STATUSES: readonly StudentStatus[] = [
  'APPROVED',
  'ACTIVE',
  'INACTIVE',
  'GRADUATED',
  'DROPPED',
] as const;

/**
 * Statuses a registrar may assign directly from the edit form. PENDING and
 * REJECTED are governed by the approve/reject actions only — they carry side
 * effects (curriculum assignment, audit trail) that a plain status edit skips.
 */
export const SETTABLE_STATUSES: readonly StudentStatus[] = [
  'APPROVED',
  'ACTIVE',
  'INACTIVE',
  'GRADUATED',
  'DROPPED',
] as const;

/* ------------------------------------------------------------------ */
/* Human-readable labels                                               */
/* ------------------------------------------------------------------ */

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  GRADUATED: 'Graduated',
  DROPPED: 'Dropped',
};

export const ACCOUNT_STATUS_LABELS: Record<UserAccountStatus, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
};

export const GRADE_STATUS_LABELS: Record<GradeStatus, string> = {
  ENROLLED_NOT_GRADED: 'Not Yet Graded',
  PASSED: 'Passed',
  FAILED: 'Failed',
  INC_PENDING: 'INC — Unresolved',
  INC_RESOLVED: 'INC — Resolved',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  READY: 'Ready for Release',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  TOR: 'Transcript of Records',
  GOOD_MORAL: 'Certificate of Good Moral Character',
  CERT_ENROLLMENT: 'Certificate of Enrollment',
  DIPLOMA: 'Diploma',
  SPECIAL_ORDER: 'Special Order',
  GSA: 'General Scholastic Average (GSA)',
};

export const SEMESTER_PERIOD_LABELS: Record<SemesterPeriod, string> = {
  FIRST: '1st Semester',
  SECOND: '2nd Semester',
};

export const ALL_SEMESTER_PERIODS: readonly SemesterPeriod[] = ['FIRST', 'SECOND'] as const;

export const TERM_LABELS: Record<Term, string> = {
  FIRST: '1st Term',
  SECOND: '2nd Term',
};

export const TERM_SHORT_LABELS: Record<Term, string> = {
  FIRST: 'Term 1',
  SECOND: 'Term 2',
};

export const ALL_TERMS: readonly Term[] = ['FIRST', 'SECOND'] as const;

/** "1st Semester · 1st Term" — the one composed label every screen shows. */
export function semesterPeriodLabel(semesterPeriod: SemesterPeriod, term: Term): string {
  return `${SEMESTER_PERIOD_LABELS[semesterPeriod]} · ${TERM_LABELS[term]}`;
}

export const ALL_DOCUMENT_TYPES: readonly DocumentType[] = [
  'TOR',
  'GOOD_MORAL',
  'CERT_ENROLLMENT',
  'DIPLOMA',
  'SPECIAL_ORDER',
  'GSA',
] as const;

export const ALL_REQUEST_STATUSES: readonly RequestStatus[] = [
  'PENDING',
  'PROCESSING',
  'READY',
  'RELEASED',
  'CANCELLED',
] as const;

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

export type DayCode = 'M' | 'T' | 'W' | 'Th' | 'F' | 'S' | 'Su';

export const ALL_DAYS: readonly DayCode[] = ['M', 'T', 'W', 'Th', 'F', 'S', 'Su'] as const;

export const DAY_LABELS: Record<DayCode, string> = {
  M: 'Monday',
  T: 'Tuesday',
  W: 'Wednesday',
  Th: 'Thursday',
  F: 'Friday',
  S: 'Saturday',
  Su: 'Sunday',
};

export const DAY_SHORT_LABELS: Record<DayCode, string> = {
  M: 'Mon',
  T: 'Tue',
  W: 'Wed',
  Th: 'Thu',
  F: 'Fri',
  S: 'Sat',
  Su: 'Sun',
};

/* ------------------------------------------------------------------ */
/* Entities                                                            */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  email: string;
  /** Plaintext here only because this build is an offline prototype with no backend. */
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserAccountStatus;
  /** Set for TRAINER accounts — one login per faculty record, enforced. */
  facultyId: string | null;
  /** Set for TRAINEE accounts. */
  studentId: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A User with the password stripped — the only shape the frontend ever sees. */
export type PublicUser = Omit<User, 'password'>;

export interface Faculty {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  email: string;
  contactNumber: string;
  isActive: boolean;
  createdAt: string;
}

export interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  /** Suffix such as Jr., III — kept apart from lastName so it sorts and prints cleanly. */
  extensionName: string;
  email: string;
  contactNumber: string;
  address: string;
  birthDate: string;
  birthPlace: string;
  sex: 'MALE' | 'FEMALE';
  civilStatus: string;
  nationality: string;
  highestEducation: string;
  /** TESDA "Classification of Clients" — e.g. Student, TVET Trainers, IP/CC. */
  classification: string;
  scholarshipType: string;
  /** Government learner ID — distinct from the centre's own studentNumber. */
  learnerId: string;
  secondarySchool: string;
  /** Year the secondary school was last attended, as free text (e.g. "2022"). */
  secondarySchoolYearAttended: string;
  /** What admission was based on — e.g. "Form 137", "Honorable Dismissal from X". */
  basisOfAdmission: string;
  dateAdmitted: string;
  nstpSerialNo: string;
  /** Set once, alongside a Special Order No., when the student graduates. */
  graduatedAt: string | null;
  specialOrderNo: string | null;
  programId: string;
  /** Assigned at approval time — required by the approve action. */
  curriculumId: string | null;
  sectionId: string | null;
  yearLevel: number;
  status: StudentStatus;
  isTransferee: boolean;
  rejectionReason: string | null;
  approvedAt: string | null;
  /** Set by a password-confirmed archive action. Hides the record without deleting history. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  description: string;
  yearsToComplete: number;
  isActive: boolean;
  createdAt: string;
}

export interface Curriculum {
  id: string;
  programId: string;
  code: string;
  name: string;
  effectiveYear: string;
  isActive: boolean;
  createdAt: string;
}

/** One Subject record shared across curricula — never duplicated per program. */
export interface Subject {
  id: string;
  code: string;
  title: string;
  description: string;
  units: number;
  lectureHours: number;
  labHours: number;
  isActive: boolean;
  createdAt: string;
}

/** Maps a Subject into a Curriculum at a given year level, semester and term. */
export interface ProgramSubject {
  id: string;
  curriculumId: string;
  subjectId: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  term: Term;
  isRequired: boolean;
}

export interface AcademicYear {
  id: string;
  /** e.g. "2025-2026" */
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/**
 * One grading period: a (semesterPeriod, term) pair within an academic year.
 * Despite the name, this is the "Term" the rest of the app grades against —
 * kept as `Semester` since that is what every foreign key (`semesterId`)
 * already points at.
 */
export interface Semester {
  id: string;
  academicYearId: string;
  semesterPeriod: SemesterPeriod;
  term: Term;
  startDate: string;
  endDate: string;
  /** Gates grade encoding — only an active term accepts grades. */
  isActive: boolean;
}

export interface Section {
  id: string;
  code: string;
  programId: string;
  yearLevel: number;
  capacity: number;
  isActive: boolean;
  createdAt: string;
}

export interface ClassSchedule {
  id: string;
  semesterId: string;
  subjectId: string;
  sectionId: string;
  facultyId: string | null;
  /** Canonical day codes, already parsed — `TTh` is stored as ['T','Th']. */
  days: DayCode[];
  /** Normalised to HH:MM on save. */
  startTime: string;
  endTime: string;
  room: string;
  status: ScheduleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FacultyAssignment {
  id: string;
  facultyId: string;
  classScheduleId: string;
  assignedAt: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  semesterId: string;
  enrolledAt: string;
  status: EnrollmentStatus;
  /** Sum of the units copied onto the rows at enrollment time. */
  totalUnits: number;
}

export interface EnrollmentSubject {
  id: string;
  enrollmentId: string;
  subjectId: string;
  classScheduleId: string | null;
  /** Copied from the Subject at enrollment time; never re-read afterwards. */
  units: number;
  /** "1.00".."5.00" or "INC" or null when not yet graded. */
  finalGrade: string | null;
  /** Set by an INC *completion* — the INC stays on the record. */
  completionGrade: string | null;
  gradeStatus: GradeStatus;
  gradedAt: string | null;
  gradedByUserId: string | null;
}

export interface GradeCompletion {
  id: string;
  enrollmentSubjectId: string;
  /** COMPLETION keeps finalGrade = INC; CORRECTION replaces it outright. */
  kind: 'COMPLETION' | 'CORRECTION';
  previousFinalGrade: string | null;
  previousCompletionGrade: string | null;
  previousGradeStatus: GradeStatus;
  newFinalGrade: string | null;
  newCompletionGrade: string | null;
  newGradeStatus: GradeStatus;
  remarks: string;
  processedByUserId: string;
  processedAt: string;
}

export interface PreviousSchoolRecord {
  id: string;
  studentId: string;
  schoolName: string;
  schoolYear: string;
  courseCode: string;
  courseTitle: string;
  grade: string;
  units: number;
  createdAt: string;
}

export interface TorDocument {
  id: string;
  studentId: string;
  fileName: string;
  fileSize: number;
  /** Data URL held in memory — no storage backend. */
  dataUrl: string;
  version: number;
  uploadedByUserId: string;
  uploadedAt: string;
}

export interface DocumentRequest {
  id: string;
  studentId: string;
  documentType: DocumentType;
  purpose: string;
  status: RequestStatus;
  requestedByUserId: string;
  requestedAt: string;
  updatedAt: string;
  releasedAt: string | null;
  remarks: string;
}

export interface GeneratedDocument {
  id: string;
  documentRequestId: string | null;
  studentId: string;
  documentType: DocumentType;
  /** Frozen copy of exactly the data used to render — never re-derived. */
  snapshot: DocumentSnapshot;
  generatedByUserId: string;
  generatedAt: string;
  serialNumber: string;
}

export interface DocumentSnapshotRow {
  courseCode: string;
  courseTitle: string;
  units: number;
  grade: string;
  /** Set once an INC is resolved — kept separate so a TOR can show both columns. */
  completionGrade: string;
  remarks: string;
  source: 'REGISTRAR' | 'PREVIOUS_SCHOOL';
}

export interface DocumentSnapshotTermGroup {
  academicYearLabel: string;
  /** Composed "1st Semester · 1st Term" — a frozen snapshot needs no enum. */
  periodLabel: string;
  rows: DocumentSnapshotRow[];
  termUnits: number;
  termGwa: string;
}

export interface DocumentSnapshot {
  studentNumber: string;
  studentName: string;
  programCode: string;
  programName: string;
  curriculumName: string;
  sex: string;
  birthDate: string;
  address: string;
  status: StudentStatus;
  groups: DocumentSnapshotTermGroup[];
  totalUnits: number;
  overallGwa: string;
  hasUnresolvedInc: boolean;
  generatedOn: string;
  notes: string[];
  /** TOR-specific fields — populated for every snapshot, only rendered by the TOR layout. */
  learnerId: string;
  birthPlace: string;
  secondarySchool: string;
  secondarySchoolYearAttended: string;
  basisOfAdmission: string;
  dateAdmitted: string;
  nstpSerialNo: string;
  graduatedOn: string | null;
  specialOrderNo: string | null;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  recordType: string;
  recordId: string;
  userId: string | null;
  userLabel: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  detail: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: 'SCHEDULE' | 'DOCUMENT' | 'AVAILABILITY' | 'ACCOUNT' | 'GENERAL';
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Audit actions — machine identifier + readable label                 */
/* ------------------------------------------------------------------ */

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'Successful Login',
  LOGIN_FAILED: 'Failed Login',
  LOGOUT: 'Logout',
  ACCOUNT_LOCKED: 'Account Locked',
  USER_CREATED: 'User Created',
  USER_APPROVED: 'User Approved',
  USER_REJECTED: 'User Rejected',
  USER_SUSPENDED: 'User Suspended',
  USER_DEACTIVATED: 'User Deactivated',
  USER_REACTIVATED: 'User Reactivated',
  USER_PASSWORD_RESET: 'Password Reset',
  STUDENT_CREATED: 'Student Created',
  STUDENT_IMPORTED: 'Students Imported',
  STUDENT_APPROVED: 'Student Approved',
  STUDENT_REJECTED: 'Student Rejected',
  STUDENT_UPDATED: 'Student Updated',
  STUDENT_STATUS_CHANGED: 'Student Status Changed',
  STUDENT_ARCHIVED: 'Student Archived',
  STUDENT_RESTORED: 'Student Restored',
  ENROLLMENT_CREATED: 'Enrollment Created',
  ENROLLMENT_DROPPED: 'Enrollment Dropped',
  GRADE_ENCODED: 'Grade Encoded',
  GRADE_BULK_ENCODED: 'Grades Encoded (Batch)',
  INC_COMPLETED: 'INC Completed',
  INC_CORRECTED: 'INC Corrected',
  PROGRAM_CREATED: 'Program Created',
  PROGRAM_UPDATED: 'Program Updated',
  PROGRAM_DEACTIVATED: 'Program Deactivated',
  CURRICULUM_CREATED: 'Curriculum Created',
  CURRICULUM_UPDATED: 'Curriculum Updated',
  SUBJECT_CREATED: 'Subject Created',
  SUBJECT_UPDATED: 'Subject Updated',
  SUBJECT_MAPPED: 'Subject Mapped to Curriculum',
  SUBJECT_UNMAPPED: 'Subject Removed from Curriculum',
  SECTION_CREATED: 'Section Created',
  SECTION_UPDATED: 'Section Updated',
  SCHEDULE_CREATED: 'Schedule Created',
  SCHEDULE_UPDATED: 'Schedule Updated',
  SCHEDULE_PUBLISHED: 'Schedule Published',
  SCHEDULE_UNPUBLISHED: 'Schedule Unpublished',
  SCHEDULE_DELETED: 'Schedule Deleted',
  SCHEDULE_CONFLICT_BLOCKED: 'Schedule Conflict Blocked',
  ACADEMIC_YEAR_CREATED: 'School Year Created',
  SEMESTER_ACTIVATED: 'Term Activated',
  SEMESTER_DEACTIVATED: 'Term Deactivated',
  DOCUMENT_REQUESTED: 'Document Requested',
  DOCUMENT_STATUS_CHANGED: 'Document Request Updated',
  DOCUMENT_GENERATED: 'Document Generated',
  DOCUMENT_GENERATION_REFUSED: 'Document Generation Refused',
  TOR_UPLOADED: 'Transcript Uploaded',
  TOR_REPLACED: 'Transcript Replaced',
  TOR_REMOVED: 'Transcript Removed',
  PREV_RECORD_ADDED: 'Previous School Record Added',
  PREV_RECORD_REMOVED: 'Previous School Record Removed',
  GSA_SENT: 'General Schedule and Assessment Sent',
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const ALL_AUDIT_ACTIONS = Object.keys(AUDIT_ACTIONS) as AuditAction[];

export function auditActionLabel(action: AuditAction): string {
  return AUDIT_ACTIONS[action] ?? action;
}

/* ------------------------------------------------------------------ */
/* API error shape                                                     */
/* ------------------------------------------------------------------ */

export interface ScheduleConflictDetail {
  rule: 'SECTION' | 'TRAINER' | 'ROOM';
  ruleLabel: string;
  scheduleId: string;
  subjectCode: string;
  subjectTitle: string;
  sectionCode: string;
  days: DayCode[];
  timeRange: string;
  room: string;
  trainerName: string;
}

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
}
