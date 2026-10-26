/**
 * The typed API client. Mirrors `src/server/api.ts` one-to-one, with every
 * operation async and latency-bearing.
 */

import { serverApi } from '@/server/api';
import { request } from './client';
import { isSupabaseMode } from '@/lib/supabase';
import * as supabaseAuth from './supabase-auth';
import { backend } from './remote';
import type { ReportFilters } from '@/types/views';

/* ---- auth ------------------------------------------------------- */

/**
 * With a Supabase project configured, who someone is and their password are
 * Supabase Auth's (see supabase-auth); everything else goes to `backend`.
 */
export const authApi = {
  login: (email: string, password: string) =>
    isSupabaseMode
      ? supabaseAuth.signIn(email, password)
      : request(() => serverApi.auth.login(email, password)),
  logout: () => (isSupabaseMode ? supabaseAuth.signOut() : request(() => serverApi.auth.logout())),
  restoreSession: (token: string) =>
    isSupabaseMode
      ? supabaseAuth.restore()
      : request(() => serverApi.auth.restoreSession(token)),
  currentUser: () =>
    isSupabaseMode ? supabaseAuth.me() : request(() => serverApi.auth.currentUser()),
  updateMyProfile: (input: Parameters<typeof serverApi.auth.updateMyProfile>[0]) =>
    isSupabaseMode
      ? supabaseAuth.updateMyProfile(input)
      : request(() => serverApi.auth.updateMyProfile(input)),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    isSupabaseMode
      ? supabaseAuth.changePassword(currentPassword, newPassword)
      : request(() => serverApi.auth.changeMyPassword(currentPassword, newPassword)),
};


/* ---- drop cases --------------------------------------------------- */

type DropsApi = typeof serverApi.drops;

export const dropsApi = {
  list: (filters?: Parameters<DropsApi['list']>[0]) => request(() => backend.drops.list(filters)),
  get: (id: string) => request(() => backend.drops.get(id)),
  candidates: () => request(() => backend.drops.candidates()),
  open: (input: Parameters<DropsApi['open']>[0]) => request(() => backend.drops.open(input)),
  update: (id: string, input: Parameters<DropsApi['update']>[1]) =>
    request(() => backend.drops.update(id, input)),
  confirm: (id: string, input: Parameters<DropsApi['confirm']>[1]) =>
    request(() => backend.drops.confirm(id, input)),
  close: (id: string, note: string) => request(() => backend.drops.close(id, note)),
  reinstate: (id: string, reason: string) => request(() => backend.drops.reinstate(id, reason)),
  addAttachments: (id: string, attachments: Parameters<DropsApi['addAttachments']>[1]) =>
    request(() => backend.drops.addAttachments(id, attachments)),
};

/* ---- reports ------------------------------------------------------ */

export const reportsApi = {
  enrollment: (filters?: ReportFilters) => request(() => backend.reports.enrollment(filters)),
  academic: (filters?: ReportFilters) => request(() => backend.reports.academic(filters)),
  retention: (filters?: ReportFilters) => request(() => backend.reports.retention(filters)),
  completion: (filters?: ReportFilters) => request(() => backend.reports.completion(filters)),
  summary: (filters?: ReportFilters) => request(() => backend.reports.summary(filters)),
  facultyEvaluation: (filters?: ReportFilters) =>
    request(() => backend.reports.facultyEvaluation(filters)),
};

/* ---- trainee accounts (IT Administrator) ------------------------- */

export const accountsApi = {
  listTrainees: (query?: string) => request(() => backend.accounts.listTrainees(query)),
  resetTraineePassword: (userId: string) =>
    isSupabaseMode
      ? supabaseAuth.resetTraineePassword(userId)
      : request(() => serverApi.accounts.resetTraineePassword(userId)),
};

/* ---- dashboard -------------------------------------------------- */

export const dashboardApi = {
  get: () => request(() => backend.dashboard.get()),
};

/* ---- demonstration data ------------------------------------------- */

export const demoApi = {
  reset: (phrase: string, password: string) =>
    request(() => backend.demo.reset(phrase, password)),
};

/* ---- students --------------------------------------------------- */

type StudentsApi = typeof serverApi.students;

export const studentsApi = {
  list: (filters?: Parameters<StudentsApi['list']>[0]) =>
    request(() => backend.students.list(filters)),
  get: (id: string) => request(() => backend.students.get(id)),
  create: (input: Parameters<StudentsApi['create']>[0]) =>
    request(() => backend.students.create(input)),
  import: (rows: Parameters<StudentsApi['import']>[0], programId: string, sectionId: string | null) =>
    request(() => backend.students.import(rows, programId, sectionId)),
  approve: (studentId: string, curriculumId: string, sectionId: string | null) =>
    request(() => backend.students.approve(studentId, curriculumId, sectionId)),
  approveMany: (studentIds: string[], curriculumId: string, sectionId: string | null) =>
    request(() => backend.students.approveMany(studentIds, curriculumId, sectionId)),
  reject: (studentId: string, reason: string) =>
    request(() => backend.students.reject(studentId, reason)),
  update: (id: string, input: Parameters<StudentsApi['update']>[1]) =>
    request(() => backend.students.update(id, input)),
  setStatus: (
    id: string,
    status: Parameters<StudentsApi['setStatus']>[1],
    departure?: Parameters<StudentsApi['setStatus']>[2],
  ) => request(() => backend.students.setStatus(id, status, departure)),
  archive: (id: string, password: string) =>
    request(() => backend.students.archive(id, password)),
  restore: (id: string) => request(() => backend.students.restore(id)),
};

/* ---- catalog ---------------------------------------------------- */

type CatalogApi = typeof serverApi.catalog;

export const catalogApi = {
  listPrograms: (includeInactive?: boolean) =>
    request(() => backend.catalog.listPrograms(includeInactive)),
  createProgram: (input: Parameters<CatalogApi['createProgram']>[0]) =>
    request(() => backend.catalog.createProgram(input)),
  updateProgram: (id: string, input: Parameters<CatalogApi['updateProgram']>[1]) =>
    request(() => backend.catalog.updateProgram(id, input)),
  setProgramActive: (id: string, isActive: boolean) =>
    request(() => backend.catalog.setProgramActive(id, isActive)),
  listCurricula: (programId?: string) =>
    request(() => backend.catalog.listCurricula(programId)),
  createCurriculum: (input: Parameters<CatalogApi['createCurriculum']>[0]) =>
    request(() => backend.catalog.createCurriculum(input)),
  setCurriculumActive: (id: string, isActive: boolean) =>
    request(() => backend.catalog.setCurriculumActive(id, isActive)),
  listSubjects: (includeInactive?: boolean) =>
    request(() => backend.catalog.listSubjects(includeInactive)),
  createSubject: (input: Parameters<CatalogApi['createSubject']>[0]) =>
    request(() => backend.catalog.createSubject(input)),
  updateSubject: (id: string, input: Parameters<CatalogApi['updateSubject']>[1]) =>
    request(() => backend.catalog.updateSubject(id, input)),
  setSubjectActive: (id: string, isActive: boolean) =>
    request(() => backend.catalog.setSubjectActive(id, isActive)),
  listCurriculumSubjects: (curriculumId: string) =>
    request(() => backend.catalog.listCurriculumSubjects(curriculumId)),
  mapSubject: (input: Parameters<CatalogApi['mapSubject']>[0]) =>
    request(() => backend.catalog.mapSubject(input)),
  unmapSubject: (programSubjectId: string) =>
    request(() => backend.catalog.unmapSubject(programSubjectId)),
  importCurriculum: (rows: Parameters<CatalogApi['importCurriculum']>[0]) =>
    request(() => backend.catalog.importCurriculum(rows)),
  listSections: (programId?: string) =>
    request(() => backend.catalog.listSections(programId)),
  createSection: (input: Parameters<CatalogApi['createSection']>[0]) =>
    request(() => backend.catalog.createSection(input)),
  setSectionActive: (id: string, isActive: boolean) =>
    request(() => backend.catalog.setSectionActive(id, isActive)),
  listAcademicYears: () => request(() => backend.catalog.listAcademicYears()),
  listSemesters: (filters?: Parameters<CatalogApi['listSemesters']>[0]) =>
    request(() => backend.catalog.listSemesters(filters)),
  getActiveSemesterFor: (programId: string, yearLevel: number) =>
    request(() => backend.catalog.getActiveSemesterFor(programId, yearLevel)),
  listActiveSemesters: () => request(() => backend.catalog.listActiveSemesters()),
  createSemester: (input: Parameters<CatalogApi['createSemester']>[0]) =>
    request(() => backend.catalog.createSemester(input)),
  createAcademicYear: (input: Parameters<CatalogApi['createAcademicYear']>[0]) =>
    request(() => backend.catalog.createAcademicYear(input)),
  setSemesterActive: (semesterId: string, isActive: boolean) =>
    request(() => backend.catalog.setSemesterActive(semesterId, isActive)),
};

/* ---- enrollment ------------------------------------------------- */

export const academicStandingApi = {
  list: () => request(() => backend.academicStanding.list()),
};

export const enrollmentApi = {
  options: (studentId: string, semesterId: string) =>
    request(() => backend.enrollment.options(studentId, semesterId)),
  create: (
    studentId: string,
    semesterId: string,
    subjectIds: string[],
    gateOverrideReason?: string,
    remarks?: string,
    scholarship?: Parameters<typeof serverApi.enrollment.create>[5],
  ) =>
    request(() =>
      backend.enrollment.create(
        studentId,
        semesterId,
        subjectIds,
        gateOverrideReason,
        remarks,
        scholarship,
      ),
    ),
  list: (filters?: Parameters<typeof serverApi.enrollment.list>[0]) =>
    request(() => backend.enrollment.list(filters)),
  drop: (enrollmentId: string, reason: string) =>
    request(() => backend.enrollment.drop(enrollmentId, reason)),
  dropSubject: (enrollmentSubjectId: string, reason: string) =>
    request(() => backend.enrollment.dropSubject(enrollmentSubjectId, reason)),
  setRemarks: (enrollmentId: string, remarks: string) =>
    request(() => backend.enrollment.setRemarks(enrollmentId, remarks)),
};

/* ---- grading sheets --------------------------------------------- */

type GradingSheetsApi = typeof serverApi.gradingSheets;

export const gradingSheetsApi = {
  myClasses: () => request(() => backend.gradingSheets.myClasses()),
  forClass: (classScheduleId: string) =>
    request(() => backend.gradingSheets.forClass(classScheduleId)),
  byReference: (referenceNumber: string) =>
    request(() => backend.gradingSheets.byReference(referenceNumber)),
  submit: (
    classScheduleId: string,
    entries: Parameters<GradingSheetsApi['submit']>[1],
    attachments?: Parameters<GradingSheetsApi['submit']>[2],
  ) => request(() => backend.gradingSheets.submit(classScheduleId, entries, attachments)),
  list: (filters?: Parameters<GradingSheetsApi['list']>[0]) =>
    request(() => backend.gradingSheets.list(filters)),
  get: (id: string) => request(() => backend.gradingSheets.get(id)),
  approve: (id: string) => request(() => backend.gradingSheets.approve(id)),
  markPending: (id: string, remarks: string) =>
    request(() => backend.gradingSheets.markPending(id, remarks)),
  semesters: () => request(() => backend.gradingSheets.semesters()),
};

/* ---- grade evaluation + INC resolution -------------------------- */

export const evaluationApi = {
  get: (studentId: string) => request(() => backend.evaluation.get(studentId)),
  completeInc: (enrollmentSubjectId: string, completionPercentage: string, remarks: string) =>
    request(() => backend.evaluation.completeInc(enrollmentSubjectId, completionPercentage, remarks)),
  correctInc: (enrollmentSubjectId: string, correctedPercentage: string, remarks: string) =>
    request(() => backend.evaluation.correctInc(enrollmentSubjectId, correctedPercentage, remarks)),
};

/* ---- COR -------------------------------------------------------- */

export const gsaApi = {
  forStudent: (studentId: string) => request(() => backend.gsa.forStudent(studentId)),
};

/* ---- public applications ---------------------------------------- */

type ApplicationsApi = typeof serverApi.applications;

export const applicationsApi = {
  submit: (input: Parameters<ApplicationsApi['submit']>[0]) =>
    request(() => backend.applications.submit(input)),
  lookup: (referenceCode: string) =>
    request(() => backend.applications.lookup(referenceCode)),
};

/* ---- admission documents ---------------------------------------- */

type EnrollmentDocumentsApi = typeof serverApi.enrollmentDocuments;

export const enrollmentDocumentsApi = {
  checklist: (studentId: string) =>
    request(() => backend.enrollmentDocuments.checklist(studentId)),
  record: (input: Parameters<EnrollmentDocumentsApi['record']>[0]) =>
    request(() => backend.enrollmentDocuments.record(input)),
  remove: (id: string, password: string) =>
    request(() => backend.enrollmentDocuments.remove(id, password)),
  setDriveFolder: (studentId: string, folderId: string) =>
    request(() => backend.enrollmentDocuments.setDriveFolder(studentId, folderId)),
  clearDriveFolder: (studentId: string) =>
    request(() => backend.enrollmentDocuments.clearDriveFolder(studentId)),
  planRename: (studentId: string) =>
    request(() => backend.enrollmentDocuments.planRename(studentId)),
};

/* ---- schedules -------------------------------------------------- */

export const schedulesApi = {
  list: (filters?: Parameters<typeof serverApi.schedules.list>[0]) =>
    request(() => backend.schedules.list(filters)),
  get: (id: string) => request(() => backend.schedules.get(id)),
  create: (input: Parameters<typeof serverApi.schedules.create>[0]) =>
    request(() => backend.schedules.create(input)),
  update: (id: string, input: Parameters<typeof serverApi.schedules.update>[1]) =>
    request(() => backend.schedules.update(id, input)),
  publish: (id: string) => request(() => backend.schedules.publish(id)),
  unpublish: (id: string) => request(() => backend.schedules.unpublish(id)),
  remove: (id: string) => request(() => backend.schedules.remove(id)),
  forSection: (sectionId: string, semesterId: string) =>
    request(() => backend.schedules.forSection(sectionId, semesterId)),
  importFacultyAndSchedules: (
    rows: Parameters<typeof serverApi.schedules.importFacultyAndSchedules>[0],
    semesterId: string,
  ) => request(() => backend.schedules.importFacultyAndSchedules(rows, semesterId)),
};

/* ---- audit trail + trainer list --------------------------------- */

export const auditApi = {
  logs: (filters?: Parameters<typeof serverApi.audit.logs>[0]) =>
    request(() => backend.audit.logs(filters)),
  actions: () => request(() => backend.audit.actions()),
  recordTypes: () => request(() => backend.audit.recordTypes()),
  listFaculty: (query?: string) => request(() => backend.audit.listFaculty(query)),
};

/* ---- my own records --------------------------------------------- */

export const mineApi = {
  schedule: () => request(() => backend.mine.schedule()),
  teachingSchedule: () => request(() => backend.mine.teachingSchedule()),
  evaluation: () => request(() => backend.mine.evaluation()),
  confirmGradesViewed: (enrollmentId: string) =>
    request(() => backend.mine.confirmGradesViewed(enrollmentId)),
  curriculum: () => request(() => backend.mine.curriculum()),
  evaluationTasks: () => request(() => backend.mine.evaluationTasks()),
  submitEvaluation: (
    enrollmentSubjectId: string,
    input: Parameters<typeof serverApi.mine.submitEvaluation>[1],
  ) => request(() => backend.mine.submitEvaluation(enrollmentSubjectId, input)),
  evaluationResults: () => request(() => backend.mine.evaluationResults()),
  scheduleAssessment: () => request(() => backend.mine.scheduleAssessment()),
  studentId: () => request(() => backend.mine.studentId()),
  documentRequests: () => request(() => backend.mine.documentRequests()),
  requestDocument: (input: Parameters<typeof serverApi.mine.requestDocument>[0]) =>
    request(() => backend.mine.requestDocument(input)),
  withdrawRequest: (requestId: string) => request(() => backend.mine.withdrawRequest(requestId)),
};

/* ---- crediting, transcript, requests, deadlines, head trainer --- */

export const creditsApi = {
  workspace: (studentId: string) => request(() => backend.credits.workspace(studentId)),
  addRecords: (studentId: string, inputs: Parameters<typeof serverApi.credits.addRecords>[1]) =>
    request(() => backend.credits.addRecords(studentId, inputs)),
  removeRecord: (recordId: string) => request(() => backend.credits.removeRecord(recordId)),
  credit: (studentId: string, subjectId: string, previousRecordIds: string[], note?: string) =>
    request(() => backend.credits.credit(studentId, subjectId, previousRecordIds, note)),
  removeCredit: (creditId: string) => request(() => backend.credits.removeCredit(creditId)),
};

export const transcriptApi = {
  get: (studentId: string) => request(() => backend.transcript.get(studentId)),
  graduationCheck: (studentId: string) => request(() => backend.transcript.graduationCheck(studentId)),
  markGraduated: (studentId: string, input: Parameters<typeof serverApi.transcript.markGraduated>[1]) =>
    request(() => backend.transcript.markGraduated(studentId, input)),
  updateGraduation: (studentId: string, input: Parameters<typeof serverApi.transcript.updateGraduation>[1]) =>
    request(() => backend.transcript.updateGraduation(studentId, input)),
  markGraduatedBatch: (
    shared: Parameters<typeof serverApi.transcript.markGraduatedBatch>[0],
    entries: Parameters<typeof serverApi.transcript.markGraduatedBatch>[1],
  ) => request(() => backend.transcript.markGraduatedBatch(shared, entries)),
  candidates: (programId?: string) => request(() => backend.transcript.candidates(programId)),
};

export const clearanceApi = {
  get: (studentId: string) => request(() => backend.clearance.get(studentId)),
  receive: (
    studentId: string,
    documentType: Parameters<typeof serverApi.clearance.receive>[1],
    submittedOn: string,
    remarks?: string,
  ) => request(() => backend.clearance.receive(studentId, documentType, submittedOn, remarks)),
  removeReceipt: (receiptId: string) => request(() => backend.clearance.removeReceipt(receiptId)),
};

export const documentRequestsApi = {
  list: (status?: Parameters<typeof serverApi.documentRequests.list>[0]) =>
    request(() => backend.documentRequests.list(status)),
  update: (requestId: string, status: Parameters<typeof serverApi.documentRequests.update>[1], remarks?: string) =>
    request(() => backend.documentRequests.update(requestId, status, remarks)),
};

export const gradeDeadlinesApi = {
  alerts: () => request(() => backend.gradeDeadlines.alerts()),
  setDueDate: (semesterId: string, dueDate: string | null) =>
    request(() => backend.catalog.setGradesDueDate(semesterId, dueDate)),
  overrides: (semesterId: string) => request(() => backend.gradeDeadlines.overrides(semesterId)),
  addOverride: (input: Parameters<typeof serverApi.gradeDeadlines.addOverride>[0]) =>
    request(() => backend.gradeDeadlines.addOverride(input)),
  removeOverride: (overrideId: string) => request(() => backend.gradeDeadlines.removeOverride(overrideId)),
};

export const headTrainerApi = {
  amI: () => request(() => backend.headTrainer.amI()),
  overview: () => request(() => backend.headTrainer.overview()),
  sheet: (classScheduleId: string) => request(() => backend.headTrainer.sheet(classScheduleId)),
};
