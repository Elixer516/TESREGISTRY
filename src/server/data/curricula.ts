/**
 * The eight Diploma curricula, in full.
 *
 * Modelled on the centre's own DCMT curriculum: three years, six semesters —
 * five academic plus a final Internship — with a lecture/laboratory unit
 * split and a real prerequisite chain. Before V9 each curriculum defined only
 * a handful of Year 1 subjects, which is why a Year 2 trainee's GSA and Grade
 * Evaluation printed blank: the documents were faithfully reporting empty
 * semesters.
 *
 * Two layers make up a curriculum:
 *
 *   GE_SPINE     the general-education subjects every diploma shares. These
 *                are ONE Subject record mapped into all eight curricula, not
 *                eight copies — which is why the centre's own grading sheets
 *                show the same "Understanding the Self" for Automotive and
 *                for HVACR.
 *
 *   TECHNICAL    the subjects particular to each diploma.
 *
 * Prerequisites are given by subject code and resolved to ids at build time,
 * so a typo fails loudly here rather than silently producing a subject with
 * no gate in front of it.
 */

import type { ProgramSubject, SemesterPeriod, Subject } from '@/types';

/** A subject as authored: units are lec + lab, hours follow the usual 1:3. */
interface SubjectSpec {
  code: string;
  title: string;
  lec: number;
  lab: number;
  /** Subject codes that must be passed first. */
  prereq?: string[];
  /** e.g. 3 for "Third Year standing". */
  standing?: number;
}

/** Curriculum slots, in the order they are taken. */
export const CURRICULUM_SLOTS: Array<{ yearLevel: number; semesterPeriod: SemesterPeriod }> = [
  { yearLevel: 1, semesterPeriod: 'FIRST' },
  { yearLevel: 1, semesterPeriod: 'SECOND' },
  { yearLevel: 2, semesterPeriod: 'FIRST' },
  { yearLevel: 2, semesterPeriod: 'SECOND' },
  { yearLevel: 3, semesterPeriod: 'FIRST' },
  { yearLevel: 3, semesterPeriod: 'SECOND' },
];

type SlotKey = 'y1s1' | 'y1s2' | 'y2s1' | 'y2s2' | 'y3s1' | 'y3s2';

function slotKey(yearLevel: number, semesterPeriod: SemesterPeriod): SlotKey {
  return `y${yearLevel}s${semesterPeriod === 'FIRST' ? 1 : 2}` as SlotKey;
}

/* ------------------------------------------------------------------ */
/* General education — shared by every diploma                         */
/* ------------------------------------------------------------------ */

const GE_SPINE: Record<SlotKey, SubjectSpec[]> = {
  y1s1: [
    { code: 'GE-PC', title: 'Purposive Communication', lec: 3, lab: 0 },
    { code: 'GE-MMW', title: 'Mathematics in the Modern World', lec: 3, lab: 0 },
    { code: 'PATHFIT-1', title: 'Movement Competency Training', lec: 2, lab: 0 },
    { code: 'NSTP-1', title: 'National Service Training Program 1', lec: 3, lab: 0 },
  ],
  y1s2: [
    { code: 'GE-US', title: 'Understanding the Self', lec: 3, lab: 0 },
    { code: 'GE-RPH', title: 'Readings in Philippine History', lec: 3, lab: 0 },
    { code: 'PATHFIT-2', title: 'Exercise-based Fitness Activities', lec: 2, lab: 0, prereq: ['PATHFIT-1'] },
    { code: 'NSTP-2', title: 'National Service Training Program 2', lec: 3, lab: 0, prereq: ['NSTP-1'] },
  ],
  y2s1: [
    { code: 'GE-STS', title: 'Science, Technology and Society', lec: 3, lab: 0 },
    { code: 'GE-ETH', title: 'Ethics', lec: 3, lab: 0 },
    { code: 'PATHFIT-3', title: 'Sports and Recreational Activities', lec: 2, lab: 0, prereq: ['PATHFIT-2'] },
  ],
  y2s2: [
    { code: 'GE-ART', title: 'Art Appreciation', lec: 3, lab: 0 },
    { code: 'GE-RIZ', title: 'Life and Works of Rizal', lec: 3, lab: 0 },
    { code: 'PATHFIT-4', title: 'Outdoor and Adventure Activities', lec: 2, lab: 0, prereq: ['PATHFIT-3'] },
  ],
  y3s1: [
    { code: 'GE-ELEC', title: 'General Education Elective', lec: 3, lab: 0 },
    { code: 'TECHNO-101', title: 'Technopreneurship', lec: 3, lab: 0, standing: 3 },
  ],
  y3s2: [],
};

/* ------------------------------------------------------------------ */
/* Technical subjects, per Diploma                                     */
/* ------------------------------------------------------------------ */

const TECHNICAL: Record<string, Record<SlotKey, SubjectSpec[]>> = {
  'prog-it': {
    y1s1: [
      { code: 'IT-101', title: 'Introduction to Computing', lec: 2, lab: 1 },
      { code: 'IT-102', title: 'Computer Programming 1', lec: 2, lab: 1 },
      { code: 'IT-103', title: 'Discrete Structures', lec: 3, lab: 0 },
      { code: 'IT-104', title: 'Computer Hardware Fundamentals', lec: 1, lab: 2 },
    ],
    y1s2: [
      { code: 'IT-121', title: 'Computer Programming 2', lec: 2, lab: 1, prereq: ['IT-102'] },
      { code: 'IT-122', title: 'Data Structures and Algorithms', lec: 2, lab: 1, prereq: ['IT-102'] },
      { code: 'IT-123', title: 'Web Systems and Technologies', lec: 1, lab: 2 },
      { code: 'IT-124', title: 'Digital Logic Design', lec: 2, lab: 1 },
    ],
    y2s1: [
      { code: 'IT-211', title: 'Object-Oriented Programming', lec: 2, lab: 1, prereq: ['IT-122'] },
      { code: 'IT-212', title: 'Database Management Systems', lec: 2, lab: 1, prereq: ['IT-122'] },
      { code: 'IT-213', title: 'Computer Networking 1', lec: 2, lab: 1, prereq: ['IT-104'] },
      { code: 'IT-214', title: 'Operating Systems', lec: 3, lab: 0 },
    ],
    y2s2: [
      { code: 'IT-221', title: 'Advanced Database Systems', lec: 2, lab: 1, prereq: ['IT-212'] },
      { code: 'IT-222', title: 'Computer Networking 2', lec: 2, lab: 1, prereq: ['IT-213'] },
      { code: 'IT-223', title: 'Systems Analysis and Design', lec: 3, lab: 0, prereq: ['IT-212'] },
      { code: 'IT-224', title: 'Human-Computer Interaction', lec: 2, lab: 1, prereq: ['IT-123'] },
    ],
    y3s1: [
      { code: 'IT-311', title: 'Capstone Project', lec: 1, lab: 2, standing: 3 },
      { code: 'IT-312', title: 'Information Assurance and Security', lec: 3, lab: 0, prereq: ['IT-222'] },
      { code: 'IT-313', title: 'Mobile Application Development', lec: 2, lab: 1, prereq: ['IT-211'] },
      { code: 'IT-314', title: 'IT Project Management', lec: 3, lab: 0, prereq: ['IT-223'] },
    ],
    y3s2: [],
  },

  'prog-auto': {
    y1s1: [
      { code: 'AUTO-101', title: 'Automotive Shop Practice', lec: 1, lab: 2 },
      { code: 'AUTO-102', title: 'Engine Fundamentals', lec: 2, lab: 1 },
      { code: 'AUTO-103', title: 'Automotive Materials', lec: 2, lab: 1 },
      { code: 'AUTO-104', title: 'Technical Drawing for Automotive', lec: 0, lab: 2 },
    ],
    y1s2: [
      { code: 'AUTO-121', title: 'Gasoline Engine Servicing', lec: 1, lab: 2, prereq: ['AUTO-102'] },
      { code: 'AUTO-122', title: 'Diesel Engine Servicing', lec: 1, lab: 2, prereq: ['AUTO-102'] },
      { code: 'AUTO-123', title: 'Automotive Electricity', lec: 2, lab: 1 },
      { code: 'AUTO-124', title: 'Applied Mechanics', lec: 3, lab: 0 },
    ],
    y2s1: [
      { code: 'AUTO-211', title: 'Engine Management Systems', lec: 2, lab: 1, prereq: ['AUTO-123'] },
      { code: 'AUTO-212', title: 'Power Train Servicing', lec: 1, lab: 2, prereq: ['AUTO-121'] },
      { code: 'AUTO-213', title: 'Chassis and Suspension Systems', lec: 2, lab: 1 },
      { code: 'AUTO-214', title: 'Automotive Air-Conditioning', lec: 1, lab: 2 },
    ],
    y2s2: [
      { code: 'AUTO-221', title: 'Automotive Electronics', lec: 2, lab: 1, prereq: ['AUTO-211'] },
      { code: 'AUTO-222', title: 'Brake and Steering Systems', lec: 1, lab: 2, prereq: ['AUTO-213'] },
      { code: 'AUTO-223', title: 'Vehicle Diagnostics', lec: 2, lab: 1, prereq: ['AUTO-211'] },
      { code: 'AUTO-224', title: 'Automotive Shop Management', lec: 3, lab: 0 },
    ],
    y3s1: [
      { code: 'AUTO-311', title: 'Hybrid and Electric Vehicles', lec: 2, lab: 1, standing: 3 },
      { code: 'AUTO-312', title: 'Automotive Body Repair and Refinishing', lec: 1, lab: 2 },
      { code: 'AUTO-313', title: 'Emission Control Systems', lec: 2, lab: 1, prereq: ['AUTO-223'] },
      { code: 'AUTO-314', title: 'Automotive Research Project', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },

  'prog-cet': {
    y1s1: [
      { code: 'CET-101', title: 'Civil Engineering Orientation', lec: 2, lab: 0 },
      { code: 'CET-102', title: 'Engineering Drawing and Plans', lec: 0, lab: 2 },
      { code: 'CET-103', title: 'Masonry NC I', lec: 2, lab: 2 },
      { code: 'CET-104', title: 'Mathematics for Engineers', lec: 3, lab: 0 },
    ],
    y1s2: [
      { code: 'CET-121', title: 'Carpentry NC II', lec: 2, lab: 2 },
      { code: 'CET-122', title: 'Computer-Aided Drafting', lec: 0, lab: 2, prereq: ['CET-102'] },
      { code: 'CET-123', title: 'Fundamentals of Surveying', lec: 3, lab: 1, prereq: ['CET-104'] },
      { code: 'CET-124', title: 'Plumbing NC I', lec: 1, lab: 2 },
    ],
    y2s1: [
      { code: 'CET-211', title: 'Statics of Rigid Bodies', lec: 3, lab: 0, prereq: ['CET-104'] },
      { code: 'CET-212', title: 'Construction Materials and Testing', lec: 2, lab: 1 },
      { code: 'CET-213', title: 'Masonry NC II', lec: 1, lab: 2, prereq: ['CET-103'] },
      { code: 'CET-214', title: 'Building Systems Design', lec: 2, lab: 1, prereq: ['CET-102'] },
    ],
    y2s2: [
      { code: 'CET-221', title: 'Mechanics of Deformable Bodies', lec: 4, lab: 0, prereq: ['CET-211'] },
      { code: 'CET-222', title: 'Reinforced Concrete Design', lec: 3, lab: 0, prereq: ['CET-211'] },
      { code: 'CET-223', title: 'Construction Estimating', lec: 2, lab: 1, prereq: ['CET-212'] },
      { code: 'CET-224', title: 'Engineering Economics', lec: 3, lab: 0 },
    ],
    y3s1: [
      { code: 'CET-311', title: 'Construction Methods and Project Management', lec: 3, lab: 1, standing: 3 },
      { code: 'CET-312', title: 'Quantity Surveying', lec: 1, lab: 1, prereq: ['CET-223'] },
      { code: 'CET-313', title: 'Scaffolding Works', lec: 2, lab: 2 },
      { code: 'CET-314', title: 'Civil Engineering Law, Ethics and Contracts', lec: 2, lab: 0 },
    ],
    y3s2: [],
  },

  'prog-hrt': {
    y1s1: [
      { code: 'HRT-101', title: 'Introduction to Hospitality Industry', lec: 2, lab: 0 },
      { code: 'HRT-102', title: 'Food Safety and Sanitation', lec: 2, lab: 1 },
      { code: 'HRT-103', title: 'Basic Culinary Techniques', lec: 1, lab: 2 },
      { code: 'HRT-104', title: 'Housekeeping Operations', lec: 1, lab: 2 },
    ],
    y1s2: [
      { code: 'HRT-121', title: 'Cookery NC II', lec: 1, lab: 2, prereq: ['HRT-103'] },
      { code: 'HRT-122', title: 'Front Office Operations', lec: 2, lab: 1 },
      { code: 'HRT-123', title: 'Food and Beverage Service', lec: 1, lab: 2, prereq: ['HRT-102'] },
      { code: 'HRT-124', title: 'Nutrition and Menu Planning', lec: 3, lab: 0 },
    ],
    y2s1: [
      { code: 'HRT-211', title: 'Bread and Pastry Production NC II', lec: 1, lab: 2, prereq: ['HRT-103'] },
      { code: 'HRT-212', title: 'Bartending and Beverage Management', lec: 1, lab: 2, prereq: ['HRT-123'] },
      { code: 'HRT-213', title: 'Hospitality Accounting', lec: 3, lab: 0 },
      { code: 'HRT-214', title: 'Tourism and Travel Services', lec: 2, lab: 1 },
    ],
    y2s2: [
      { code: 'HRT-221', title: 'Advanced Culinary Arts', lec: 1, lab: 2, prereq: ['HRT-121'] },
      { code: 'HRT-222', title: 'Events Management', lec: 2, lab: 1 },
      { code: 'HRT-223', title: 'Hotel Property Management Systems', lec: 1, lab: 2, prereq: ['HRT-122'] },
      { code: 'HRT-224', title: 'Customer Service Management', lec: 3, lab: 0 },
    ],
    y3s1: [
      { code: 'HRT-311', title: 'Hospitality Entrepreneurship', lec: 3, lab: 0, standing: 3 },
      { code: 'HRT-312', title: 'Kitchen and Restaurant Operations', lec: 1, lab: 2, prereq: ['HRT-221'] },
      { code: 'HRT-313', title: 'Quality Service Management', lec: 2, lab: 1 },
      { code: 'HRT-314', title: 'Hospitality Research Project', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },

  'prog-hvacr': {
    y1s1: [
      { code: 'HVACR-101', title: 'HVACR Fundamentals', lec: 2, lab: 1 },
      { code: 'HVACR-102', title: 'Refrigeration Principles', lec: 2, lab: 1 },
      { code: 'HVACR-103', title: 'Shop Tools, Equipment and Safety', lec: 1, lab: 2 },
      { code: 'HVACR-104', title: 'Technical Drawing for HVACR', lec: 0, lab: 2 },
    ],
    y1s2: [
      { code: 'HVACR-121', title: 'Domestic Refrigeration Servicing', lec: 1, lab: 2, prereq: ['HVACR-102'] },
      { code: 'HVACR-122', title: 'Electrical Fundamentals for HVACR', lec: 2, lab: 1 },
      { code: 'HVACR-123', title: 'Pipefitting and Brazing', lec: 1, lab: 2, prereq: ['HVACR-103'] },
      { code: 'HVACR-124', title: 'Thermodynamics', lec: 3, lab: 0 },
    ],
    y2s1: [
      { code: 'HVACR-211', title: 'Room Air-Conditioning Servicing', lec: 1, lab: 2, prereq: ['HVACR-121'] },
      { code: 'HVACR-212', title: 'Commercial Refrigeration Systems', lec: 2, lab: 1, prereq: ['HVACR-102'] },
      { code: 'HVACR-213', title: 'HVACR Control Systems', lec: 2, lab: 1, prereq: ['HVACR-122'] },
      { code: 'HVACR-214', title: 'Psychrometrics and Load Calculation', lec: 3, lab: 0, prereq: ['HVACR-124'] },
    ],
    y2s2: [
      { code: 'HVACR-221', title: 'Packaged Air-Conditioning Systems', lec: 1, lab: 2, prereq: ['HVACR-211'] },
      { code: 'HVACR-222', title: 'Chiller Systems', lec: 2, lab: 1, prereq: ['HVACR-212'] },
      { code: 'HVACR-223', title: 'Ductwork Design and Fabrication', lec: 1, lab: 2, prereq: ['HVACR-214'] },
      { code: 'HVACR-224', title: 'Energy Management in HVACR', lec: 3, lab: 0 },
    ],
    y3s1: [
      { code: 'HVACR-311', title: 'Building Automation Systems', lec: 2, lab: 1, standing: 3 },
      { code: 'HVACR-312', title: 'Industrial Refrigeration', lec: 2, lab: 1, prereq: ['HVACR-222'] },
      { code: 'HVACR-313', title: 'HVACR Troubleshooting and Diagnostics', lec: 1, lab: 2, prereq: ['HVACR-213'] },
      { code: 'HVACR-314', title: 'HVACR Project Study', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },

  'prog-iamt': {
    y1s1: [
      { code: 'IAMT-101', title: 'Mechatronics Fundamentals', lec: 2, lab: 1 },
      { code: 'IAMT-102', title: 'Electrical Circuits', lec: 2, lab: 1 },
      { code: 'IAMT-103', title: 'Technical Drafting', lec: 0, lab: 2 },
      { code: 'IAMT-104', title: 'Engineering Mathematics', lec: 3, lab: 0 },
    ],
    y1s2: [
      { code: 'IAMT-121', title: 'Electronic Devices and Circuits', lec: 2, lab: 1, prereq: ['IAMT-102'] },
      { code: 'IAMT-122', title: 'Digital Electronics', lec: 2, lab: 1, prereq: ['IAMT-102'] },
      { code: 'IAMT-123', title: 'Machine Shop Practice', lec: 1, lab: 2 },
      { code: 'IAMT-124', title: 'Applied Physics', lec: 3, lab: 0, prereq: ['IAMT-104'] },
    ],
    y2s1: [
      { code: 'IAMT-211', title: 'Programmable Logic Controllers 1', lec: 2, lab: 1, prereq: ['IAMT-122'] },
      { code: 'IAMT-212', title: 'Industrial Motor Control', lec: 2, lab: 1, prereq: ['IAMT-102'] },
      { code: 'IAMT-213', title: 'Sensors and Transducers', lec: 2, lab: 1, prereq: ['IAMT-121'] },
      { code: 'IAMT-214', title: 'Fluid Power Systems', lec: 2, lab: 1 },
    ],
    y2s2: [
      { code: 'IAMT-221', title: 'Programmable Logic Controllers 2', lec: 2, lab: 1, prereq: ['IAMT-211'] },
      { code: 'IAMT-222', title: 'Microcontroller Systems', lec: 2, lab: 1, prereq: ['IAMT-122'] },
      { code: 'IAMT-223', title: 'Industrial Robotics', lec: 2, lab: 1, prereq: ['IAMT-212'] },
      { code: 'IAMT-224', title: 'Instrumentation and Process Control', lec: 2, lab: 1, prereq: ['IAMT-213'] },
    ],
    y3s1: [
      { code: 'IAMT-311', title: 'Automation Systems Integration', lec: 2, lab: 1, standing: 3 },
      { code: 'IAMT-312', title: 'SCADA and Industrial Networks', lec: 2, lab: 1, prereq: ['IAMT-221'] },
      { code: 'IAMT-313', title: 'Maintenance Engineering', lec: 3, lab: 0 },
      { code: 'IAMT-314', title: 'Mechatronics Project', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },

  'prog-met': {
    y1s1: [
      { code: 'MET-101', title: 'Mechanical Engineering Orientation', lec: 2, lab: 0 },
      { code: 'MET-102', title: 'Engineering Drawing', lec: 0, lab: 2 },
      { code: 'MET-103', title: 'Shop Theory and Practice', lec: 1, lab: 2 },
      { code: 'MET-104', title: 'Engineering Mathematics', lec: 3, lab: 0 },
    ],
    y1s2: [
      { code: 'MET-121', title: 'Machine Shop Practice 1', lec: 1, lab: 2, prereq: ['MET-103'] },
      { code: 'MET-122', title: 'Welding Technology', lec: 1, lab: 2, prereq: ['MET-103'] },
      { code: 'MET-123', title: 'Engineering Materials', lec: 2, lab: 1 },
      { code: 'MET-124', title: 'Applied Mechanics', lec: 3, lab: 0, prereq: ['MET-104'] },
    ],
    y2s1: [
      { code: 'MET-211', title: 'Machine Shop Practice 2', lec: 1, lab: 2, prereq: ['MET-121'] },
      { code: 'MET-212', title: 'Thermodynamics', lec: 3, lab: 0, prereq: ['MET-124'] },
      { code: 'MET-213', title: 'Strength of Materials', lec: 3, lab: 0, prereq: ['MET-124'] },
      { code: 'MET-214', title: 'Machine Elements', lec: 2, lab: 1, prereq: ['MET-102'] },
    ],
    y2s2: [
      { code: 'MET-221', title: 'Fluid Mechanics', lec: 3, lab: 0, prereq: ['MET-212'] },
      { code: 'MET-222', title: 'CNC Machining', lec: 1, lab: 2, prereq: ['MET-211'] },
      { code: 'MET-223', title: 'Industrial Plant Maintenance', lec: 2, lab: 1 },
      { code: 'MET-224', title: 'Heat Transfer', lec: 3, lab: 0, prereq: ['MET-212'] },
    ],
    y3s1: [
      { code: 'MET-311', title: 'Mechanical Systems Design', lec: 2, lab: 1, standing: 3 },
      { code: 'MET-312', title: 'Power Plant Engineering', lec: 3, lab: 0, prereq: ['MET-221'] },
      { code: 'MET-313', title: 'Quality Control and Metrology', lec: 2, lab: 1 },
      { code: 'MET-314', title: 'Mechanical Project Study', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },

  'prog-abet': {
    y1s1: [
      { code: 'ABET-101', title: 'Introduction to Agricultural Engineering', lec: 2, lab: 0 },
      { code: 'ABET-102', title: 'Engineering Drawing for Agriculture', lec: 0, lab: 2 },
      { code: 'ABET-103', title: 'Farm Tools and Equipment', lec: 1, lab: 2 },
      { code: 'ABET-104', title: 'Agricultural Mathematics', lec: 3, lab: 0 },
    ],
    y1s2: [
      { code: 'ABET-121', title: 'Soil and Water Engineering', lec: 2, lab: 1 },
      { code: 'ABET-122', title: 'Farm Power and Machinery', lec: 1, lab: 2, prereq: ['ABET-103'] },
      { code: 'ABET-123', title: 'Crop Production Systems', lec: 2, lab: 1 },
      { code: 'ABET-124', title: 'Applied Physics for Agriculture', lec: 3, lab: 0, prereq: ['ABET-104'] },
    ],
    y2s1: [
      { code: 'ABET-211', title: 'Irrigation and Drainage Engineering', lec: 2, lab: 1, prereq: ['ABET-121'] },
      { code: 'ABET-212', title: 'Agricultural Structures', lec: 2, lab: 1, prereq: ['ABET-102'] },
      { code: 'ABET-213', title: 'Post-Harvest Technology', lec: 2, lab: 1, prereq: ['ABET-123'] },
      { code: 'ABET-214', title: 'Agricultural Electrification', lec: 2, lab: 1 },
    ],
    y2s2: [
      { code: 'ABET-221', title: 'Farm Machinery Maintenance', lec: 1, lab: 2, prereq: ['ABET-122'] },
      { code: 'ABET-222', title: 'Food Process Engineering', lec: 2, lab: 1, prereq: ['ABET-213'] },
      { code: 'ABET-223', title: 'Renewable Energy in Agriculture', lec: 2, lab: 1, prereq: ['ABET-214'] },
      { code: 'ABET-224', title: 'Agricultural Waste Management', lec: 3, lab: 0 },
    ],
    y3s1: [
      { code: 'ABET-311', title: 'Precision Agriculture Technology', lec: 2, lab: 1, standing: 3 },
      { code: 'ABET-312', title: 'Agricultural Systems Design', lec: 2, lab: 1, prereq: ['ABET-212'] },
      { code: 'ABET-313', title: 'Farm Business Management', lec: 3, lab: 0 },
      { code: 'ABET-314', title: 'Agricultural Research Project', lec: 1, lab: 2, standing: 3 },
    ],
    y3s2: [],
  },
};

/** Every diploma ends the same way: one semester on the job. */
function internshipFor(programCode: string): SubjectSpec {
  return {
    code: `${programCode}-INT`,
    title: 'Internship (720 hours)',
    lec: 0,
    lab: 12,
    standing: 3,
  };
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

export interface CurriculumBuild {
  subjects: Subject[];
  programSubjects: ProgramSubject[];
}

/**
 * Turns the specs above into Subject and ProgramSubject records.
 *
 * `programs` maps a program id to its code, which is needed for the
 * internship's subject code and nothing else.
 */
export function buildCurricula(
  programs: Array<{ id: string; code: string }>,
  curriculumIdFor: (programId: string) => string,
  createdAt: string,
): CurriculumBuild {
  const subjects: Subject[] = [];
  const byCode = new Map<string, Subject>();
  let subjectSeq = 0;

  /** One Subject record per code, shared across every curriculum using it. */
  function ensureSubject(spec: SubjectSpec): Subject {
    const existing = byCode.get(spec.code);
    if (existing) return existing;
    subjectSeq += 1;
    const subject: Subject = {
      id: `subj-${subjectSeq}`,
      code: spec.code,
      title: spec.title,
      description: '',
      units: spec.lec + spec.lab,
      // The centre's convention: an hour of lecture per unit, three of lab.
      lectureHours: spec.lec,
      labHours: spec.lab * 3,
      isActive: true,
      createdAt,
    };
    subjects.push(subject);
    byCode.set(spec.code, subject);
    return subject;
  }

  // Every subject is created before any prerequisite is resolved, so a
  // prerequisite may name a subject defined later in the file.
  const plans = new Map<string, Array<{ slot: SlotKey; spec: SubjectSpec }>>();
  for (const program of programs) {
    const technical = TECHNICAL[program.id];
    if (!technical) continue;
    const plan: Array<{ slot: SlotKey; spec: SubjectSpec }> = [];
    for (const { yearLevel, semesterPeriod } of CURRICULUM_SLOTS) {
      const slot = slotKey(yearLevel, semesterPeriod);
      const specs =
        slot === 'y3s2'
          ? [internshipFor(program.code)]
          : [...GE_SPINE[slot], ...technical[slot]];
      for (const spec of specs) {
        ensureSubject(spec);
        plan.push({ slot, spec });
      }
    }
    plans.set(program.id, plan);
  }

  const programSubjects: ProgramSubject[] = [];
  let mappingSeq = 0;

  for (const program of programs) {
    const plan = plans.get(program.id);
    if (!plan) continue;
    const curriculumId = curriculumIdFor(program.id);

    for (const { slot, spec } of plan) {
      const subject = byCode.get(spec.code);
      if (!subject) continue;

      const prerequisiteSubjectIds: string[] = [];
      const prerequisiteCodes: string[] = [];
      for (const code of spec.prereq ?? []) {
        const target = byCode.get(code);
        if (!target) {
          // Loud on purpose: a mistyped prerequisite would otherwise become a
          // subject with no gate in front of it, which nobody would notice.
          throw new Error(
            `Curriculum error: ${spec.code} lists unknown prerequisite "${code}".`,
          );
        }
        prerequisiteSubjectIds.push(target.id);
        prerequisiteCodes.push(target.code);
      }

      const noteParts = [...prerequisiteCodes];
      if (spec.standing) noteParts.push(`${spec.standing === 3 ? 'Third' : 'Second'} Year standing`);

      mappingSeq += 1;
      const yearLevel = Number(slot.charAt(1));
      programSubjects.push({
        id: `ps-${mappingSeq}`,
        curriculumId,
        subjectId: subject.id,
        yearLevel,
        semesterPeriod: slot.endsWith('s1') ? 'FIRST' : 'SECOND',
        isRequired: true,
        prerequisiteSubjectIds,
        prerequisiteStanding: spec.standing ?? null,
        prerequisiteNote: noteParts.join(', '),
      });
    }
  }

  return { subjects, programSubjects };
}
