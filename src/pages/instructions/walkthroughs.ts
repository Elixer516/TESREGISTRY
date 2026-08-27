/**
 * The walkthroughs.
 *
 * Content lives here rather than inside JSX so it stays searchable as plain
 * data and the page component only has to render it.
 *
 * V9 rewrote these to mirror the one path the system now serves, end to end:
 *
 *   set up the year and semester → applicant files → registrar reviews,
 *   edits and approves → registrar enrols → trainer submits a grading sheet
 *   → registrar reviews and approves → the Grade Evaluation Form and GSA
 *   generate from the result
 *
 * Walkthroughs for the modules V9 removed — document requests, transcript
 * upload, user administration — are gone with them.
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
    id: 'open-the-semester',
    title: 'Opening a semester for a Diploma',
    summary: 'The first thing that happens in a cycle. Nothing can be enrolled until it exists.',
    overview:
      'Every Diploma keeps its own calendar, and its Year 1, 2 and 3 cohorts run side by side. A semester is therefore addressed as a Diploma, a year level and a half of the year — "IT, First Year, 1st Semester" — and each one is created and opened deliberately.',
    prerequisites: [
      'The Diploma exists in the Academic Catalog with a curriculum behind it.',
      'You know the start and end dates the Diploma is running to.',
    ],
    flow: [
      'Create the school year and its first semester together',
      'Add the remaining semesters per Diploma and year level',
      'Open the one enrollment is about to happen in',
    ],
    steps: [
      {
        title: 'Create the school year and semester together',
        detail:
          'Use New school year & semester. Pick an existing school year, or choose "New school year…" to create one inline — the year and its first semester are created in a single action, because a school year with no semesters cannot be enrolled into.',
        link: '/terms',
        linkLabel: 'School Years & Semesters',
      },
      {
        title: 'Add the rest',
        detail:
          'Repeat for each Diploma and year level that is running. Each carries its own start and end dates; they do not have to match another Diploma’s.',
        link: '/terms',
        linkLabel: 'School Years & Semesters',
      },
      {
        title: 'Open it',
        detail:
          'Expand the Diploma and press Open on the semester enrollment is about to happen in. Opening one closes any other semester for that same Diploma and year level — never for a different Diploma.',
        link: '/terms',
        linkLabel: 'School Years & Semesters',
      },
    ],
    mistakes: [
      'Expecting one active semester across the whole centre. Several are open at once by design — one per Diploma and year level.',
      'Creating the school year and then forgetting the semester. The single form exists so that cannot happen.',
    ],
    troubleshooting: [
      {
        problem: 'It refuses with "already has a … for that year".',
        fix: 'That Diploma, year level and semester already exists for the school year. Expand the Diploma to find it rather than creating a second.',
      },
      {
        problem: 'Enrollment says there is no open semester.',
        fix: 'A semester existing is not the same as it being open. Expand the Diploma and press Open.',
      },
    ],
    reminders: [
      'Only 2026-2027 is seeded. Earlier years are typed in by hand if a record needs them.',
    ],
  },

  {
    id: 'review-an-application',
    title: 'Reviewing, correcting and approving an application',
    summary: 'What arrives from the public form, and how to get it onto the roll.',
    overview:
      'An application filed on the public form lands in Students → Pending with the two documents the applicant uploaded already attached. It is typed by the applicant, so reading it and correcting it is the normal first move — approval is what assigns the curriculum and section, and cannot be undone by editing afterwards.',
    prerequisites: [
      'The Diploma has a curriculum and at least one section.',
      'A semester is open for that Diploma and year level, if you intend to enrol them straight away.',
    ],
    flow: ['Open the record', 'Correct anything wrong', 'Check the documents', 'Approve'],
    steps: [
      {
        title: 'Open the application',
        detail:
          'Students → Pending → View. The record opens on Details, with the reference code the applicant was given shown beside their student number.',
        link: '/students',
        linkLabel: 'Students',
      },
      {
        title: 'Correct what the applicant mistyped',
        detail:
          'Press Edit inside the record. Every field becomes editable in place except the student number and reference code, which identify them on documents already issued. Correcting the name also renames their folder in Google Drive.',
        link: '/students',
        linkLabel: 'Students',
      },
      {
        title: 'Check the documents',
        detail:
          'The Documents tab shows the admission checklist for their declared standing — a Senior High graduate is offered a Form 138 and refused a Transcript of Records; a college transferee the reverse. Their ID picture and birth certificate are already filed.',
        link: '/students',
        linkLabel: 'Students',
      },
      {
        title: 'Approve',
        detail:
          'Approve is on both tabs, so you can approve straight from the documents you were just checking. Approving assigns the curriculum and the section — that is what makes the trainee enrollable.',
        link: '/students',
        linkLabel: 'Students',
      },
    ],
    mistakes: [
      'Approving before correcting the name. The name becomes the Drive folder and prints on every document.',
      'Expecting to change the Diploma after approval. It is fixed once a curriculum and section are attached.',
    ],
    troubleshooting: [
      {
        problem: 'The Diploma dropdown is read-only.',
        fix: 'The application has already been approved. The Diploma is editable only while it is still Pending.',
      },
      {
        problem: 'Rejecting deleted their uploaded documents.',
        fix: 'That is intended — the folder is moved to the Drive trash, where it stays recoverable for 30 days.',
      },
    ],
    reminders: [
      'The applicant only ever uploads twice: an ID picture and a birth certificate. Everything else is brought to the office.',
    ],
  },

  {
    id: 'enrol-a-trainee',
    title: 'Enrolling a trainee into a semester',
    summary: 'Choosing subjects, and what the grade gate refuses.',
    overview:
      'Enrollment attaches a trainee to the open semester for their Diploma and year level, and to the subjects their curriculum requires there. A trainee cannot enrol until the semester immediately before it has all their grades in.',
    prerequisites: [
      'The trainee is approved, with a curriculum and a section.',
      'The semester is open for their Diploma and year level.',
    ],
    flow: ['Find the trainee', 'Read what they already have', 'Select subjects', 'Save'],
    steps: [
      {
        title: 'Find the trainee',
        detail:
          'Enrollment → choose a trainee by name or student number. What they are already enrolled in for that semester is shown first, so you can see the current state before changing it.',
        link: '/enrollment',
        linkLabel: 'Enrollment',
      },
      {
        title: 'Check the grade gate',
        detail:
          'If their preceding semester is not fully graded, a warning names the outstanding subjects. The trainer must submit the grading sheet and you must approve it — or you override with a reason, which is written to the audit log.',
        link: '/enrollment',
        linkLabel: 'Enrollment',
      },
      {
        title: 'Select subjects and save',
        detail:
          'Only subjects the curriculum places at that year level and semester are offered. Anything already passed is shown but cannot be selected again.',
        link: '/enrollment',
        linkLabel: 'Enrollment',
      },
    ],
    mistakes: [
      'Trying to enrol someone twice in one semester. One enrollment per trainee per semester, by design.',
      'Overriding the gate out of habit. The reason is required and permanent.',
    ],
    troubleshooting: [
      {
        problem: 'No subjects are offered.',
        fix: 'The curriculum has nothing mapped at that year level and semester. Check it under Academic Catalog.',
      },
      {
        problem: 'The trainee cannot be found.',
        fix: 'They are probably still Pending. Only approved trainees can be enrolled.',
      },
    ],
    reminders: [
      'Enrolling a trainee puts them on the trainer’s class list and on that class’s grading sheet immediately.',
    ],
  },

  {
    id: 'grading-sheets',
    title: 'Grading sheets: submission and review',
    summary: 'The trainer encodes, the registrar reviews. Grades post only on approval.',
    overview:
      'The registrar no longer types grades. A trainer fills in their own class’s sheet and submits it; it is given a reference number and waits for review. Approving is the only path by which a grade reaches a trainee’s record — a submitted sheet posts nothing.',
    prerequisites: [
      'Trainees are enrolled in the class, so the roster has names on it.',
      'The trainer has an account and the class is assigned to them.',
    ],
    flow: ['Trainer submits', 'Registrar reviews', 'Approve, or send back as Pending'],
    steps: [
      {
        title: 'The trainer fills in the sheet',
        detail:
          'Grading Sheets shows only their own classes. Grades are entered on the 1.00–5.00 scale — 1.00 highest, 3.00 the passing mark and the 75% equivalent. For anyone without a number, INC, DRP or NG. Every row must carry something.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'The registrar reviews',
        detail:
          'The review queue lists every sheet with its reference number and status. The table reads Grade, Units, Completion — Completion stays blank until an INC is resolved.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'Approve, or send it back',
        detail:
          'If anything is wrong, mark it Pending with a remark and call the trainer. They reopen it by reference number and edit what is there — it is never a blank re-entry. Approving posts the grades.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
    ],
    mistakes: [
      'Entering a percentage. The scale is 1.00 to 5.00; a percentage is refused.',
      'Expecting a submitted sheet to have posted its grades. Only approval does that.',
    ],
    troubleshooting: [
      {
        problem: 'A sheet cannot be approved.',
        fix: 'Some rows have no grade. Send it back as Pending rather than approving an incomplete roster.',
      },
      {
        problem: 'A trainee is missing from the roster.',
        fix: 'They are not enrolled in that class. Enrol them and the sheet picks them up.',
      },
    ],
    reminders: [
      'INC is carried on the sheet and becomes the grade on the record. The resolving grade goes in Completion later.',
    ],
  },

  {
    id: 'evaluation-and-inc',
    title: 'The Grade Evaluation Form, and resolving an INC',
    summary: 'A trainee’s full record, and why an average sometimes reads 0.000.',
    overview:
      'The Grade Evaluation Form compiles every subject a trainee has taken, with the grades and the prerequisites behind each. It is derived on read, so it always reflects the record as it stands. It generates whether or not every grading sheet is in.',
    prerequisites: ['The trainee has at least one enrollment on record.'],
    flow: ['Find the trainee', 'Resolve any INC', 'Generate the form'],
    steps: [
      {
        title: 'Find the trainee',
        detail:
          'Grade Evaluation → find a trainee. The summary shows how many semesters are on record, the total units and the general weighted average.',
        link: '/evaluation',
        linkLabel: 'Grade Evaluation',
      },
      {
        title: 'Resolve any INC',
        detail:
          'An unresolved INC forces the average to 0.000 — both for its semester and overall. Any outstanding ones are listed with a Resolve button. Completing an INC keeps it visible in the Grades column and puts the resolving grade in Completion; correcting it replaces the grade outright.',
        link: '/evaluation',
        linkLabel: 'Grade Evaluation',
      },
      {
        title: 'Generate and print',
        detail:
          'Generate form opens the printable evaluation: one block per semester with a units summary of Enrolled, Considered, Passed and No Credit, and the same again overall.',
        link: '/evaluation',
        linkLabel: 'Grade Evaluation',
      },
    ],
    mistakes: [
      'Reading a 0.000 average as a failing one. It means an INC is outstanding, or nothing in that semester is graded yet.',
      'Expecting the form to be frozen. It is derived on read and changes as grades are approved.',
    ],
    troubleshooting: [
      {
        problem: 'The average is 0.000 and there is no INC.',
        fix: 'Nothing in that semester is graded yet. Considered units will read 0.',
      },
      {
        problem: 'A subject shows no prerequisite.',
        fix: 'The curriculum does not record one for it. Prerequisites are set per subject under Academic Catalog.',
      },
    ],
    reminders: [
      'Only the registrar resolves an INC. The trainer’s part ended when the sheet was approved.',
    ],
  },

  {
    id: 'generate-gsa',
    title: 'Generating a GSA',
    summary: 'A trainee’s weekly schedule and load for the semester they are in.',
    overview:
      'The General Schedule and Assessment prints what a trainee is studying right now: the subjects on their current enrollment, the units those carry, and the class schedule behind each. It resolves against their own Diploma and year level, not a centre-wide term.',
    prerequisites: [
      'The trainee is enrolled in the open semester for their Diploma and year level.',
      'The classes they are enrolled in have published schedules.',
    ],
    flow: ['Find the trainee', 'Read the sheet', 'Print'],
    steps: [
      {
        title: 'Find the trainee',
        detail: 'GSA → choose a trainee by name or student number.',
        link: '/gsa',
        linkLabel: 'GSA',
      },
      {
        title: 'Print',
        detail:
          'The sheet shows the weekly grid and the subject list with units. Print uses the Long Bond layout the centre files.',
        link: '/gsa',
        linkLabel: 'GSA',
      },
    ],
    mistakes: [
      'Expecting grades on it. The GSA is a statement of what they are studying, not of results — that is the Grade Evaluation Form.',
    ],
    troubleshooting: [
      {
        problem: 'The sheet is empty.',
        fix: 'They are not enrolled in the open semester for their Diploma and year level. Enrol them first.',
      },
      {
        problem: 'Subjects appear but the grid is empty.',
        fix: 'Their classes have no published schedule. Publish them under Class Schedules.',
      },
    ],
    reminders: ['The GSA always describes the currently open semester, never a past one.'],
  },
];
