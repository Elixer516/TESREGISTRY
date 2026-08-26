/**
 * The typed API client. Mirrors `src/server/api.ts` one-to-one, with every
 * operation async and latency-bearing.
 */

import { serverApi } from '@/server/api';
import { request } from './client';

/* ---- auth ------------------------------------------------------- */

export const authApi = {
  login: (email: string, password: string) => request(() => serverApi.auth.login(email, password)),
  logout: () => request(() => serverApi.auth.logout()),
  restoreSession: (token: string) => request(() => serverApi.auth.restoreSession(token)),
  currentUser: () => request(() => serverApi.auth.currentUser()),
};

/* ---- dashboard -------------------------------------------------- */

export const dashboardApi = {
  get: () => request(() => serverApi.dashboard.get()),
};

/* ---- students --------------------------------------------------- */

type StudentsApi = typeof serverApi.students;

export const studentsApi = {
  list: (filters?: Parameters<StudentsApi['list']>[0]) =>
    request(() => serverApi.students.list(filters)),
  get: (id: string) => request(() => serverApi.students.get(id)),
  create: (input: Parameters<StudentsApi['create']>[0]) =>
    request(() => serverApi.students.create(input)),
  import: (rows: Parameters<StudentsApi['import']>[0], programId: string, sectionId: string | null) =>
    request(() => serverApi.students.import(rows, programId, sectionId)),
  approve: (studentId: string, curriculumId: string, sectionId: string | null) =>
    request(() => serverApi.students.approve(studentId, curriculumId, sectionId)),
  approveMany: (studentIds: string[], curriculumId: string, sectionId: string | null) =>
    request(() => serverApi.students.approveMany(studentIds, curriculumId, sectionId)),
  reject: (studentId: string, reason: string) =>
    request(() => serverApi.students.reject(studentId, reason)),
  update: (id: string, input: Parameters<StudentsApi['update']>[1]) =>
    request(() => serverApi.students.update(id, input)),
  setStatus: (id: string, status: Parameters<StudentsApi['setStatus']>[1]) =>
    request(() => serverApi.students.setStatus(id, status)),
  archive: (id: string, password: string) =>
    request(() => serverApi.students.archive(id, password)),
  restore: (id: string) => request(() => serverApi.students.restore(id)),
};

/* ---- catalog ---------------------------------------------------- */

type CatalogApi = typeof serverApi.catalog;

export const catalogApi = {
  listPrograms: (includeInactive?: boolean) =>
    request(() => serverApi.catalog.listPrograms(includeInactive)),
  createProgram: (input: Parameters<CatalogApi['createProgram']>[0]) =>
    request(() => serverApi.catalog.createProgram(input)),
  updateProgram: (id: string, input: Parameters<CatalogApi['updateProgram']>[1]) =>
    request(() => serverApi.catalog.updateProgram(id, input)),
  setProgramActive: (id: string, isActive: boolean) =>
    request(() => serverApi.catalog.setProgramActive(id, isActive)),
  listCurricula: (programId?: string) =>
    request(() => serverApi.catalog.listCurricula(programId)),
  createCurriculum: (input: Parameters<CatalogApi['createCurriculum']>[0]) =>
    request(() => serverApi.catalog.createCurriculum(input)),
  setCurriculumActive: (id: string, isActive: boolean) =>
    request(() => serverApi.catalog.setCurriculumActive(id, isActive)),
  listSubjects: (includeInactive?: boolean) =>
    request(() => serverApi.catalog.listSubjects(includeInactive)),
  createSubject: (input: Parameters<CatalogApi['createSubject']>[0]) =>
    request(() => serverApi.catalog.createSubject(input)),
  updateSubject: (id: string, input: Parameters<CatalogApi['updateSubject']>[1]) =>
    request(() => serverApi.catalog.updateSubject(id, input)),
  setSubjectActive: (id: string, isActive: boolean) =>
    request(() => serverApi.catalog.setSubjectActive(id, isActive)),
  listCurriculumSubjects: (curriculumId: string) =>
    request(() => serverApi.catalog.listCurriculumSubjects(curriculumId)),
  mapSubject: (input: Parameters<CatalogApi['mapSubject']>[0]) =>
    request(() => serverApi.catalog.mapSubject(input)),
  unmapSubject: (programSubjectId: string) =>
    request(() => serverApi.catalog.unmapSubject(programSubjectId)),
  importCurriculum: (rows: Parameters<CatalogApi['importCurriculum']>[0]) =>
    request(() => serverApi.catalog.importCurriculum(rows)),
  listSections: (programId?: string) =>
    request(() => serverApi.catalog.listSections(programId)),
  createSection: (input: Parameters<CatalogApi['createSection']>[0]) =>
    request(() => serverApi.catalog.createSection(input)),
  setSectionActive: (id: string, isActive: boolean) =>
    request(() => serverApi.catalog.setSectionActive(id, isActive)),
  listAcademicYears: () => request(() => serverApi.catalog.listAcademicYears()),
  listSemesters: (academicYearId?: string) =>
    request(() => serverApi.catalog.listSemesters(academicYearId)),
  getActiveSemester: () => request(() => serverApi.catalog.getActiveSemester()),
  createAcademicYear: (input: Parameters<CatalogApi['createAcademicYear']>[0]) =>
    request(() => serverApi.catalog.createAcademicYear(input)),
  setSemesterActive: (semesterId: string, isActive: boolean) =>
    request(() => serverApi.catalog.setSemesterActive(semesterId, isActive)),
};

/* ---- enrollment ------------------------------------------------- */

export const enrollmentApi = {
  options: (studentId: string, semesterId: string) =>
    request(() => serverApi.enrollment.options(studentId, semesterId)),
  create: (studentId: string, semesterId: string, subjectIds: string[]) =>
    request(() => serverApi.enrollment.create(studentId, semesterId, subjectIds)),
  list: (filters?: Parameters<typeof serverApi.enrollment.list>[0]) =>
    request(() => serverApi.enrollment.list(filters)),
  drop: (enrollmentId: string, reason: string) =>
    request(() => serverApi.enrollment.drop(enrollmentId, reason)),
};

/* ---- grades ----------------------------------------------------- */

export const gradesApi = {
  classRoster: (scheduleId: string) => request(() => serverApi.grades.classRoster(scheduleId)),
  encodableClasses: (semesterId: string) =>
    request(() => serverApi.grades.encodableClasses(semesterId)),
  studentSheet: (studentId: string, semesterId: string) =>
    request(() => serverApi.grades.studentSheet(studentId, semesterId)),
  save: (entries: Parameters<typeof serverApi.grades.save>[0]) =>
    request(() => serverApi.grades.save(entries)),
};

/* ---- academic records ------------------------------------------- */

export const recordsApi = {
  get: (studentId: string, filters?: Parameters<typeof serverApi.records.get>[1]) =>
    request(() => serverApi.records.get(studentId, filters)),
  completeInc: (enrollmentSubjectId: string, completionGrade: string, remarks: string) =>
    request(() => serverApi.records.completeInc(enrollmentSubjectId, completionGrade, remarks)),
  correctInc: (enrollmentSubjectId: string, correctedGrade: string, remarks: string) =>
    request(() => serverApi.records.correctInc(enrollmentSubjectId, correctedGrade, remarks)),
  gradeSheet: (studentId: string, semesterId: string) =>
    request(() => serverApi.records.gradeSheet(studentId, semesterId)),
};

/* ---- documents -------------------------------------------------- */

export const documentsApi = {
  listRequests: (filters?: Parameters<typeof serverApi.documents.listRequests>[0]) =>
    request(() => serverApi.documents.listRequests(filters)),
  eligibleStudents: (query?: string) =>
    request(() => serverApi.documents.eligibleStudents(query)),
  createRequest: (
    studentId: string,
    documentType: Parameters<typeof serverApi.documents.createRequest>[1],
    purpose: string,
  ) => request(() => serverApi.documents.createRequest(studentId, documentType, purpose)),
  updateRequestStatus: (
    requestId: string,
    status: Parameters<typeof serverApi.documents.updateRequestStatus>[1],
    remarks?: string,
  ) => request(() => serverApi.documents.updateRequestStatus(requestId, status, remarks)),
  checkGate: (
    studentId: string,
    documentType: Parameters<typeof serverApi.documents.checkGate>[1],
  ) => request(() => serverApi.documents.checkGate(studentId, documentType)),
  generate: (
    studentId: string,
    documentType: Parameters<typeof serverApi.documents.generate>[1],
    documentRequestId: string | null,
  ) => request(() => serverApi.documents.generate(studentId, documentType, documentRequestId)),
  listGenerated: (studentId?: string) =>
    request(() => serverApi.documents.listGenerated(studentId)),
  getGenerated: (id: string) => request(() => serverApi.documents.getGenerated(id)),
  scheduleAssessment: (studentId: string) =>
    request(() => serverApi.documents.scheduleAssessment(studentId)),
  scheduleAssessmentForSection: (sectionId: string) =>
    request(() => serverApi.documents.scheduleAssessmentForSection(sectionId)),
  sendScheduleAssessmentForSection: (sectionId: string) =>
    request(() => serverApi.documents.sendScheduleAssessmentForSection(sectionId)),
};

/* ---- public applications ---------------------------------------- */

type ApplicationsApi = typeof serverApi.applications;

export const applicationsApi = {
  submit: (input: Parameters<ApplicationsApi['submit']>[0]) =>
    request(() => serverApi.applications.submit(input)),
  lookup: (referenceCode: string) =>
    request(() => serverApi.applications.lookup(referenceCode)),
};

/* ---- admission documents ---------------------------------------- */

type EnrollmentDocumentsApi = typeof serverApi.enrollmentDocuments;

export const enrollmentDocumentsApi = {
  checklist: (studentId: string) =>
    request(() => serverApi.enrollmentDocuments.checklist(studentId)),
  record: (input: Parameters<EnrollmentDocumentsApi['record']>[0]) =>
    request(() => serverApi.enrollmentDocuments.record(input)),
  remove: (id: string, password: string) =>
    request(() => serverApi.enrollmentDocuments.remove(id, password)),
  setDriveFolder: (studentId: string, folderId: string) =>
    request(() => serverApi.enrollmentDocuments.setDriveFolder(studentId, folderId)),
  clearDriveFolder: (studentId: string) =>
    request(() => serverApi.enrollmentDocuments.clearDriveFolder(studentId)),
};

/* ---- transcripts ------------------------------------------------ */

export const transcriptsApi = {
  get: (studentId: string) => request(() => serverApi.transcripts.get(studentId)),
  upload: (input: Parameters<typeof serverApi.transcripts.upload>[0]) =>
    request(() => serverApi.transcripts.upload(input)),
  remove: (studentId: string, password: string) =>
    request(() => serverApi.transcripts.remove(studentId, password)),
  listPrevious: (studentId: string) =>
    request(() => serverApi.transcripts.listPrevious(studentId)),
  addPrevious: (input: Parameters<typeof serverApi.transcripts.addPrevious>[0]) =>
    request(() => serverApi.transcripts.addPrevious(input)),
  removePrevious: (id: string) => request(() => serverApi.transcripts.removePrevious(id)),
};

/* ---- schedules -------------------------------------------------- */

export const schedulesApi = {
  list: (filters?: Parameters<typeof serverApi.schedules.list>[0]) =>
    request(() => serverApi.schedules.list(filters)),
  get: (id: string) => request(() => serverApi.schedules.get(id)),
  create: (input: Parameters<typeof serverApi.schedules.create>[0]) =>
    request(() => serverApi.schedules.create(input)),
  update: (id: string, input: Parameters<typeof serverApi.schedules.update>[1]) =>
    request(() => serverApi.schedules.update(id, input)),
  publish: (id: string) => request(() => serverApi.schedules.publish(id)),
  unpublish: (id: string) => request(() => serverApi.schedules.unpublish(id)),
  remove: (id: string) => request(() => serverApi.schedules.remove(id)),
  forSection: (sectionId: string, semesterId: string) =>
    request(() => serverApi.schedules.forSection(sectionId, semesterId)),
  importFacultyAndSchedules: (
    rows: Parameters<typeof serverApi.schedules.importFacultyAndSchedules>[0],
    semesterId: string,
  ) => request(() => serverApi.schedules.importFacultyAndSchedules(rows, semesterId)),
};

/* ---- users and audit -------------------------------------------- */

export const usersApi = {
  list: (filters?: Parameters<typeof serverApi.users.list>[0]) =>
    request(() => serverApi.users.list(filters)),
  get: (id: string) => request(() => serverApi.users.get(id)),
  create: (input: Parameters<typeof serverApi.users.create>[0]) =>
    request(() => serverApi.users.create(input)),
  setStatus: (
    userId: string,
    status: Parameters<typeof serverApi.users.setStatus>[1],
    adminPassword: string,
    reason?: string,
  ) => request(() => serverApi.users.setStatus(userId, status, adminPassword, reason)),
  resetPassword: (userId: string, newPassword: string, adminPassword: string) =>
    request(() => serverApi.users.resetPassword(userId, newPassword, adminPassword)),
  listFaculty: (query?: string) => request(() => serverApi.users.listFaculty(query)),
  auditLogs: (filters?: Parameters<typeof serverApi.users.auditLogs>[0]) =>
    request(() => serverApi.users.auditLogs(filters)),
  auditActions: () => request(() => serverApi.users.auditActions()),
  auditRecordTypes: () => request(() => serverApi.users.auditRecordTypes()),
};

/* ---- my own records --------------------------------------------- */

export const mineApi = {
  schedule: () => request(() => serverApi.mine.schedule()),
  record: () => request(() => serverApi.mine.record()),
  scheduleAssessment: () => request(() => serverApi.mine.scheduleAssessment()),
  studentId: () => request(() => serverApi.mine.studentId()),
  notifications: () => request(() => serverApi.mine.notifications()),
  unreadCount: () => request(() => serverApi.mine.unreadCount()),
  markRead: (id: string) => request(() => serverApi.mine.markRead(id)),
  markAllRead: () => request(() => serverApi.mine.markAllRead()),
};
