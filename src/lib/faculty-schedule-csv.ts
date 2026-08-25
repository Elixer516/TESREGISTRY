/**
 * Column aliases for the combined Faculty & Schedule import — one row per
 * class a trainor teaches, so the same Employee ID repeats across rows for a
 * trainor handling 2+ subjects.
 */
export const FACULTY_SCHEDULE_COLUMN_ALIASES: Record<string, string[]> = {
  employeeId: ['employee id', 'employee no', 'employee no.', 'employee number', 'emp id', 'emp no'],
  firstName: ['first name', 'firstname', 'trainor first name'],
  lastName: ['last name', 'lastname', 'surname', 'trainor last name'],
  department: ['department', 'dept'],
  position: ['position', 'title', 'designation'],
  email: ['email', 'email address', 'e-mail'],
  contactNumber: ['contact number', 'contact', 'mobile', 'mobile number', 'phone'],
  subjectCode: ['subject code', 'subject', 'course code'],
  sectionCode: ['section code', 'section'],
  days: ['days', 'day pattern', 'schedule days'],
  startTime: ['start time', 'time start', 'from'],
  endTime: ['end time', 'time end', 'to'],
  room: ['room', 'venue', 'location'],
};

export const FACULTY_SCHEDULE_REQUIRED_FIELDS = [
  'employeeId',
  'firstName',
  'lastName',
  'subjectCode',
  'sectionCode',
  'days',
  'startTime',
  'endTime',
] as const;

export const FACULTY_SCHEDULE_SAMPLE_CSV_TEMPLATE = [
  'Employee ID,First Name,Last Name,Department,Position,Email,Contact Number,Subject Code,Section Code,Days,Start Time,End Time,Room',
  'EMP-2001,Liza,Mendoza,Information Technology,Trainer,lmendoza@rtc-korphil.example.ph,0918-555-0201,IT101,IT-1A,MWF,09:00,10:00,Room 201',
  'EMP-2001,Liza,Mendoza,Information Technology,Trainer,lmendoza@rtc-korphil.example.ph,0918-555-0201,IT102,IT-1A,TTh,09:00,11:00,Computer Lab 1',
].join('\n');
