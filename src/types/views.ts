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
  disabledReason: string | null;
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
  batch: string;
  levelSemester: string;
  academicYearLabel: string;
  sectionCode: string;
  trainerName: string;

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
  referenceNumber: string;
  status: GradingSheetStatus;
  courseCode: string;
  description: string;
  course: string;
  sectionCode: string;
  levelSemester: string;
  /** Two classes can share a level and semester across school years. */
  academicYearLabel: string;
  trainerName: string;
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

export interface GradeEvaluationRow {
  /** What INC resolution acts on. */
  enrollmentSubjectId: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  grade: string | null;
  completionGrade: string | null;
  /** The curriculum's own wording where there is one. */
  prerequisites: string;
  remarks: string;
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
}

/** Derived on read, never stored — see the service for why. */
export interface GradeEvaluationForm {
  student: StudentView;
  groups: GradeEvaluationGroup[];
  totalUnits: number;
  overallGwa: string;
  hasUnresolvedInc: boolean;
  /** Subjects still without a grade, so the form can say so up front. */
  ungradedCount: number;
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
  recentSchedules: ClassScheduleView[];
  pendingAccounts: UserView[];
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
