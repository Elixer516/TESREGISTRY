/**
 * Walkthroughs for trainers and trainees — the Instruction Center as each of
 * them sees it. Same shape as the Registrar's, so one page renders all three.
 */

import type { Walkthrough } from './walkthroughs';

export const TRAINER_WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'trainer-submit-sheet',
    title: 'Submitting a grading sheet',
    summary: 'Enter each trainee’s percentage, attach your class record, and send the sheet to the Registrar.',
    overview:
      'Every class you are assigned has one grading sheet. You enter a percentage for each trainee and the system works out the grade (1.00–5.00). Nothing reaches a trainee’s record until the Registrar approves the sheet.',
    prerequisites: [
      'The class is published and has trainees enrolled in it.',
      'Your class record is ready — as a PDF or Excel file, or a Google Drive link.',
    ],
    flow: ['Open the class', 'Enter percentages', 'Attach the class record', 'Submit', 'Registrar approves'],
    steps: [
      {
        title: 'Open the class',
        detail:
          'Grading Sheets lists every class you handle, with its deadline. Press Open on the class you are grading.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'Enter a percentage per trainee',
        detail:
          'Type the final percentage, e.g. 87. The grade beside it fills itself in. For a trainee who did not finish, choose INC; for one who stopped attending, DRP. Do not type a grade such as 2.00 in the percentage box — it will be refused.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'Attach your class record',
        detail:
          'Optional, but it saves the Registrar asking. Upload a PDF or Excel file (up to 10 MB), or paste a Google Drive link.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'Submit',
        detail:
          'Submit sends the sheet to the Registrar and gives it a reference number (GS-…). You cannot change it while it is with the Registrar.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
    ],
    mistakes: [
      'Typing grade points (1.75) instead of percentages (88).',
      'Leaving a row empty — the sheet cannot be submitted until every trainee has a percentage or a mark.',
    ],
    troubleshooting: [
      { problem: 'A trainee is missing from my sheet.', fix: 'They are not enrolled in this class. Ask the Registrar to check their enrolment.' },
      { problem: 'My class does not appear.', fix: 'The class has not been published yet, or is assigned to another trainer. Ask the Registrar.' },
    ],
    reminders: ['Grades post to trainee records only when the Registrar approves the sheet.'],
  },
  {
    id: 'trainer-deadline',
    title: 'Grade deadlines',
    summary: 'Each semester has a day grades are due. Your class list counts down to it, and counts the days you are late.',
    overview:
      'The Registrar sets when each semester’s grading sheets are due. Your Grading Sheets list shows, for every class, how many days are left or how many days late the sheet is. When a sheet is due within the week or overdue, the Registrar is notified as well.',
    prerequisites: ['The Registrar has set a deadline for the semester.'],
    flow: ['Check the Deadline column', 'Submit before the due date', 'A late sheet shows how late it was'],
    steps: [
      {
        title: 'Check the Deadline column',
        detail:
          '“Due in 4 days” is still on time. “3 days late” means the due date has passed and the sheet is not in. After you submit, it reads “Submitted on time” or “Submitted 2 days late”.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
    ],
    mistakes: ['Saving a draft and forgetting to submit. Only a submitted sheet stops the count.'],
    troubleshooting: [
      { problem: 'The deadline looks wrong.', fix: 'The Registrar sets it per semester under School Years & Semesters. Ask them to adjust it.' },
    ],
    reminders: ['Late sheets hold up the next enrolment: a trainee cannot move on until every grade is in.'],
  },
  {
    id: 'trainer-sent-back',
    title: 'When a sheet is sent back',
    summary: 'The Registrar can return a sheet for correction. Reopen it with its reference number.',
    overview:
      'If something on your sheet needs fixing, the Registrar marks it Pending with a note and gives you the reference number. You correct it and submit again.',
    prerequisites: ['The reference number of the sheet (GS-…).'],
    flow: ['Enter the reference number', 'Read the Registrar’s note', 'Correct and resubmit'],
    steps: [
      {
        title: 'Reopen the sheet',
        detail: 'At the top of Grading Sheets, enter the reference number and press Open sheet.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
      {
        title: 'Correct and resubmit',
        detail: 'Read the Registrar’s remarks, correct the rows, and submit again. The submission count goes up by one.',
        link: '/grading-sheets',
        linkLabel: 'Grading Sheets',
      },
    ],
    mistakes: ['Starting a new sheet instead of reopening the returned one.'],
    troubleshooting: [{ problem: 'The number is not found.', fix: 'It only opens your own sheets. Check the number with the Registrar.' }],
    reminders: [],
  },
  {
    id: 'trainer-evaluation-results',
    title: 'Your faculty evaluation results',
    summary: 'How trainees rated your classes — combined, anonymous, and only after the term ends.',
    overview:
      'Trainees evaluate each trainer before they can see that subject’s grade. You see the combined ratings and comments for each class once the term is over and at least three trainees have answered — never who said what.',
    prerequisites: ['The term has ended.', 'At least three trainees in the class have evaluated you.'],
    flow: ['Term ends', 'Open My Evaluation Results', 'Read ratings and comments'],
    steps: [
      {
        title: 'Open your results',
        detail: 'Each class shows its average per section of the form and the trainees’ written comments.',
        link: '/my-evaluations',
        linkLabel: 'My Evaluation Results',
      },
    ],
    mistakes: [],
    troubleshooting: [{ problem: 'A class has no results.', fix: 'The term is still running, or fewer than three trainees have answered.' }],
    reminders: ['Results never show while you still have grades to give that class.'],
  },
  {
    id: 'trainer-head',
    title: 'For head trainers: Diploma Grades',
    summary: 'See every class and trainee of the diploma you head — your own classes and every other trainer’s.',
    overview:
      'A head trainer has an extra page, Diploma Grades. It lists every class of the diploma with its sheet status, the grades it posted and its deadline, and lets you open any trainee’s Grade Evaluation. It is read-only: grades are still entered by each class’s trainer.',
    prerequisites: ['Your account is marked as the diploma’s head trainer.'],
    flow: ['Open Diploma Grades', 'Check classes and deadlines', 'Open a trainee’s Grade Evaluation'],
    steps: [
      {
        title: 'Classes & grades',
        detail: 'Filter to open semesters or to your own classes. View grades opens the sheet of any class.',
        link: '/diploma-grades',
        linkLabel: 'Diploma Grades',
      },
      {
        title: 'Trainees',
        detail: 'Search a trainee to see their whole Grade Evaluation, including backlogs.',
        link: '/diploma-grades',
        linkLabel: 'Diploma Grades',
      },
    ],
    mistakes: [],
    troubleshooting: [{ problem: 'I do not see Diploma Grades.', fix: 'Only head trainers have it. Ask the Registrar to confirm your role.' }],
    reminders: [],
  },
];

export const TRAINEE_WALKTHROUGHS: Walkthrough[] = [
  {
    id: 'trainee-first-sign-in',
    title: 'Signing in for the first time',
    summary: 'Your ID Number is your username. Change the default password the first time you sign in.',
    overview:
      'Once your application is approved, you sign in with your ID Number (for example 2026-00010) and the default password the Registrar gives you. You are asked to choose your own password straight away.',
    prerequisites: ['Your application has been approved.'],
    flow: ['Sign in with your ID Number', 'Choose a new password', 'Open your portal'],
    steps: [
      {
        title: 'Choose your own password',
        detail: 'At least 8 characters. You can change it again any time from Profile.',
        link: '/portal/profile',
        linkLabel: 'Profile',
      },
    ],
    mistakes: ['Signing in with your email address — use your ID Number.'],
    troubleshooting: [{ problem: 'I forgot my password.', fix: 'Ask the IT Office to reset it. You will choose a new one when you next sign in.' }],
    reminders: [],
  },
  {
    id: 'trainee-grades',
    title: 'Seeing your grades',
    summary: 'Evaluate each subject’s trainer to unlock its grade, then confirm you have viewed the term’s grades.',
    overview:
      'Grades appear once the Registrar approves them. Each one stays hidden until you evaluate that subject’s trainer. When every grade of a term is in, confirm you have viewed them — you cannot be enrolled in your next term until you do.',
    prerequisites: ['Your trainers have submitted grades and the Registrar has approved them.'],
    flow: ['Evaluate your trainers', 'See your grades', 'Confirm you have viewed them'],
    steps: [
      {
        title: 'Evaluate your trainers',
        detail: 'Evaluations lists every subject waiting. Each takes about five minutes; your answers are anonymous to the trainer.',
        link: '/portal/evaluations',
        linkLabel: 'Evaluations',
      },
      {
        title: 'Read your grades',
        detail: 'Grades shows one semester at a time, or All semesters. Your units and general weighted average appear when the term is complete.',
        link: '/portal/grades',
        linkLabel: 'Grades',
      },
      {
        title: 'Confirm you have viewed them',
        detail: 'Press “I have viewed these grades” on the term. The Registrar needs this before your next enrolment.',
        link: '/portal/grades',
        linkLabel: 'Grades',
      },
      {
        title: 'Print your Grade Evaluation',
        detail: 'Grade Evaluation shows your whole record in the centre’s form — including any backlogs — ready to print.',
        link: '/portal/grade-evaluation',
        linkLabel: 'Grade Evaluation',
      },
    ],
    mistakes: ['Waiting to evaluate — your next enrolment needs every evaluation done.'],
    troubleshooting: [{ problem: 'A subject still says Enrolled.', fix: 'Your trainer has not submitted, or the Registrar has not approved, its grades yet.' }],
    reminders: ['A grade the Registrar later corrects asks you to confirm viewing again.'],
  },
  {
    id: 'trainee-cor',
    title: 'Your schedule and Certificate of Registration',
    summary: 'Your weekly classes, and your Certificate of Registration (COR) to print.',
    overview:
      'Schedule shows the classes you are enrolled in this term. Your Certificate of Registration (COR) lists your subjects, units and schedule for the term — the same one the Registrar issues.',
    prerequisites: ['You are enrolled in the current term.'],
    flow: ['Open Schedule', 'Open Certificate of Registration', 'Print'],
    steps: [
      { title: 'Your week', detail: 'Every class with its day, time, room and trainer.', link: '/portal/schedule', linkLabel: 'Schedule' },
      {
        title: 'Certificate of Registration',
        detail: 'Press Print or save it as PDF from your browser.',
        link: '/portal/registration',
        linkLabel: 'Certificate of Registration',
      },
    ],
    mistakes: [],
    troubleshooting: [{ problem: 'My schedule is empty.', fix: 'You are not enrolled yet this term, or your classes have not been published.' }],
    reminders: [],
  },
  {
    id: 'trainee-requests',
    title: 'Requesting a document',
    summary: 'Ask the Registrar for a TOR, Certification of Grades and others, and follow it to release.',
    overview:
      'Requests lets you ask for a document without queueing first. The Registrar works it through Processing and Ready for release; you collect it at the Registrar’s window when it is ready, quoting the reference number.',
    prerequisites: [],
    flow: ['Choose the document', 'Say what it is for', 'Follow its status', 'Collect it'],
    steps: [
      {
        title: 'Make the request',
        detail: 'Choose the document, the number of copies and the purpose (for example “Scholarship renewal”).',
        link: '/portal/requests',
        linkLabel: 'Requests',
      },
      {
        title: 'Follow it',
        detail: 'Pending → Processing → Ready for release. You can withdraw it while it is still Pending.',
        link: '/portal/requests',
        linkLabel: 'Requests',
      },
    ],
    mistakes: ['Requesting the same document twice — finish or withdraw the first request.'],
    troubleshooting: [{ problem: 'My request was cancelled.', fix: 'The Registrar’s reason is shown on the request. File a new one if needed.' }],
    reminders: ['A Diploma or Special Order copy can be requested once you have graduated.'],
  },
  {
    id: 'trainee-progress',
    title: 'Your curriculum and progress',
    summary: 'See every subject of your diploma, what you have passed, and how far you are from graduating.',
    overview:
      'Home shows your completion, GWA and best and lowest grades. My Curriculum lists every subject of your diploma, term by term, with your grade or status in each — including subjects credited from a previous school.',
    prerequisites: [],
    flow: ['Open Home', 'Open My Curriculum'],
    steps: [
      { title: 'At a glance', detail: 'Program completion is the share of your curriculum’s units you have earned.', link: '/portal', linkLabel: 'Home' },
      { title: 'Subject by subject', detail: 'Filter to what is done or still to do.', link: '/portal/curriculum', linkLabel: 'My Curriculum' },
    ],
    mistakes: [],
    troubleshooting: [],
    reminders: [],
  },
];
