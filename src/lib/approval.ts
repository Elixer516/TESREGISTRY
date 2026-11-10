/**
 * What an application must carry before the Registrar can approve it.
 *
 * Approval is where a record becomes a trainee — enrolment, the MIS report
 * and grade deadlines all read these — so an application missing any of
 * them is held at Pending until the Registrar fills them in under Edit.
 *
 * Shared by the server, which refuses the approval, and the screens, which
 * say what is missing before anyone clicks.
 */

interface ApprovalFields {
  assignedBatch?: string | null;
  scholarshipType?: string | null;
  otherScholarship?: string | null;
  classification?: string | null;
}

/** The labels of the details still missing; empty when it may be approved. */
export function missingForApproval(student: ApprovalFields): string[] {
  const missing: string[] = [];
  if (!student.assignedBatch?.trim()) missing.push('Batch');
  if (!student.scholarshipType?.trim()) missing.push('Scholarship Package');
  if (!student.otherScholarship?.trim()) missing.push('Other Scholarship Availed');
  if (!student.classification?.trim()) missing.push('Classification');
  return missing;
}
