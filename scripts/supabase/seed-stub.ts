/**
 * Stands in for src/server/data/seed.ts inside the `api` Edge Function.
 *
 * On Supabase the records come from the database on every request, so the
 * demonstration dataset (and its ~150 KB of curricula) is never needed there.
 * Restoring the demo data is refused by the function before it could get here.
 */

import type { Database } from '../../src/server/repositories/db';

export function createSeedDatabase(): Database {
  return {
    users: [], faculty: [], students: [], programs: [], curricula: [], subjects: [], programSubjects: [],
    academicYears: [], semesters: [], sections: [], classSchedules: [], facultyAssignments: [], enrollments: [],
    enrollmentSubjects: [], gradeCompletions: [], gradingSheets: [], dropCases: [], facultyEvaluations: [],
    previousSchoolRecords: [], subjectCredits: [], documentRequests: [], requirementReceipts: [],
    gradeDeadlineOverrides: [], enrollmentDocuments: [], auditLogs: [],
  } as Database;
}

export const DEMO_ACCOUNTS: never[] = [];
