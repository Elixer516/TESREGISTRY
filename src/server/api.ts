/**
 * The server's public surface — the only module `src/api` is allowed to touch,
 * and the only path by which the frontend reaches any of this.
 *
 * Everything here is synchronous; the latency and async shape belong to the
 * client in `src/api/client.ts`, exactly as they would with a real HTTP layer.
 */

import * as auth from './auth';
import * as applications from './services/applications';
import * as catalog from './services/catalog';
import * as dashboard from './services/dashboard';
import * as documents from './services/documents';
import * as enrollment from './services/enrollment';
import * as enrollmentDocuments from './services/enrollment-documents';
import * as grades from './services/grades';
import * as gradingSheets from './services/grading-sheets';
import * as mine from './services/mine';
import * as records from './services/records';
import * as schedules from './services/schedules';
import * as students from './services/students';
import * as transcripts from './services/transcripts';
import * as users from './services/users';

export const serverApi = {
  auth: {
    login: auth.login,
    logout: auth.logout,
    restoreSession: auth.restoreSession,
    currentUser: () => {
      const user = auth.currentUser();
      return user ? auth.toPublicUser(user) : null;
    },
  },
  dashboard: {
    get: dashboard.getDashboard,
  },
  students: {
    list: students.listStudents,
    get: students.getStudentById,
    create: students.createStudent,
    import: students.importStudents,
    approve: students.approveStudent,
    approveMany: students.approveStudents,
    reject: students.rejectStudent,
    update: students.updateStudent,
    setStatus: students.setStudentStatus,
    archive: students.archiveStudent,
    restore: students.restoreStudent,
  },
  catalog: {
    listPrograms: catalog.listPrograms,
    createProgram: catalog.createProgram,
    updateProgram: catalog.updateProgram,
    setProgramActive: catalog.setProgramActive,
    listCurricula: catalog.listCurricula,
    createCurriculum: catalog.createCurriculum,
    setCurriculumActive: catalog.setCurriculumActive,
    listSubjects: catalog.listSubjects,
    createSubject: catalog.createSubject,
    updateSubject: catalog.updateSubject,
    setSubjectActive: catalog.setSubjectActive,
    listCurriculumSubjects: catalog.listCurriculumSubjects,
    mapSubject: catalog.mapSubjectToCurriculum,
    unmapSubject: catalog.unmapSubject,
    importCurriculum: catalog.importCurriculum,
    listSections: catalog.listSections,
    createSection: catalog.createSection,
    setSectionActive: catalog.setSectionActive,
    listAcademicYears: catalog.listAcademicYears,
    listSemesters: catalog.listSemesters,
    getActiveSemesterFor: catalog.getActiveSemesterFor,
    listActiveSemesters: catalog.listActiveSemesters,
    createSemester: catalog.createSemester,
    createAcademicYear: catalog.createAcademicYear,
    setSemesterActive: catalog.setSemesterActive,
  },
  enrollment: {
    options: enrollment.getEnrollmentOptions,
    create: enrollment.createEnrollment,
    list: enrollment.listEnrollments,
    drop: enrollment.dropEnrollment,
  },
  grades: {
    classRoster: grades.getClassRoster,
    encodableClasses: grades.encodableClasses,
    studentSheet: grades.getStudentGradeSheet,
    save: grades.saveGrades,
  },
  gradingSheets: {
    myClasses: gradingSheets.myClasses,
    forClass: gradingSheets.getSheetForClass,
    byReference: gradingSheets.getSheetByReference,
    submit: gradingSheets.submitGradingSheet,
    list: gradingSheets.listGradingSheets,
    get: gradingSheets.getGradingSheet,
    approve: gradingSheets.approveGradingSheet,
    markPending: gradingSheets.markGradingSheetPending,
    semesters: gradingSheets.gradingSheetSemesters,
  },
  records: {
    get: records.getAcademicRecord,
    completeInc: records.completeInc,
    correctInc: records.correctInc,
    gradeSheet: records.getGradeSheet,
  },
  documents: {
    listRequests: documents.listRequests,
    eligibleStudents: documents.documentEligibleStudents,
    createRequest: documents.createRequest,
    updateRequestStatus: documents.updateRequestStatus,
    checkGate: documents.checkGenerationGate,
    generate: documents.generateDocument,
    listGenerated: documents.listGeneratedDocuments,
    getGenerated: documents.getGeneratedDocument,
    scheduleAssessment: documents.computeScheduleAssessment,
    scheduleAssessmentForSection: documents.computeScheduleAssessmentForSection,
    sendScheduleAssessmentForSection: documents.sendScheduleAssessmentForSection,
  },
  /**
   * The public surface. These two are the only entries here that do not
   * require a signed-in user — see the note at the top of the service.
   */
  applications: {
    submit: applications.submitApplication,
    lookup: applications.lookupApplication,
  },
  enrollmentDocuments: {
    checklist: enrollmentDocuments.getChecklist,
    record: enrollmentDocuments.recordEnrollmentDocument,
    remove: enrollmentDocuments.removeEnrollmentDocument,
    setDriveFolder: enrollmentDocuments.setStudentDriveFolder,
    clearDriveFolder: enrollmentDocuments.clearStudentDriveFolder,
  },
  transcripts: {
    get: transcripts.getTorDocument,
    upload: transcripts.uploadTor,
    remove: transcripts.removeTor,
    listPrevious: transcripts.listPreviousRecords,
    addPrevious: transcripts.addPreviousRecord,
    removePrevious: transcripts.removePreviousRecord,
  },
  schedules: {
    list: schedules.listSchedules,
    get: schedules.getScheduleView,
    create: schedules.createSchedule,
    update: schedules.updateSchedule,
    publish: schedules.publishSchedule,
    unpublish: schedules.unpublishSchedule,
    remove: schedules.deleteSchedule,
    forSection: schedules.schedulesForSection,
    importFacultyAndSchedules: schedules.importFacultyAndSchedules,
  },
  users: {
    list: users.listUsers,
    get: users.getUserView,
    create: users.createUser,
    setStatus: users.setUserStatus,
    resetPassword: users.resetPassword,
    listFaculty: users.listAllFaculty,
    auditLogs: users.listAuditLogs,
    auditActions: users.auditActionOptions,
    auditRecordTypes: users.auditRecordTypes,
  },
  mine: {
    schedule: mine.myWeeklySchedule,
    record: mine.myAcademicRecord,
    scheduleAssessment: mine.myScheduleAssessment,
    studentId: mine.myStudentIdOrThrow,
    notifications: mine.myNotifications,
    unreadCount: mine.myUnreadCount,
    markRead: mine.markNotificationRead,
    markAllRead: mine.markAllNotificationsRead,
  },
} as const;

export type ServerApi = typeof serverApi;
