/**
 * Read models returned by the API.
 *
 * The server joins its collections once and hands the UI a flat, already-
 * labelled shape, so no page ever has to cross-reference raw tables itself.
 */

import type {
  ApplicantStanding,
  ClassSchedule,
  DocumentRequest,
  Enrollment,
  EnrollmentDocument,
  EnrollmentDocumentType,
  EnrollmentStatus,
  EnrollmentSubject,
  GradeCompletion,
  GradeStatus,
  GradingSheetRow,
  GradingSheetStatus,
  Role,
  Section,
  SemesterPeriod,
  Student,
  StudentStatus,
  Subject,
  TorDocument,
  UserAccountStatus,
} from './index';

export interface StudentView extends Student {
  fullName: string;
  lastFirstName: string;
  programCode: string;
  programName: string;
  sectionCode: string | null;
  curriculumName: string | null;
}

export interface FacultyView {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  diploma: string;
  position: string;
  email: string;
  contactNumber: string;
  isActive: boolean;
}

export interface SemesterView {
  id: string;
  academicYearId: string;
  academicYearLabel: string;
  /** The Diploma this grading period belongs to. */
  programId: string;
  programCode: string;
  programName: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  /** Composed "First Year, 1st Semester". */
  termLabel: string;
  /** Fully qualified: "IT · First Year, 1st Semester · 2025-2026". */
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface ClassScheduleView extends ClassSchedule {
  subjectCode: string;
  subjectTitle: string;
  units: number;
  sectionCode: string;
  programCode: string;
  trainerName: string;
  semesterLabel: string;
  academicYearLabel: string;
  semesterPeriod: SemesterPeriod;
  yearLevel: number;
  dayPattern: string;
  timeRange: string;
  enrolledCount: number;
}

export interface SubjectMappingView {
  programSubjectId: string;
  subject: Subject;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  isRequired: boolean;
}

export interface CurriculumView {
  id: string;
  programId: string;
  programCode: string;
  code: string;
  name: string;
  effectiveYear: string;
  isActive: boolean;
  subjectCount: number;
  totalUnits: number;
}

export interface SectionView extends Section {
  programCode: string;
  programName: string;
  studentCount: number;
}

export interface EnrollmentSubjectView extends EnrollmentSubject {
  subjectCode: string;
  subjectTitle: string;
  remarks: string;
  /** Present when the row is attached to a real class schedule. */
  scheduleLabel: string | null;
}

export interface TermRecordGroup {
  enrollmentId: string;
  semesterId: string;
  academicYearLabel: string;
  semesterPeriod: SemesterPeriod;
  yearLevel: number;
  /** Composed "First Year, 1st Semester". */
  termLabel: string;
  status: Enrollment['status'];
  rows: EnrollmentSubjectView[];
  totalUnits: number;
  gwa: string;
  hasUnresolvedInc: boolean;
}

export interface AcademicRecordView {
  student: StudentView;
  groups: TermRecordGroup[];
  overallGwa: string;
  totalUnits: number;
  hasUnresolvedInc: boolean;
  completions: GradeCompletionView[];
}

export interface GradeCompletionView extends GradeCompletion {
  subjectCode: string;
  subjectTitle: string;
  processedByName: string;
}

/** One candidate subject on the enrollment screen. */
export interface EnrollableSubject {
  subjectId: string;
  code: string;
  title: string;
  units: number;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  classScheduleId: string | null;
  scheduleLabel: string | null;
  /** True when the student already has a passing grade for it. */
  alreadyPassed: boolean;
  previousGrade: string | null;
  /** Set when the subject cannot be taken at all. Refused server-side too. */
  disabledReason: string | null;
  /** True for NSTP: enrolled and graded, but counts toward neither total. */
  excludedFromGwa: boolean;
  /**
   * Set when the subject *can* be taken but something about it is wrong —
   * today, that the Training Department has published no class for it.
   *
   * Deliberately separate from `disabledReason`. A missing schedule is not
   * the trainee's failing and not a rule they broke; it is the centre's own
   * gap, and a registrar may still have good reason to enrol ahead of it.
   * Blocking would hide the gap behind a refusal, so this warns instead.
   */
  warningReason: string | null;
}

export interface EnrollmentOptions {
  student: StudentView;
  semester: SemesterView;
  subjects: EnrollableSubject[];
  existingEnrollmentId: string | null;
  /** What they are already taking this semester — empty when not yet enrolled. */
  currentSubjects: EnrollmentSubjectView[];
  currentUnits: number;
  /** The preceding-semester grade gate. False means an override is required. */
  gateCleared: boolean;
  gateMessage: string;
  blockedReason: string | null;
}

export interface EnrollmentView extends Enrollment {
  studentName: string;
  studentNumber: string;
  /** Carried for the enrolment list, which is read across rather than down. */
  programCode: string;
  programName: string;
  sectionCode: string;
  academicYearLabel: string;
  semesterPeriod: SemesterPeriod;
  yearLevel: number;
  termLabel: string;
  subjectCount: number;
}

/** A roster row on the "grades by class" workflow. */
export interface ClassRosterRow {
  enrollmentSubjectId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  units: number;
  finalGrade: string | null;
  completionGrade: string | null;
  gradeStatus: GradeStatus;
  remarks: string;
}

export interface ClassRoster {
  schedule: ClassScheduleView;
  canEncode: boolean;
  encodingBlockedReason: string | null;
  rows: ClassRosterRow[];
}

export interface StudentGradeRow {
  enrollmentSubjectId: string;
  subjectCode: string;
  subjectTitle: string;
  units: number;
  finalGrade: string | null;
  completionGrade: string | null;
  gradeStatus: GradeStatus;
  remarks: string;
  scheduleLabel: string | null;
}

export interface StudentGradeSheet {
  student: StudentView;
  semester: SemesterView;
  enrollmentId: string | null;
  canEncode: boolean;
  encodingBlockedReason: string | null;
  rows: StudentGradeRow[];
}

/* ---------------------------------------------------------------- */
/* Grading sheets                                                    */
/* ---------------------------------------------------------------- */

export interface GradingSheetRowView extends GradingSheetRow {
  /** 1-based position, as printed on the paper form. */
  number: number;
  studentName: string;
  studentNumber: string;
  /** The subject's units, so the review table can show Grade | Units | Completion. */
  units: number;
  /**
   * Blank unless the grade is INC. Filled once the INC is resolved, which is
   * where the resolving grade lands — the INC itself stays in the grade column.
   */
  completionGrade: string | null;
}

/** The whole sheet, laid out as the centre's paper form reads. */
export interface GradingSheetView {
  id: string;
  referenceNumber: string;
  classScheduleId: string;
  status: GradingSheetStatus;

  /* Header block */
  courseCode: string;
  description: string;
  course: string;
  /** The diploma's short code — what the review queue groups by. */
  programCode: string;
  batch: string;
  levelSemester: string;
  academicYearLabel: string;
  sectionCode: string;
  trainerName: string;
  /** When and where the class meets — from the schedule the sheet is behind. */
  dayPattern: string;
  timeRange: string;
  room: string;

  rows: GradingSheetRowView[];
  filledCount: number;
  rowCount: number;
  isComplete: boolean;

  registrarRemarks: string;
  submittedByName: string | null;
  submittedAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  submissionCount: number;
}

/** A row in the trainer's class list or the registrar's review queue. */
export interface GradingSheetSummaryView {
  id: string;
  /**
   * The class this sheet is for.
   *
   * Carried explicitly because `id` is not a substitute: it is the sheet's own
   * id once one has been saved, and a synthetic `draft-…` id before that. Any
   * caller wanting the class must be given it, not left to parse it back out
   * of whichever of those two shapes `id` happens to be in.
   */
  classScheduleId: string;
  referenceNumber: string;
  status: GradingSheetStatus;
  courseCode: string;
  description: string;
  course: string;
  /** The diploma's short code — what the queue groups by. */
  programCode: string;
  sectionCode: string;
  levelSemester: string;
  /** Two classes can share a level and semester across school years. */
  academicYearLabel: string;
  trainerName: string;
  dayPattern: string;
  timeRange: string;
  /**
   * The meeting time as HH:MM, alongside the formatted `timeRange`.
   *
   * Sorting needs this: "1:00 PM – 3:00 PM" sorts before "7:00 AM – 9:00 AM"
   * as text, which would put the afternoon first in a list a trainer reads to
   * find their morning.
   */
  startTime: string;
  room: string;
  filledCount: number;
  rowCount: number;
  isComplete: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  submissionCount: number;
}

/* ---------------------------------------------------------------- */
/* Grade Evaluation Form                                             */
/* ---------------------------------------------------------------- */

/** The four unit buckets the printed form summarises. */
export interface GradeEvaluationUnits {
  enrolled: number;
  considered: number;
  passed: number;
  noCredit: number;
}

export interface GradeEvaluationRow {
  /** What INC resolution acts on. */
  enrollmentSubjectId: string;
  courseCode: string;
  courseTitle: string;
  /** The section the class ran under. */
  sectionCode: string;
  units: number;
  grade: string | null;
  completionGrade: string | null;
  /** The curriculum's own wording where there is one. */
  prerequisites: string;
  remarks: string;
  /** The trainer who handled the class, as the centre's form prints it. */
  trainerName: string;
  /** Percentage band for the grade. Reference only; never stored. */
  percentage: string;
  /** ENROLLED while a term is still running; blank once it has a grade. */
  status: string;
  /** True for NSTP: shown and graded, counted toward neither units nor GWA. */
  excludedFromGwa: boolean;
  /** Null when not yet graded — distinct from failed. */
  isPassed: boolean | null;
}

export interface GradeEvaluationGroup {
  semesterId: string;
  /** "First Year, 1st Semester" */
  label: string;
  academicYearLabel: string;
  yearLevel: number;
  rows: GradeEvaluationRow[];
  totalUnits: number;
  gwa: string;
  hasUnresolvedInc: boolean;
  units: GradeEvaluationUnits;
  /** "(DEC 11, 2025 - MAY 8, 2026)", or "(TBA)" for a term not yet dated. */
  coverage: string;
  /** True while the term is still running — its rows read ENROLLED. */
  inProgress: boolean;
  enrollmentId: string;
  /** When the trainee confirmed viewing this term's grades, if still valid. */
  gradesViewedAt: string | null;
  /** Every grade is in and the trainee has not confirmed viewing them. */
  gradesViewPending: boolean;
}

/** Derived on read, never stored — see the service for why. */
export interface GradeEvaluationForm {
  student: StudentView;
  /** Printed on the form so a paper copy can be referred to. */
  referenceNumber: string;
  /** The curriculum edition the trainee is bound to, e.g. "2025 (NEW CURR)". */
  batchLabel: string;
  /** The trainee's section, e.g. "DCMT Batch 1". */
  sectionLabel: string;
  /** Units for the term still in progress, which the centre's form totals. */
  unitsEnrolled: number;
  groups: GradeEvaluationGroup[];
  totalUnits: number;
  overallGwa: string;
  hasUnresolvedInc: boolean;
  /** Subjects still without a grade, so the form can say so up front. */
  ungradedCount: number;
  units: GradeEvaluationUnits;
  generatedAt: string;
}

export interface DocumentRequestView extends DocumentRequest {
  studentName: string;
  studentNumber: string;
  programCode: string;
  documentTypeLabel: string;
  statusLabel: string;
  requestedByName: string;
  hasGeneratedDocument: boolean;
}

export interface TorDocumentView extends TorDocument {
  uploadedByName: string;
}

export interface EnrollmentDocumentView extends EnrollmentDocument {
  uploadedByName: string;
}

/**
 * One row of the admission checklist: the requirement itself, what it means
 * for this particular applicant, and the upload filling it if there is one.
 * Blocked and empty slots are returned too — the registrar needs to see the
 * whole checklist, not just the parts already done.
 */
export interface EnrollmentDocumentSlotView {
  type: EnrollmentDocumentType;
  label: string;
  note: string | null;
  accept: string[];
  requirement: 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
  document: EnrollmentDocumentView | null;
}

export interface EnrollmentDocumentChecklist {
  student: StudentView;
  /** Null until a registrar records what the applicant had finished. */
  standing: ApplicantStanding | null;
  slots: EnrollmentDocumentSlotView[];
  requiredCount: number;
  submittedRequiredCount: number;
  isComplete: boolean;
}

/** What the applicant is handed after submitting the public form. */
export interface ApplicationReceipt {
  referenceCode: string;
  studentNumber: string;
  fullName: string;
  programName: string;
  standing: ApplicantStanding;
  submittedAt: string;
}

/**
 * Deliberately thin. A reference code is short enough to guess at, so this
 * confirms an application exists and where it stands without handing over
 * the applicant's contact details or address.
 */
export interface ApplicationStatusView {
  referenceCode: string;
  maskedName: string;
  programName: string;
  status: StudentStatus;
  statusLabel: string;
  submittedAt: string;
  rejectionReason: string | null;
}

export interface UserView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  roleLabel: string;
  status: UserAccountStatus;
  statusLabel: string;
  facultyId: string | null;
  facultyName: string | null;
  facultyEmployeeId: string | null;
  studentId: string | null;
  studentName: string | null;
  lastLoginAt: string | null;
  isLocked: boolean;
  createdAt: string;
}

export interface AuditLogView {
  id: string;
  action: string;
  actionLabel: string;
  recordType: string;
  recordId: string;
  userLabel: string;
  detail: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface StatCard {
  key: string;
  label: string;
  value: number;
  hint: string;
}

export interface RegistrarDashboard {
  kind: 'REGISTRAR';
  stats: StatCard[];
  recentlyEnrolled: Array<{
    enrollmentId: string;
    studentName: string;
    studentNumber: string;
    programCode: string;
    termLabel: string;
    enrolledAt: string;
    units: number;
  }>;
  activeTerm: SemesterView | null;
  pendingApplications: StudentView[];
  /**
   * How this school year's trainees divide across the diplomas. One trainee
   * counts once, however many terms of the year they have enrolled in.
   */
  enrollmentByDiploma: {
    schoolYearLabel: string | null;
    total: number;
    slices: Array<{ programId: string; code: string; name: string; count: number }>;
  };
  /** Trainer submissions waiting on the registrar. */
  sheetsAwaitingReview: Array<{
    id: string;
    referenceNumber: string;
    subjectCode: string;
    subjectTitle: string;
    sectionCode: string;
    submittedAt: string | null;
  }>;
  recentActivity: AuditLogView[];
}

export interface TraineeDashboard {
  kind: 'TRAINEE';
  student: StudentView;
  programName: string;
  sectionCode: string | null;
  activeTerm: SemesterView | null;
  nextClass: {
    subjectCode: string;
    subjectTitle: string;
    dayLabel: string;
    timeRange: string;
    room: string;
    trainerName: string;
  } | null;
  enrolledUnits: number;
  subjectCount: number;
}

export type DashboardPayload = RegistrarDashboard | TraineeDashboard;

export interface StudentImportRow {
  studentNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  extensionName: string;
  email: string;
  contactNumber: string;
  address: string;
  /** ISO yyyy-mm-dd, already normalized client-side from whatever the file used. */
  birthDate: string;
  yearLevel: number;
  sex: Student['sex'];
  civilStatus: string;
  nationality: string;
  highestEducation: string;
  classification: string;
  scholarshipType: string;
}

export interface StudentImportResult {
  imported: number;
  students: StudentView[];
}

/** One row = one class a trainor teaches. A trainor teaching 2+ subjects has 2+ rows sharing an employeeId. */
export interface FacultyScheduleImportRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  diploma: string;
  position: string;
  email: string;
  contactNumber: string;
  subjectCode: string;
  sectionCode: string;
  /** Raw pattern such as "MWF" or "TTh" — parsed server-side. */
  days: string;
  startTime: string;
  endTime: string;
  room: string;
}

export interface FacultyScheduleImportResult {
  facultyCreated: number;
  facultyUpdated: number;
  schedulesPublished: number;
}

/** One row = one subject the curriculum requires at a given year and semester. */
export interface CurriculumImportRow {
  curriculumCode: string;
  curriculumName: string;
  programCode: string;
  effectiveYear: string;
  subjectCode: string;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
}

export interface CurriculumImportResult {
  curriculaCreated: number;
  curriculaUpdated: number;
  subjectsMapped: number;
}

/** The General Schedule and Assessment for one student's current term. */
export interface ScheduleAssessmentResult {
  student: StudentView;
  /** The active term, or null when no term is currently open. */
  term: SemesterView | null;
  /** Null when the student has no enrollment row for the active term. */
  enrollmentStatus: EnrollmentStatus | null;
  totalUnits: number;
  /** Every subject enrolled for the active term, with course code/title/units. */
  subjects: EnrollmentSubjectView[];
  /** The published classes behind those subjects, for the weekly calendar. */
  schedules: ClassScheduleView[];
}

export interface DocumentValidationIssue {
  field: string;
  message: string;
}

export interface StudentSearchFilters {
  query?: string;
  status?: StudentStatus | 'ALL';
  statuses?: StudentStatus[];
  programId?: string;
  sectionId?: string;
  /** When true, list only archived students instead of the default (non-archived). */
  includeArchived?: boolean;
}

/** One trainee sign-in account, as the IT Administrator manages it. */
export interface TraineeAccountView {
  userId: string;
  /** What the trainee signs in with. */
  idNumber: string;
  name: string;
  programCode: string;
  /** Still on the default password — never signed in, or just reset. */
  mustChangePassword: boolean;
  locked: boolean;
  lastLoginAt: string | null;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface EnrollmentReportFilters {
  academicYearId?: string;
  /** Omitted for every semester of the year. */
  semesterPeriod?: SemesterPeriod;
  /** Omitted for every diploma. */
  programId?: string;
}

/** Counts shared by every level of the enrollment report. */
export interface EnrollmentCounts {
  /** Distinct trainees with a non-dropped enrolment in scope. */
  trainees: number;
  male: number;
  female: number;
  /** Trainees whose first enrolment ever falls in the selected school year. */
  newTrainees: number;
  continuing: number;
  /** Units carried on non-dropped enrolments. */
  units: number;
  /** Enrolments in scope that were dropped. Not counted in the figures above. */
  dropped: number;
}

export interface EnrollmentReportDiplomaRow extends EnrollmentCounts {
  programId: string;
  code: string;
  name: string;
  /** Trainees by year level, index 0 = First Year. */
  byYear: number[];
}

export interface EnrollmentReportSectionRow {
  key: string;
  programCode: string;
  yearLevel: number;
  sectionCode: string;
  termLabel: string;
  trainees: number;
  male: number;
  female: number;
  units: number;
}

export interface EnrollmentReportRosterRow {
  enrollmentId: string;
  studentNumber: string;
  name: string;
  sex: 'MALE' | 'FEMALE';
  programCode: string;
  yearLevel: number;
  sectionCode: string;
  termLabel: string;
  units: number;
  status: string;
  isNew: boolean;
  enrolledAt: string;
}

export interface EnrollmentReport {
  schoolYearLabel: string;
  /** "All semesters" or e.g. "1st Semester". */
  periodLabel: string;
  /** "All diplomas" or the diploma's name. */
  programLabel: string;
  /** How many year levels the columns run to (the longest diploma in scope). */
  yearLevels: number;
  totals: EnrollmentCounts;
  byDiploma: EnrollmentReportDiplomaRow[];
  bySection: EnrollmentReportSectionRow[];
  roster: EnrollmentReportRosterRow[];
  generatedAt: string;
}
