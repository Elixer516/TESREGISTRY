/**
 * The Registrar walkthroughs.
 *
 * Content lives here rather than inside JSX so it stays searchable as plain
 * data and the page component only has to render it.
 */

export interface WalkthroughStep {
  title: string;
  detail: string;
  /** Deep link into the real screen this step happens on. */
  link: string;
  linkLabel: string;
}

export interface Walkthrough {
  id: string;
  title: string;
  summary: string;
  overview: string;
  prerequisites: string[];
  flow: string[];
  steps: WalkthroughStep[];
  mistakes: string[];
  troubleshooting: Array<{ problem: string; fix: string }>;
  reminders: string[];
}

export const WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'enroll-first-year',
    title: 'Enrolling a first-year student',
    summary: 'From a new application through to an enrollment in the active term.',
    overview:
      'A new trainee starts as a pending application. Approving them is what assigns the curriculum, and the curriculum is what the enrollment screen reads to decide which subjects they may take. Skipping the approval step leaves you with a student who cannot be enrolled at all.',
    prerequisites: [
      'The program exists and has a curriculum with subjects mapped for Year 1.',
      'A term is set as active under School Years and Terms.',
      'A section exists for the program and year level, if you want the student in one.',
    ],
    flow: [
      'Record the application',
      'Approve it and assign a curriculum',
      'Open Enrollment and pick the student',
      'Choose the term',
      'Select the subjects',
      'Save the enrollment',
    ],
    steps: [
      {
        title: 'Record the application',
        detail:
          'Students → Add student, or import a CSV if you have a batch. Either way the record is created as PENDING. The student number must be unique; a duplicate is refused with a clear message rather than silently overwriting anything.',
        link: '/students',
        linkLabel: 'Open Students',
      },
      {
        title: 'Approve and assign a curriculum',
        detail:
          'On the Pending tab, press Approve. The curriculum field is required — this is the moment the student gains one. Assigning a section here is optional and can be done later from Edit.',
        link: '/students',
        linkLabel: 'Open Students',
      },
      {
        title: 'Open Enrollment and choose the student',
        detail:
          'The student picker only lists approved, active and inactive students, so a pending applicant will not appear. Search by name or student number.',
        link: '/enrollment',
        linkLabel: 'Open Enrollment',
      },
      {
        title: 'Pick the term',
        detail:
          'Choose the school year and term. The subject list is built from the student’s curriculum for their year level and that term — not the whole catalog.',
        link: '/enrollment',
        linkLabel: 'Open Enrollment',
      },
      {
        title: 'Select subjects and save',
        detail:
          'Tick the subjects. Anything already passed is disabled with the grade shown, so you can see why. The units are copied onto the enrollment at this moment; changing the subject later will not move them. The whole enrollment saves or none of it does.',
        link: '/enrollment',
        linkLabel: 'Open Enrollment',
      },
    ],
    mistakes: [
      'Trying to enroll a pending applicant. Approve them first — approval is what assigns the curriculum.',
      'Expecting to pick any subject from the catalog. Only the student’s curriculum for that year level and term is offered.',
      'Enrolling the same student twice in one term. The second attempt is refused; edit the existing enrollment instead.',
    ],
    troubleshooting: [
      {
        problem: 'The subject list is empty.',
        fix: 'The curriculum has nothing mapped at that year level and term. Map subjects yourself under Academic Catalog.',
      },
      {
        problem: 'The student does not appear in the picker.',
        fix: 'They are probably still pending or were rejected. Check the Students screen tabs.',
      },
      {
        problem: 'A subject shows "no published class yet".',
        fix: 'You can still enroll them; the row simply has no schedule attached. Once you publish the class under Class Schedules, future enrollments will link to it.',
      },
    ],
    reminders: [
      'Approval assigns the curriculum. Nothing downstream works without it.',
      'Units are snapshotted at enrollment time, on purpose.',
      'One enrollment per student per term, enforced by the server.',
    ],
  },
  {
    id: 'generate-term-grades',
    title: 'Generating grades for a term',
    summary: 'Encoding grades for a whole class or one student, then printing the grade sheet.',
    overview:
      'Grades can only be encoded for the active term. Everything else is read-only, which is what stops a closed term being quietly edited months later. The Registrar encodes grades for any class.',
    prerequisites: [
      'The term you are encoding is the active term.',
      'Students are enrolled in that term.',
      'For the by-class workflow, the class schedule is published.',
    ],
    flow: [
      'Confirm the active term',
      'Choose by class or by student',
      'Pick the class or the student',
      'Type the grades',
      'Save',
      'Print the grade sheet',
    ],
    steps: [
      {
        title: 'Confirm which term is active',
        detail:
          'School Years and Terms shows the active term and lets you change it. Only one term is active at a time — that is what opens encoding.',
        link: '/terms',
        linkLabel: 'Open School Years & Terms',
      },
      {
        title: 'Choose the workflow',
        detail:
          'By class gives you the full roster of one class in one table. By student shows one student’s subjects for a term, which is faster when you are chasing a single missing grade.',
        link: '/grades',
        linkLabel: 'Open Grades',
      },
      {
        title: 'Type the grades',
        detail:
          'Valid entries are 1.00 to 5.00, or INC. 3.00 is the passing cutoff. Values are normalised to two decimals when saved. Anything outside the scale — 9.99, for instance — is rejected outright rather than clamped.',
        link: '/grades',
        linkLabel: 'Open Grades',
      },
      {
        title: 'Save',
        detail:
          'The whole batch is validated before any of it is written, so one bad entry does not leave you with a half-saved table.',
        link: '/grades',
        linkLabel: 'Open Grades',
      },
      {
        title: 'Print the grade sheet',
        detail:
          'Academic Records → pick the student → Grade sheet on the term you want. The sheet is laid out for Long Bond paper and prints in the light palette whatever theme you are using.',
        link: '/records',
        linkLabel: 'Open Academic Records',
      },
    ],
    mistakes: [
      'Encoding into a closed term. It is refused — activate the term first.',
      'Entering a percentage such as 85. This scale runs 1.00 to 5.00, where 1.00 is the highest.',
    ],
    troubleshooting: [
      {
        problem: 'Everything is read-only.',
        fix: 'The term is not active. The banner on the panel says so — activate it under School Years & Terms.',
      },
      {
        problem: 'The class does not appear in the picker.',
        fix: 'It is not published, or it belongs to a different term. Publish it under Class Schedules.',
      },
      {
        problem: 'A GWA reads 0.000.',
        fix: 'That term has an unresolved INC. Complete or correct it in Academic Records.',
      },
    ],
    reminders: [
      'INC is a valid grade. It is not a blank.',
      'Clearing a grade also clears any completion recorded against it.',
      'Every save is written to the audit log with the values before and after.',
    ],
  },
  {
    id: 'enroll-next-semester',
    title: 'Enrolling a student into the next semester',
    summary: 'Rolling a continuing student forward once the previous term is graded.',
    overview:
      'Enrollment for the next term reads the same curriculum, but at whichever year level the student record now says. Subjects they have already passed are disabled so they cannot be enrolled twice; a failed subject stays available, which is how a retake happens.',
    prerequisites: [
      'The previous term is graded, at least for the subjects that matter.',
      'The next term exists and is the active term.',
      'The student’s year level on their record is correct.',
    ],
    flow: [
      'Check last term is graded',
      'Advance the year level if needed',
      'Activate the next term',
      'Open Enrollment',
      'Select subjects and save',
    ],
    steps: [
      {
        title: 'Check the previous term',
        detail:
          'Academic Records shows every term. Anything still ungraded will not block enrollment, but it will leave the subject looking available when it may not be.',
        link: '/records',
        linkLabel: 'Open Academic Records',
      },
      {
        title: 'Advance the year level if the student is moving up',
        detail:
          'Students → Edit. The year level decides which part of the curriculum the enrollment screen offers. A second-year student still sitting at Year 1 will be offered first-year subjects.',
        link: '/students',
        linkLabel: 'Open Students',
      },
      {
        title: 'Make the next term active',
        detail:
          'School Years and Terms. Activating a term closes the previous one, which is what stops late edits to grades that have already been released.',
        link: '/terms',
        linkLabel: 'Open School Years & Terms',
      },
      {
        title: 'Enroll into the new term',
        detail:
          'Enrollment → pick the student → pick the new term. Passed subjects appear greyed with the grade that earned the pass. Failed subjects remain selectable so a retake can be enrolled.',
        link: '/enrollment',
        linkLabel: 'Open Enrollment',
      },
    ],
    mistakes: [
      'Forgetting to raise the year level, then wondering why last year’s subjects are on offer.',
      'Trying to re-enroll a passed subject. It is disabled, and the server refuses it even if the UI is bypassed.',
      'Leaving the old term active, so the new term will not accept grades later.',
    ],
    troubleshooting: [
      {
        problem: 'Every subject is greyed out.',
        fix: 'The student has passed all of them at that year level and term. Raise the year level, or check you picked the right term.',
      },
      {
        problem: 'The student is already enrolled for that term.',
        fix: 'One enrollment per student per term. Drop the existing enrollment if it was made in error.',
      },
    ],
    reminders: [
      'A failed subject stays enrollable — that is the retake path.',
      'The units on the new enrollment are read fresh from the subject at that moment, and then frozen.',
    ],
  },
  {
    id: 'generate-tor',
    title: 'Generating a Transcript of Records',
    summary: 'Raising the request, passing the validation gate, and printing.',
    overview:
      'Generation runs a validation gate before it produces anything. If the record is missing something the transcript needs — an address, a date of birth, any grades at all — it refuses and lists what is missing. That is deliberate: a transcript with blanks in it is worse than no transcript.',
    prerequisites: [
      'The student has standing at the centre: approved, active, inactive, graduated or dropped.',
      'They have a curriculum assigned and at least one graded subject.',
      'Their address and date of birth are filled in.',
    ],
    flow: [
      'Raise the request',
      'Move it to Processing',
      'Generate and clear the gate',
      'Print on Long Bond',
      'Mark it Released',
    ],
    steps: [
      {
        title: 'Raise the request',
        detail:
          'Documents → New request. The student picker only lists students with standing, so a pending or rejected applicant can never reach this screen.',
        link: '/documents',
        linkLabel: 'Open Documents',
      },
      {
        title: 'Work the pipeline',
        detail:
          'Move it Pending → Processing → Ready → Released as you actually do the work. Each change notifies whoever raised the request.',
        link: '/documents',
        linkLabel: 'Open Documents',
      },
      {
        title: 'Generate',
        detail:
          'Press Generate on the row. The gate result is shown before you commit: green means every field is present, red lists exactly what is missing. A snapshot of the data used is stored with the document, so later grade edits never rewrite an issued transcript.',
        link: '/documents',
        linkLabel: 'Open Documents',
      },
      {
        title: 'Print',
        detail:
          'The printable view is laid out for Long Bond (8.5 by 13 inches), repeats the table header on each page and never splits a row across a page break.',
        link: '/documents',
        linkLabel: 'Open Documents',
      },
    ],
    mistakes: [
      'Assuming the uploaded PDF fills in previous-school subjects. It does not — those must be typed in as rows.',
      'Generating before the address or date of birth is on file. The gate will refuse.',
      'Expecting an unresolved INC to block a transcript. It does not; it is shown, and the average reads 0.000.',
    ],
    troubleshooting: [
      {
        problem: 'Generation is refused.',
        fix: 'Read the list in the dialog. Each line names the field or condition that is missing.',
      },
      {
        problem: 'Credited subjects are missing from the transcript.',
        fix: 'Add them under Transcript Upload as previous school records. The PDF is evidence only.',
      },
      {
        problem: 'The printout is dark.',
        fix: 'It should not be — printing forces the light palette. If it is, the browser is printing background graphics; turn that off in the print dialog.',
      },
    ],
    reminders: [
      'The snapshot is frozen at generation time.',
      'The serial number on the document identifies that exact issue.',
    ],
  },
  {
    id: 'add-previous-tor',
    title: 'Adding a previous-school TOR',
    summary: 'Uploading the evidence and entering the credited subjects that actually count.',
    overview:
      'Two separate things happen here, and conflating them is the most common mistake on this screen. The uploaded PDF is stored as evidence and is never read by the system. The credited subjects that appear on a generated transcript are the rows you type in by hand underneath it.',
    prerequisites: [
      'The student record exists and is marked as a transferee, if that applies.',
      'You have the scanned transcript as a PDF.',
      'You have the previous school’s grades and units in front of you.',
    ],
    flow: [
      'Choose the student',
      'Upload the PDF',
      'Type each credited subject as a row',
      'Check the rows against the PDF',
      'Generate the transcript to confirm',
    ],
    steps: [
      {
        title: 'Choose the student',
        detail: 'Transcript Upload → pick the student by name or student number.',
        link: '/transcripts',
        linkLabel: 'Open Transcript Upload',
      },
      {
        title: 'Upload the PDF',
        detail:
          'Only PDFs are accepted, and the check reads the file’s leading bytes rather than trusting the file name. Re-uploading replaces the held copy and bumps its version instead of piling up files nobody will reconcile.',
        link: '/transcripts',
        linkLabel: 'Open Transcript Upload',
      },
      {
        title: 'Enter each credited subject',
        detail:
          'School, school year, course code, title, grade and units — one row per subject. This is the only path by which previous work reaches a transcript.',
        link: '/transcripts',
        linkLabel: 'Open Transcript Upload',
      },
      {
        title: 'Verify by generating',
        detail:
          'Generate a transcript for the student and check the credited block matches the PDF. Anything you did not type in will simply not be there.',
        link: '/documents',
        linkLabel: 'Open Documents',
      },
    ],
    mistakes: [
      'Uploading the PDF and stopping there. Nothing from the file reaches the transcript on its own.',
      'Renaming a JPG to .pdf. The magic-byte check catches it.',
      'Removing the PDF to "start again" — removal needs your password, and the credited rows are separate anyway.',
    ],
    troubleshooting: [
      {
        problem: 'The upload is rejected as not a PDF.',
        fix: 'The file’s contents are not a PDF whatever its name says. Re-export or re-scan it.',
      },
      {
        problem: 'The preview will not display.',
        fix: 'Some browsers refuse to render PDFs inline from a data URL. Use Download instead.',
      },
      {
        problem: 'The credited subjects vanished after reload.',
        fix: 'This build keeps everything in memory. A reload re-seeds the data — that is expected here, not a fault.',
      },
    ],
    reminders: [
      'Evidence and data are separate. The PDF is evidence.',
      'Removing a transcript requires re-entering your password.',
    ],
  },
];
