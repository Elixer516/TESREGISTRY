/**
 * Read models returned by the API.
 *
 * The server joins its collections once and hands the UI a flat, already-
 * labelled shape, so no page ever has to cross-reference raw tables itself.
 */

import type {
  AvailabilityStatus,
  ClassSchedule,
  DayCode,
  DocumentRequest,
  Enrollment,
  EnrollmentSubject,
  GradeCompletion,
  GradeStatus,
  Role,
  Section,
  SemesterPeriod,
  Student,
  StudentStatus,
  Subject,
  Term,
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
  department: string;
  position: string;
  email: string;
  contactNumber: string;
  isActive: boolean;
  hasLogin: boolean;
  loginEmail: string | null;
}

export interface SemesterView {
  id: string;
  academicYearId: string;
  academicYearLabel: string;
  semesterPeriod: SemesterPeriod;
  term: Term;
  /** Composed "1st Semester · 1st Term". */
  termLabel: string;
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
  term: Term;
  dayPattern: string;
  timeRange: string;
  enrolledCount: number;
}

export interface SubjectMappingView {
  programSubjectId: string;
  subject: Subject;
  yearLevel: number;
  semesterPeriod: SemesterPeriod;
  term: Term;
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
  term: Term;
  /** Composed "1st Semester · 1st Term". */
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
  term: Term;
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
  blockedReason: string | null;
}

export interface EnrollmentView extends Enrollment {
  studentName: string;
  studentNumber: string;
  academicYearLabel: string;
  semesterPeriod: SemesterPeriod;
  term: Term;
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

export interface TrainerAvailabilityView {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeId: string;
  department: string;
  semesterId: string;
  semesterLabel: string;
  days: DayCode[];
  dayPattern: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  notes: string;
  status: AvailabilityStatus;
  submittedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
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
}

export interface TrainingDashboard {
  kind: 'TRAINING_OFFICER';
  stats: StatCard[];
  recentSchedules: ClassScheduleView[];
  pendingAvailability: TrainerAvailabilityView[];
  activeTerm: SemesterView | null;
}

export interface TrainerDashboard {
  kind: 'TRAINER';
  stats: StatCard[];
  myClasses: ClassScheduleView[];
  pendingGrades: Array<{
    scheduleId: string;
    subjectCode: string;
    sectionCode: string;
    ungraded: number;
    total: number;
  }>;
  activeTerm: SemesterView | null;
}

export interface AdminDashboard {
  kind: 'IT_ADMIN';
  stats: StatCard[];
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
  unreadNotifications: number;
}

export type DashboardPayload =
  | RegistrarDashboard
  | TrainingDashboard
  | TrainerDashboard
  | AdminDashboard
  | TraineeDashboard;

export interface StudentImportRow {
  studentNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  contactNumber: string;
  programCode: string;
  yearLevel: number;
  sex: Student['sex'];
}

export interface StudentImportResult {
  imported: number;
  students: StudentView[];
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
}
