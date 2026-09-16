/**
 * KorPhil Davao's real Diploma curricula.
 *
 * Transcribed from the scanned curriculum documents in samples/CURRICULUMS
 * and generated from them, so this file is data rather than prose. Figures
 * are reproduced as the documents print them, including the places where a
 * document disagrees with itself; the workbook alongside those PDFs lists
 * every such discrepancy for the trainers to settle.
 *
 * Two things here are deliberate and easy to mistake for bugs.
 *
 * **Course codes are per curriculum, and some are blank.** The same subject
 * carries a different code in each diploma - Purposive Communication is
 * GE 101 in DABET, GE ENG in DCMT, GE01 in DMAT - and three diplomas use no
 * codes at all. All of it is kept as written, because rewriting a
 * department's own curriculum to look tidy would make it unrecognisable to
 * the people who wrote it. A blank code is normal, not missing data.
 *
 * **Subjects are not shared between diplomas.** Earlier this file kept one
 * Subject record per code across every curriculum. The real documents make
 * that impossible: the same subject has different codes, different units
 * and different hours depending on the diploma. Each curriculum line is its
 * own Subject, so editing one diploma can never disturb another.
 */

import type { SemesterPeriod } from '@/types';

export interface CurriculumSubjectSpec {
  /** The diploma's own course code. Empty where the document gives none. */
  code: string;
  title: string;
  units: number;
  lecHours: number;
  labHours: number;
  /** Prerequisite subject titles, resolved within this curriculum. */
  prereqTitles: string[];
  /** 2 or 3 where the document requires year standing. */
  standing: number | null;
  /** The document's own prerequisite wording, printed as written. */
  note: string;
  /** TESDA qualification this subject leads to, where the document says. */
  qualification: string;
  /**
   * True for NSTP and PE/PATHFit: the units count toward the unit
   * load, but the grade is left out of the weighted average. NSTP is
   * non-academic under RA 9163; PE is the centre's own ruling.
   */
  excludedFromGwa: boolean;
}

export interface CurriculumTermSpec {
  yearLevel: number;
  period: SemesterPeriod;
  subjects: CurriculumSubjectSpec[];
}

export interface CurriculumSpec {
  id: string;
  programId: string;
  /** Curriculum code, e.g. DIT or DIT-2022 for the superseded edition. */
  code: string;
  name: string;
  /** Set on an older edition kept for trainees still enrolled under it. */
  versionLabel: string;
  effectivity: string;
  supersededBy: string;
  terms: CurriculumTermSpec[];
}

export interface DiplomaSpec {
  id: string;
  code: string;
  name: string;
  description: string;
  years: number;
}

export const DIPLOMAS: DiplomaSpec[] = [
  {
    id: 'prog-dabet',
    code: 'DABET',
    name: 'Diploma in Agricultural and Biosystems Engineering Technology',
    description: 'Farm power, agricultural structures, crop and animal science, and post-harvest machinery.',
    years: 3,
  },
  {
    id: 'prog-dat',
    code: 'DAT',
    name: 'Diploma in Automotive Technology (Leading to BTVTed Program)',
    description: 'Engine, chassis, electrical and body systems servicing, leading to a BTVTEd programme.',
    years: 3,
  },
  {
    id: 'prog-dcat',
    code: 'DCAT',
    name: 'Diploma in Culinary Arts (Supervision and Administration Technology)',
    description: 'Culinary fundamentals, regional and international cuisine, and food service supervision.',
    years: 3,
  },
  {
    id: 'prog-dcmt',
    code: 'DCMT',
    name: 'Diploma in Construction Management Technology',
    description: 'Masonry, carpentry, plumbing, surveying and construction project management.',
    years: 3,
  },
  {
    id: 'prog-demt',
    code: 'DEMT',
    name: 'Diploma in Electro-Mechatronics Technology (Repackaged 2025)',
    description: 'Electrical installation, mechatronics servicing and industrial automation.',
    years: 3,
  },
  {
    id: 'prog-dht',
    code: 'DHT',
    name: 'Diploma in Hospitality (Supervision and Administration) Technology',
    description: 'Housekeeping and front office operations, supervision and rooms division management.',
    years: 3,
  },
  {
    id: 'prog-dhvacrt',
    code: 'DHVACRT',
    name: 'Diploma of HVAC/R Technology (Leading to BTVTed Program)',
    description: 'Domestic, commercial and mobile refrigeration and air-conditioning servicing.',
    years: 3,
  },
  {
    id: 'prog-diamt',
    code: 'DIAMT',
    name: 'Diploma in Industrial Automation and Mechatronics Technology (Leading to BSECE and BSEE)',
    description: 'Programmable logic controllers, motor control and electronics, leading to BSECE and BSEE.',
    years: 3,
  },
  {
    id: 'prog-dit',
    code: 'DIT',
    name: 'Diploma in Information Technology (Leading to BSIT, BTVTEd & BMMA)',
    description: 'Programming, web systems, networking, animation and game art.',
    years: 3,
  },
  {
    id: 'prog-dmat',
    code: 'DMAT',
    name: 'Diploma in Multimedia Arts Technology',
    description: '2D and 3D animation, visual graphic design, film and multimedia publishing.',
    years: 3,
  },
  {
    id: 'prog-dmet-mach',
    code: 'DMET-MACH',
    name: 'Diploma in Mechanical Engineering Technology (Specialized in Machining)',
    description: 'Machining, CNC lathe and milling operation, and CAD/CAM.',
    years: 3,
  },
  {
    id: 'prog-dmet-weld',
    code: 'DMET-WELD',
    name: 'Diploma in Mechanical Engineering Technology (Specialized in Welding)',
    description: 'Shielded metal, gas metal and gas tungsten arc welding, and pipe fitting.',
    years: 3,
  },
  {
    id: 'prog-drot',
    code: 'DROT',
    name: 'Diploma in Restaurant Operations Technology (Supervisory and Administration)',
    description: 'Food and beverage service, bar and coffee operations, and restaurant supervision.',
    years: 3,
  },
];

export const CURRICULA: CurriculumSpec[] = [
  {
    id: 'cur-dabet',
    programId: 'prog-dabet',
    code: 'DABET',
    name: 'Diploma in Agricultural and Biosystems Engineering Technology',
    versionLabel: '',
    effectivity: '2025-2028',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE 101', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE102', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE Math', title: 'Mathematics in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'AC101', title: 'Principle of Crop Science', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: 'Agricultural Crops Production NC I' },
          { excludedFromGwa: false, code: 'NPS 1', title: 'Chemistry for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 2', title: 'Physics for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFIT 1', title: 'Movement Competency Training or MCT', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'GE103', title: 'Science, Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABE1', title: 'Introduction to AB Engineering', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Math 1', title: 'Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Mathematics in the Modern World'], standing: null, note: 'Mathematics in the Modern World', qualification: '' },
          { excludedFromGwa: false, code: 'AC102', title: 'Principle of Soil Science', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: 'Agricultural Crop Production NC II' },
          { excludedFromGwa: false, code: 'OAP', title: 'Organic Agriculture Production NC II', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE104', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Understanding the Self'], standing: null, note: 'Understanding the Self', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFIT 2', title: 'Exercise-based Fitness Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training or MCT'], standing: null, note: 'PATHFIT 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE105', title: 'The life and Work of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Math 2', title: 'Calculus II', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Calculus 1'], standing: null, note: 'Calculus I', qualification: '' },
          { excludedFromGwa: false, code: 'AC 103', title: 'Principle of Animal Science', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABE2', title: 'Thermodynamics and Heat transfer', units: 5, lecHours: 4, labHours: 3, prereqTitles: ['Physics for Engineers', 'Calculus 1'], standing: null, note: 'Physics for Engineers; Calculus I', qualification: '' },
          { excludedFromGwa: false, code: 'BES 1', title: 'Engineering Mechanics 1', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['Physics for Engineers', 'Calculus 1'], standing: null, note: 'Physics for Engineers; Calculus I', qualification: 'HEO-Forklift NC II' },
          { excludedFromGwa: false, code: 'BES 2', title: 'Engineering Economy', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: 2, note: 'Second Year Standing', qualification: '' },
          { excludedFromGwa: false, code: 'ABE3', title: 'ABE and Related Laws, Specifications, Contracts and Ethics', units: 1, lecHours: 1, labHours: 0, prereqTitles: ['Ethics', 'Introduction to AB Engineering'], standing: null, note: 'GE Ethics; Introduction to AB Engineering', qualification: '' },
          { excludedFromGwa: false, code: 'BES 3', title: 'Computer Aided Drafting', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFIT 3', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Exercise-based Fitness Activities'], standing: null, note: 'PATHFIT 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'PC 101', title: 'AB Power Engineering', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Thermodynamics and Heat transfer', 'Calculus II'], standing: null, note: 'Thermodynamics and Heat Transfer; Calculus II', qualification: '' },
          { excludedFromGwa: false, code: 'Math 3', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Mathematics in the Modern World'], standing: null, note: 'GE Math', qualification: '' },
          { excludedFromGwa: false, code: 'BES 4', title: 'Engineering Mechanics II', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Mechanics 1'], standing: null, note: 'Engineering Mechanics I', qualification: '' },
          { excludedFromGwa: false, code: 'PC102', title: 'AB Machinery and Mechanization', units: 3, lecHours: 3, labHours: 3, prereqTitles: ['AB Power Engineering', 'Principle of Crop Science', 'Principle of Soil Science'], standing: null, note: 'AB Power Engineering; Principle of Crop Science; Principle of Soil Science', qualification: '' },
          { excludedFromGwa: false, code: 'PC103', title: 'AB Products processing and Storage', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['Principle of Animal Science', 'Principle of Crop Science'], standing: null, note: 'Principle of Animal Science; Principle of Crop Science', qualification: 'Agricultural Crop production NC III' },
          { excludedFromGwa: false, code: 'ABE4', title: 'Computer Application for AB Application', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Ethics', 'Introduction to AB Engineering'], standing: null, note: 'GE Ethics; Introduction to AB Engineering', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFIT 4', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities'], standing: null, note: 'PATHFIT 3', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'ABE5', title: 'Technopreneurship 101', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Economy'], standing: null, note: 'Engineering Economy', qualification: '' },
          { excludedFromGwa: false, code: 'MSES', title: 'Motorcycle/Small Engine Servicing NC II', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['AB Power Engineering'], standing: null, note: 'AB Power Engineering', qualification: '' },
          { excludedFromGwa: false, code: 'ABE6', title: 'Materials and Processes of ABE', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Engineering Mechanics 1', 'Computer Aided Drafting', 'Chemistry for Engineers'], standing: null, note: 'Engineering Mechanics I; Computer Aided Drafting; Chemistry for Engineers', qualification: '' },
          { excludedFromGwa: false, code: 'RMO', title: 'Rice Machinery Operation NC II', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['AB Machinery and Mechanization'], standing: null, note: 'AB Machinery and Mechanization', qualification: '' },
          { excludedFromGwa: false, code: 'PC104', title: 'Renewable Energy for AB Application', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['AB Power Engineering'], standing: null, note: 'AB Power Engineering', qualification: '' },
          { excludedFromGwa: false, code: 'Research 1', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'Engineering Data Analysis', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'ABE7', title: 'Thesis', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Methods of Research'], standing: 3, note: 'Methods of Research; Third Year Standing', qualification: '' },
          { excludedFromGwa: false, code: 'ABE8', title: 'Internship (648 hrs)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: 3, note: 'Third Year Standing', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dat',
    programId: 'prog-dat',
    code: 'DAT',
    name: 'Diploma in Automotive Technology (Leading to BTVTed Program)',
    versionLabel: '',
    effectivity: 'Revised Training Year 2022-2025',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'AT 111', title: 'Pre-Delivery Inspection (PDI)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Automotive Servicing NCI' },
          { excludedFromGwa: false, code: 'AT 112', title: 'Preventive Maintenance Schedule (PMS)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Automotive Servicing NCI' },
          { excludedFromGwa: false, code: 'AT113', title: 'Automotive Workshop Management and Maintenance', units: 1, lecHours: 1, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: 'Automotive Servicing NCI' },
          { excludedFromGwa: false, code: 'AT 114', title: 'Motorcycle and Small Engine Servicing, Repairing and Maintenance', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Motorcycle/Small Engine Servicing NC II' },
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Mathematics in the modern world', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'OHS', title: 'Occupational Health and Safety Practices', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ICT 1', title: 'Computer fundamentals', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELEX 1', title: 'Basic Electronics', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 1', title: 'Movement Enhancement', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'AT 121', title: 'Automotive Body Electrical System Servicing, Repair and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'Automotive Servicing NCI', qualification: 'ATS NC II Electrical Repair' },
          { excludedFromGwa: false, code: 'AT 122', title: 'Automotive Under chassis Components and Power Train Components Servicing, Repair and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'Automotive Servicing NCI', qualification: 'ATS NC II Chassis Repair' },
          { excludedFromGwa: false, code: 'AT 123', title: 'Automotive Engine Overhauling and Rebuilding', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'Automotive Servicing NCI', qualification: 'ATS NC II Engine Repair' },
          { excludedFromGwa: false, code: 'DRV 1', title: 'Basic Driving', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Driving N II' },
          { excludedFromGwa: false, code: 'GE - US', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-STS', title: 'Science Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
          { excludedFromGwa: true, code: 'PE 2', title: 'Fitness Exercises', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Enhancement'], standing: null, note: 'PE 1', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 1', title: 'Supervised Industrial Training 1', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'DRV 2', title: 'Driving Heavy Duty Vehicle', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: 'Driving NC II', qualification: 'Driving NC III (Straight Truck/Passenger Bus)' },
          { excludedFromGwa: false, code: 'ABR 1', title: 'Remove and store vehicle body components', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABR 2', title: 'Replace and repair vehicle body panels and components', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABR 3', title: 'Repair vehicle body panels using filler', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELEX 2', title: 'Digital Electronics', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Basic Electronics'], standing: null, note: 'Basic electronics', qualification: '' },
          { excludedFromGwa: false, code: 'FL 1', title: 'Foreign Language (Korean Language)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ENTREP 1', title: 'Entrepreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SOC SCI 1', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 3', title: 'Dance and Music', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Fitness Exercises'], standing: null, note: 'PE 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'ABP 1', title: 'Prepare body/panel for painting', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABP 2', title: 'Apply solid color for painting', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ABP 3', title: 'Apply pearl/mica color for painting', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 1', title: 'Fundamentals of Management (Theory and Practices)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE Psy 2', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-CW', title: 'Contemporary World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-RPH', title: 'Readings in Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 4', title: 'Physical Activities Towards Health and Fitness 2 (Team Sports)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Dance and Music'], standing: null, note: 'PE 3', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 2', title: 'Supervised Industrial Training 2', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'AT311', title: 'Service Electronic Gasoline Engine Management System', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT312', title: 'Service Automotive Electrical Security and Electronic Components', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 313', title: 'Perform Servicing to Automatic Transmission', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 314', title: 'Service Automotive Air-Conditioning System', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'GE - AA', title: 'Art Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 5', title: 'Strategic Management (Planning and Organizing)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 4', title: 'The Andragogy of Learning Including Principles of TM I', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: 'COC # 1 FLS TM1' },
          { excludedFromGwa: false, code: 'Research 1', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'AT 321', title: 'Managing Service Shop', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 322', title: 'Body management and under chassis electronic control system servicing', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 323', title: 'Basic Engine Electronic Management System Operation and Servicing', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 324', title: 'Service Emission Control System', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'AT 325', title: 'Hybrid Vehicle and Electric Vehicle', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: 'ATS NC I; ATS NC II (Chassis Repair, Electrical Repair, Engine Repair)', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 5', title: 'Assessment in Learning 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: 'COC # 2 CCA TM1' },
          { excludedFromGwa: false, code: 'Research 2', title: 'Undergraduate Thesis/Research Project', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dcat',
    programId: 'prog-dcat',
    code: 'DCAT',
    name: 'Diploma in Culinary Arts (Supervision and Administration Technology)',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Purposive Communication (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Mathematics in the Modern World (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals of Accounting/Business and Management (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Macro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Culinary Fundamentals (Main Core)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Cookery NC II / Food Production (Professional Cookery) NC II' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Science, Technology and Society (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Professional Development and Applied Ethics (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Micro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Macro Perspective of Tourism and Hospitality (Common)'], standing: null, note: 'Macro Perspective of Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Entrepreneurship in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Fundamentals of Accounting/Business and Management (Common)'], standing: null, note: 'Fundamentals of Accounting/Business and Management (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Applied Business Tools and Technologies (POS) (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Philippine Regional Cuisine', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Philippine Regional Cuisine Certificate of Completion' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals in Food Service Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Food and Beverage Services NC II' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 2 (LTS/CWTS/ROTC) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)'], standing: null, note: 'National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Life and Works of Rizal (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Philippine Culture and Tourism Geography (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Foreign Language 1 (Common) Korean Language Basic', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Quality Service Management in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Gastronomy (Food and Culture) (Core)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Gastronomy Certificate of Completion' },
          { excludedFromGwa: false, code: '', title: 'Menu Design and Revenue Management', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'Food Production (Professional Cookery) NC II', qualification: 'Food Production (Professional Cookery) NC III' },
          { excludedFromGwa: true, code: '', title: 'Choice of Dance, Sports, Activities (PATHFit 3) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Strategic Management in Tourism (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Quality Service Management in Tourism and Hospitality (Common)'], standing: null, note: 'Quality Service Management in Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Ergonomics and Facilities Planning for the Hospitality Industry (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Foreign Language 2 (Common) Korean Language Advanced', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Foreign Language 1 (Common) Korean Language Basic'], standing: null, note: 'Foreign Language 1 (Common) Korean Language Basic', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Global Culture and Tourism Geography', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Introduction to Transport (Merge all - Cruise, Airline, Land with Industry Seminar and Tour) (Core)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Asian Cuisine', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Asian Cuisine Certificate of Completion' },
          { excludedFromGwa: false, code: '', title: 'Bread and Pastry', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Bread and Pastry Production NC II' },
          { excludedFromGwa: true, code: '', title: 'PATHFit 4 - Team Sports Activities (Volleyball and Basketball)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Choice of Dance, Sports, Activities (PATHFit 3) (Basic/GE mandated)'], standing: null, note: 'Choice of Dance, Sports, Activities (PATHFit 3) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Operations Management in Tourism and Hospitality Industry (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Quality Service Management in Tourism and Hospitality (Common)'], standing: null, note: 'Quality Service Management in Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Tourism and Hospitality Marketing (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Multicultural Diversity in Workplace for the Tourism Professional (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Legal Aspects in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Research in Hospitality (Research 1) (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'International Cuisine', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'International Cuisine Certificate of Completion' },
          { excludedFromGwa: false, code: '', title: 'Cost Control', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'Food Production (Professional Cookery) NC III', qualification: 'Food Production (Professional Cookery) NC IV' },
          { excludedFromGwa: false, code: '', title: 'Operations Management in Tourism and Hospitality Industry (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Quality Service Management in Tourism and Hospitality (Common)'], standing: null, note: 'Quality Service Management in Tourism and Hospitality (Common)', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Capstone', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Research in Hospitality (Research 1) (Common)'], standing: null, note: 'Research in Hospitality (Research 1) (Common)', qualification: 'Capstone' },
          { excludedFromGwa: false, code: '', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: 'All Academic Courses', qualification: 'Internship (648 HRS)' },
        ],
      },
    ],
  },
  {
    id: 'cur-dcmt',
    programId: 'prog-dcmt',
    code: 'DCMT',
    name: 'Diploma in Construction Management Technology',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'DRAW 101', title: 'Engineering Drawing and Plans', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 111', title: 'Civil Engineering Orientation', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMR 111', title: 'Masonry NC I', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Masonry NC I' },
          { excludedFromGwa: false, code: 'CMR 112', title: 'Plumbing NC I', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Plumbing NC I' },
          { excludedFromGwa: false, code: 'NPS', title: 'Chemistry for Engineers (Lecture)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 112', title: 'Mathematics for Engineers', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SAF 101', title: 'Construction Occupational Safety and Health', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFit 1', title: 'Movement Competency Training or MCT', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'Civic Welfare Training Service 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'CMR 121', title: 'Carpentry NC II', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'DRAW 102', title: 'Computer-Aided Drafting', units: 2, lecHours: 0, labHours: 6, prereqTitles: ['Engineering Drawing and Plans'], standing: null, note: 'Engineering Drawing and Plans', qualification: 'Technical Drafting NC II - Structural' },
          { excludedFromGwa: false, code: 'CALC 1', title: 'Engineering Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Mathematics for Engineers'], standing: null, note: 'Mathematics for Engineers', qualification: '' },
          { excludedFromGwa: false, code: 'ICT 101', title: 'Computer Fundamentals and Programming', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 122', title: 'Fundamentals of Surveying', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Mathematics for Engineers'], standing: null, note: 'Mathematics for Engineers', qualification: '' },
          { excludedFromGwa: false, code: 'GE HIST', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'PHYS 1', title: 'Physics for Engineers Calculus based (Lecture)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFit 2', title: 'PATHFit 2 – Exercise-based Fitness Activity', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training or MCT'], standing: null, note: 'PATHFit 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'Civic Welfare Training Service 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Civic Welfare Training Service 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'CMR 211', title: 'Plumbing NC II', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Plumbing NC I'], standing: null, note: 'Plumbing NC I', qualification: 'Plumbing NC II' },
          { excludedFromGwa: false, code: 'CMR 212', title: 'Masonry NC II', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Masonry NC I'], standing: null, note: 'Masonry NC I', qualification: 'Masonry NC II' },
          { excludedFromGwa: false, code: 'CALC 2', title: 'Engineering Calculus 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'Engineering Calculus 1', qualification: '' },
          { excludedFromGwa: false, code: 'RES 1', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'CALC 1; GE MATH', qualification: '' },
          { excludedFromGwa: false, code: 'FL 101', title: 'Foreign Language', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 211', title: 'Statics of Rigid Bodies', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 2', 'Physics for Engineers Calculus based (Lecture)'], standing: null, note: 'CALC 2; PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 212', title: 'Building Systems Design', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Engineering Drawing and Plans'], standing: null, note: 'DRAW 101', qualification: '' },
          { excludedFromGwa: false, code: 'GE STS', title: 'Science, Technology, and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ETHICS', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATH Fit 3', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['PATHFit 2 – Exercise-based Fitness Activity'], standing: null, note: 'PATHFit 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'CMR 221', title: 'Masonry NC III', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Masonry NC II'], standing: null, note: 'Masonry NC II', qualification: 'Masonry NC III' },
          { excludedFromGwa: false, code: 'CMR 222', title: 'Carpentry NC III', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Carpentry NC II'], standing: null, note: 'Carpentry NC II', qualification: 'Carpentry NC III' },
          { excludedFromGwa: false, code: 'CMT 221', title: 'Mechanics of Deformable Bodies', units: 4, lecHours: 4, labHours: 0, prereqTitles: ['Statics of Rigid Bodies'], standing: null, note: 'Statics of Rigid Bodies', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 222', title: 'Dynamics of Rigid Bodies', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Statics of Rigid Bodies'], standing: null, note: 'Statics of Rigid Bodies', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 223', title: 'Engineering Management', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: 'Building System Design', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 224', title: 'Construction Materials and Testing', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: 2, note: '2ND YEAR STANDING', qualification: '' },
          { excludedFromGwa: false, code: 'EE 101', title: 'Engineering Utilities 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Physics for Engineers Calculus based (Lecture)'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'RES 2', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Physics for Engineers Calculus based (Lecture)'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 225', title: 'Engineering Economics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'GE-MATH; CALC 1', qualification: '' },
          { excludedFromGwa: true, code: 'PATH Fit 4', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities'], standing: null, note: 'PATH Fit 3', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'CMR 311', title: 'Plumbing NC III', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Plumbing NC II'], standing: null, note: 'Plumbing NC II', qualification: 'Plumbing NC III' },
          { excludedFromGwa: false, code: 'SCAFF 101', title: 'Scaffolding Works', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELEC 1', title: 'Database Management in Construction', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Economics'], standing: null, note: 'Engineering Economics', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 311', title: 'Quantity Surveying', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: 'Building Systems and Design', qualification: '' },
          { excludedFromGwa: false, code: 'CAPS', title: 'Capstone', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Methods of Research'], standing: null, note: 'Methods of Research', qualification: '' },
          { excludedFromGwa: false, code: 'TECHNO 101', title: 'Technopreneurship 101', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 312', title: 'Construction Methods and Project Management', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CMT 313', title: 'Civil Engineering Law, Ethics, and Contracts', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'Internship', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-demt',
    programId: 'prog-demt',
    code: 'DEMT',
    name: 'Diploma in Electro-Mechatronics Technology (Repackaged 2025)',
    versionLabel: '',
    effectivity: '5 Academic Semesters, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'ELEC 1', title: 'Mathematics for Engineers', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CALC 1', title: 'Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 111', title: 'Engineering Drawing and Plans', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Technical Drafting NCII specialized in Electrical/Electronics Drafting' },
          { excludedFromGwa: false, code: 'EMR 112', title: 'Computer-Aided Drafting', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 1', title: 'Chemistry for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE Eng', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 111', title: 'Construction Occupational Safety and Health', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE STS', title: 'Science, Technology, and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'CWTS 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATH Fit 1', title: 'Movement Competency Training (MCT)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'CALC 2', title: 'Calculus 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Calculus 1'], standing: null, note: 'CALC 1', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 121', title: 'Computer Programming', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 2', title: 'Physics for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: 'Co-Requisite CALC 2', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 121', title: 'Computer Systems Servicing NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Computer Systems Servicing NCII' },
          { excludedFromGwa: false, code: 'EMR 122', title: 'Mechatronics Servicing NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Mechatronics Servicing NCII' },
          { excludedFromGwa: false, code: 'EMT 122', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Calculus 1'], standing: null, note: 'CALC 1', qualification: '' },
          { excludedFromGwa: false, code: 'GE ETH', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'CWTS 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['CWTS 1'], standing: null, note: 'NSTP 1', qualification: '' },
          { excludedFromGwa: true, code: 'PATH Fit 2', title: 'Exercise – Based Fitness', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (MCT)'], standing: null, note: 'PATHFit 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'CALC 3', title: 'Differential Equations', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Calculus 2'], standing: null, note: 'CALC 2', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 211', title: 'Electrical Circuits 1', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Calculus 2', 'Physics for Engineers'], standing: null, note: 'CALC 2; NPS 2', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 212', title: 'Engineering Mechanics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'NPS 2', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 211', title: 'Electrical Installation and Maintenance NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Electrical Installation and Maintenance NCII' },
          { excludedFromGwa: false, code: 'EMT 213', title: 'Basic Thermodynamics', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'NPS 2', qualification: '' },
          { excludedFromGwa: false, code: 'MAN', title: 'Life and Works of Jose Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 212', title: 'Mechatronics Servicing NCIII', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Mechatronics Servicing NCII'], standing: null, note: 'EMR 122', qualification: 'Mechatronics Servicing NCIII' },
          { excludedFromGwa: false, code: 'EMT 214', title: 'EE Laws, Codes, and Professional Ethics', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Ethics'], standing: null, note: 'GE ETH', qualification: '' },
          { excludedFromGwa: false, code: 'ELEC 2', title: 'Foreign Language', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATH Fit 3', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (MCT)', 'Exercise – Based Fitness'], standing: null, note: 'PATHFit 1; PATHFit 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'EMT 221', title: 'Engineering Mathematics for EE', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Differential Equations'], standing: null, note: 'CALC 3', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 222', title: 'Electrical Circuits 2', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electrical Circuits 1'], standing: null, note: 'EMT 211', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 223', title: 'Electronic Circuits: Devices and Analysis', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electrical Circuits 1'], standing: null, note: 'EMT 211', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 224', title: 'Electromagnetics', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physics for Engineers', 'Differential Equations'], standing: null, note: 'NPS 2; CALC 3', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 225', title: 'Engineering Economics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'EMT 122', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 226', title: 'Fluid Mechanics', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'NPS 2', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 227', title: 'Electrical Standards and Practices', units: 1, lecHours: 0, labHours: 3, prereqTitles: ['EE Laws, Codes, and Professional Ethics'], standing: null, note: 'EMT 214', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 228', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 221', title: 'Electrical Installation and Maintenance NCIII', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Electrical Installation and Maintenance NCII'], standing: null, note: 'EMR 211', qualification: 'Electrical Installation and Maintenance NCIII' },
          { excludedFromGwa: true, code: 'PATH Fit 4', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (MCT)', 'Exercise – Based Fitness'], standing: null, note: 'PATHFit 1; PATHFit 2', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'EMT 311', title: 'Logic Circuits and Switching Theory', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Electronic Circuits: Devices and Analysis'], standing: null, note: 'EMT 223', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 311', title: 'DC Machinery', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electrical Circuits 2', 'Electromagnetics'], standing: null, note: 'EMT 222; EMT 224', qualification: 'Electrical Installation and Maintenance NC IV' },
          { excludedFromGwa: false, code: 'EMR 312', title: 'AC Machinery', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: 'Co-Req EMR 311', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 314', title: 'Industrial Electronics', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electronic Circuits: Devices and Analysis'], standing: null, note: 'EMT 223', qualification: 'Mechatronics Servicing NCIV' },
          { excludedFromGwa: false, code: 'EMR 315', title: 'Fundamentals of Electronic Communications', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Electronic Circuits: Devices and Analysis'], standing: null, note: 'EMT 223', qualification: '' },
          { excludedFromGwa: false, code: 'EMR 316', title: 'Machine Automation and Process Control', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 312', title: 'Introduction to Microprocessor and Microcontroller Systems', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 313', title: 'Engineering Management', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 314', title: 'Research Methods', units: 1, lecHours: 0, labHours: 3, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'EMT 122', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'EMT 321', title: 'Capstone Design Project', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Research Methods'], standing: null, note: 'EMT 314', qualification: '' },
          { excludedFromGwa: false, code: 'EMT 322', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: 'ALL ACADEMIC AND TECHNICAL COURSES WITH RESULTANTS', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dht',
    programId: 'prog-dht',
    code: 'DHT',
    name: 'Diploma in Hospitality (Supervision and Administration) Technology',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Purposive Communication (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Mathematics in the Modern World (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Macro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Applied Business tools and Technologies with Lab -PMS (Property Management System)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Housekeeping Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Housekeeping NC II' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 1 (CWTS) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Micro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Macro Perspective of Tourism and Hospitality (Common)'], standing: null, note: 'Macro Perspective of Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Philippine Culture and Tourism Geography', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Macro Perspective of Tourism and Hospitality (Common)'], standing: null, note: 'Macro Perspective of Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Professional development and applied Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Front Office Operations', units: 2, lecHours: 2, labHours: 3, prereqTitles: ['Applied Business tools and Technologies with Lab -PMS (Property Management System)'], standing: null, note: 'Applied Business tools and Technologies with Lab -PMS (Property Management System)', qualification: 'Front Office Services NC II' },
          { excludedFromGwa: false, code: '', title: 'Entrepreneurship in Tourism and Hospitality (Common)', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals of Accounting/Business and Management', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 2 (LTS/CWTS/ROTC) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1 (CWTS) (Basic/GE mandated)'], standing: null, note: 'National Service Training Program 1 (CWTS) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Science Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Tourism and Hospitality Marketing', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Macro Perspective of Tourism and Hospitality (Common)'], standing: null, note: 'Macro Perspective of Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Foreign Language 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Legal Aspect in Tourism and Hospitality', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Housekeeping Supervision', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Housekeeping Operations'], standing: null, note: 'Housekeeping Operations', qualification: 'Housekeeping NC III' },
          { excludedFromGwa: true, code: '', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities (PATHFit 3) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Foreign Language 2 (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Foreign Language 1'], standing: null, note: 'Foreign Language 1', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Quality Service Management in Tourism and Hospitality Industry', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Multicultural Diversity in Workplace', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Global Culture and Tourism Geography', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Trends and Issues in Hospitality', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Front Office Supervision', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Front Office Operations'], standing: null, note: 'Front Office Operations', qualification: 'Front Office Services NC III' },
          { excludedFromGwa: true, code: '', title: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities (PATHFit 4) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities (PATHFit 3) (Basic/GE mandated)'], standing: null, note: 'Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor and Adventure Activities (PATHFit 3) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Strategic Management in Tourism and Hospitality', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Research 1', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Sustainable Hospitality', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Operations Management in Tourism and Hospitality Industry', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Rooms Division Management', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Housekeeping Supervision'], standing: null, note: 'Housekeeping Supervision', qualification: 'Housekeeping NC IV' },
          { excludedFromGwa: false, code: '', title: 'Front Office Management', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Front Office Supervision'], standing: null, note: 'Front Office Supervision; Fundamentals in Accounting', qualification: 'Front Office Services NC IV' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Capstone', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Research 1'], standing: null, note: 'Research 1 (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: 'All Academic Courses', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dhvacrt',
    programId: 'prog-dhvacrt',
    code: 'DHVACRT',
    name: 'Diploma of HVAC/R Technology (Leading to BTVTed Program)',
    versionLabel: '',
    effectivity: 'School Year 2023',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'RAC 1', title: 'Domestic Refrigeration and Air conditioning (DOMRAC) Systems Services and Maintenance', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: 'RAC NCII (Dom RAC)' },
          { excludedFromGwa: false, code: 'GE-ENG 1', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELC 1', title: 'Electrical Circuits and Devices', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-STS', title: 'Science Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'WT 1', title: 'Soldering, welding, joining Operations', units: 4, lecHours: 2, labHours: 2, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-MATH 1', title: 'Math in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'OSH 1', title: 'Occupational Health and Safety', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-IT Era', title: 'Living in the IT Era', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 1', title: 'Movement Enhancement', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'RAC 2', title: 'Package Air conditioning Unit (PACU) Installation and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Domestic Refrigeration and Air conditioning (DOMRAC) Systems Services and Maintenance'], standing: null, note: 'RAC 1', qualification: 'Commercial Aircon NCIII' },
          { excludedFromGwa: false, code: 'DRIVING 1', title: 'Driving Light Vehicle', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ENTREP 1', title: 'Entrepreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TD 1', title: 'Technical Drawing', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'HL 2', title: 'Heat Load Calculation', units: 2, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELC 2', title: 'Industrial Motor Controller', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Electrical Circuits and Devices'], standing: null, note: 'ELC 1', qualification: '' },
          { excludedFromGwa: false, code: 'GE', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 2', title: 'Fitness Exercises', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Enhancement'], standing: null, note: 'PE 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 1', title: 'Supervised Industrial Training 1', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'RAC 3', title: 'Commercial Refrigeration Equipment (CRE) Installation and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Package Air conditioning Unit (PACU) Installation and Maintenance'], standing: null, note: 'RAC 2', qualification: 'Commercial Refrigeration NC III' },
          { excludedFromGwa: false, code: 'RAC 4', title: 'Mobile Refrigeration and Air conditioning', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: 'Transport RAC NCII' },
          { excludedFromGwa: false, code: 'MGT 1', title: 'Management Theory and Practices', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ELEX 1', title: 'Basic Electronics', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CAD 1', title: 'Computer Aided Drafting', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Technical Drawing'], standing: null, note: 'TD 1', qualification: '' },
          { excludedFromGwa: false, code: 'GE Psy2', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 3', title: 'Dance and Music', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Fitness Exercises'], standing: null, note: 'PE 2', qualification: '' },
          { excludedFromGwa: false, code: 'GE-RPH', title: 'Readings in the Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'RAC 5', title: 'Land-Base Refrigeration', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Land-Base RAC' },
          { excludedFromGwa: false, code: 'IAM 1', title: 'Mechatronics systems, operation and maintenance', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 2', title: 'Customer Relations & Negotiation', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Management Theory and Practices'], standing: null, note: 'MGT 1', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 3', title: 'Self Efficacy and Leadership', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Research 1', title: 'Technology Research Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-CW', title: 'The Contemporary World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Soc Sci 1', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-AA', title: 'Art Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Elex 2', title: 'Digital Electronics', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 4', title: 'Physical Activities Towards Health and Fitness 2 (Team Sports)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Dance and Music'], standing: null, note: 'PE 3', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 2', title: 'Supervised Industrial Training 2', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'MGT 4', title: 'People skills and stress management', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'RAC 6', title: 'Air Handing units installation, Service and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Air Duct NC II' },
          { excludedFromGwa: false, code: 'Prof Ed 1', title: 'The Child and Adolescent Learner and Learning Principles', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 2', title: 'The Teaching Profession', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 3', title: 'Facilitating learner centered teaching: the learner centered approaches with emphasis on trainers methodology', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CT 212', title: 'Construction Plumbing & Estimates', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Research 2', title: 'Technology research 2 (Undergraduate thesis/research Paper/research Project', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Technology Research Methods of Research'], standing: null, note: 'Research 1', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'RAC 7', title: 'Refrigeration plant Designing', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Ice Plant NCIII' },
          { excludedFromGwa: false, code: 'Prof Ed 4', title: 'The Andragogy of learning including principles of TM 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 5', title: 'Assessment of Learning 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 5', title: 'Strategic management', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Prof Ed 6', title: 'Technology for teaching and learning 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'FL 1', title: 'Foreign Language', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-diamt',
    programId: 'prog-diamt',
    code: 'DIAMT',
    name: 'Diploma in Industrial Automation and Mechatronics Technology (Leading to BSECE and BSEE)',
    versionLabel: '',
    effectivity: 'Revised Training Year 2022-2025',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Mathematics in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SAF 101', title: 'Basic Occupational Safety and Health', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CALC 1', title: 'Engineering Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 1', title: 'Chemistry for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'DRAW 101', title: 'Engineering Drawing and Plans', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAMR 111', title: 'Mechatronics and Automation Devices', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Mechatronics Servicing NCII' },
          { excludedFromGwa: false, code: 'IAMR 112', title: 'Building Wiring and Installation', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Electrical Installation and Maintenance NCII' },
          { excludedFromGwa: true, code: 'PE 1', title: 'Movement Enhancement', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'CALC 2', title: 'Engineering Calculus 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'CALC 1', qualification: '' },
          { excludedFromGwa: false, code: 'PHYS 1', title: 'Physics for Engineers', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'CALC 1', qualification: '' },
          { excludedFromGwa: false, code: 'IAMR 121', title: 'Programmable Logic Controllers', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Mechatronics and Automation Devices'], standing: null, note: 'IAMR 111', qualification: 'Mechatronics Servicing NCIII' },
          { excludedFromGwa: false, code: 'IAMR 122', title: 'Motor Control Devices and Circuits', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Building Wiring and Installation'], standing: null, note: 'IAMR 112', qualification: 'EIM NCIII' },
          { excludedFromGwa: false, code: 'ICT 101', title: 'Computer Programming', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'DRAW 102', title: 'Computer Aided Drafting', units: 1, lecHours: 0, labHours: 3, prereqTitles: ['Engineering Drawing and Plans'], standing: null, note: 'DRAW 101', qualification: 'Technical Drafting NCII' },
          { excludedFromGwa: false, code: 'GE CW', title: 'Contemporary World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 2', title: 'Fitness Exercises', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Enhancement'], standing: null, note: 'PE 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 1', title: 'Supervised Industrial Training 1', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE ARTS', title: 'Art Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE US', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 211', title: 'Electrical Circuits 1', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'CALC 2', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 212', title: 'Electronic Devices and Circuits', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'CALC 2; Co Req: IAMT 211', qualification: '' },
          { excludedFromGwa: false, code: 'IAMR 211', title: 'Computer System Architecture', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'CSS NCII' },
          { excludedFromGwa: false, code: 'IAMT 213', title: 'Differential Equations', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: 'Co Req: IAMT 211', qualification: '' },
          { excludedFromGwa: false, code: 'RES 1', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'CALC 2', qualification: '' },
          { excludedFromGwa: false, code: 'SAF 102', title: 'Construction Occupational Safety and Health', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Basic Occupational Safety and Health'], standing: null, note: 'SAF 101', qualification: '' },
          { excludedFromGwa: true, code: 'PE 3', title: 'Physical Activities toward health and fitness 1 (dance & music)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Fitness Exercises'], standing: null, note: 'PE 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'IAMT 221', title: 'Engineering Mechanics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 222', title: 'Electrical Circuits 2', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electrical Circuits 1'], standing: null, note: 'IAMT 211', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 223', title: 'Basic Thermodynamics', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 224', title: 'Electronic Circuits Analysis & Design', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electronic Devices and Circuits'], standing: null, note: 'IAMT 212', qualification: '' },
          { excludedFromGwa: false, code: 'IAMR 221', title: 'Consumer Electronics', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'EPAS NCII' },
          { excludedFromGwa: false, code: 'GE HISTORY 1', title: 'Readings in Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ETHICS', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'RES 2', title: 'Capstone Design Project 1', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'RES 1', qualification: '' },
          { excludedFromGwa: true, code: 'PE 4', title: 'Physical Activities Towards Health and Fitness 2 (Team Sports)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physical Activities toward health and fitness 1 (dance & music)'], standing: null, note: 'PE 3', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 2', title: 'Supervised Industrial Training 2', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE STS', title: 'Science, Technology, and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 311', title: 'Engineering Economics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'CALC 2', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 312', title: 'Logic Circuits Design and Switching Theory', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Electronic Circuits Analysis & Design'], standing: null, note: 'IAMT 224', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 313', title: 'Electromagnetics', units: 4, lecHours: 4, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'IAMR 311', title: 'Human Machine Interface', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Programmable Logic Controllers'], standing: null, note: 'IAMR 121', qualification: 'Mechatronics NC IV' },
          { excludedFromGwa: false, code: 'IAMR 312', title: 'PLC Based Motor Control System', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Motor Control Devices and Circuits'], standing: null, note: 'IAMR 122', qualification: 'EIM NC IV' },
          { excludedFromGwa: false, code: 'RES 3', title: 'Capstone Design Project 2', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Capstone Design Project 1'], standing: null, note: 'RES 2', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'TECHNO 1', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 321', title: 'Microprocessor and Microcontroller Systems', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Logic Circuits Design and Switching Theory'], standing: null, note: 'IAMT 312', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 322', title: 'Engineering Management', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Engineering Economics'], standing: null, note: 'IAMT 311', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 323', title: 'Mechanics of Deformable Bodies', units: 4, lecHours: 4, labHours: 0, prereqTitles: ['Engineering Mechanics'], standing: null, note: 'IAMT 221', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 324', title: 'Material Science and Engineering', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Chemistry for Engineers'], standing: null, note: 'NPS 1', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 325', title: 'EE Laws, Codes, and Professional Ethics', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: 3, note: '3rd yr standing', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 326', title: 'Electrical Standard and Practices', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: 3, note: '3rd yr standing', qualification: '' },
          { excludedFromGwa: false, code: 'IAMT 327', title: 'Fluid Mechanics', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Physics for Engineers'], standing: null, note: 'PHYS 1', qualification: '' },
          { excludedFromGwa: false, code: 'GE HISTORY 2', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'FL 101', title: 'Foreign Language (Korean Language and Culture)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dit-2022',
    programId: 'prog-dit',
    code: 'DIT-2022',
    name: 'Diploma in Information Technology (Leading to BSIT, BTVTEd & BMMA)',
    versionLabel: '2022',
    effectivity: '2022 edition — still in effect for trainees enrolled under it',
    supersededBy: 'DIT (revised May 2024, Batch 7)',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Maths in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BOSH 1', title: 'Basic Occupational Safety and Health', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TDV', title: 'Technical Drawing for Visual Graphics Design', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'VGD NC III COC 4' },
          { excludedFromGwa: false, code: 'CC101', title: 'Introduction to Computing', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'VGD', title: 'Multimedia Art 1 (Visual Graphics Design)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'VGD NC III COC 1&3' },
          { excludedFromGwa: false, code: 'HCI 101', title: 'Intro to Human Computer Interaction', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: 'VGD NC III COC 2 (UI)' },
          { excludedFromGwa: false, code: 'GE STS', title: 'Science, Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 1', title: 'Movement Enhancement', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'MS 101', title: 'Discrete Mathematics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'PT101', title: 'Platform Technologies', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: 'Web Dev\'t NC III COC-1' },
          { excludedFromGwa: false, code: 'SP101', title: 'Social and Professional Issues', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Web Dev\'t NC III COC-1' },
          { excludedFromGwa: false, code: 'WS101', title: 'Web Systems and Technologies', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Web Dev\'t NC III COC-3' },
          { excludedFromGwa: false, code: 'HCI 102', title: 'Human Computer Interaction 2', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Intro to Human Computer Interaction'], standing: null, note: 'HCI 101', qualification: 'VGD NC III COC 2 (UX)' },
          { excludedFromGwa: false, code: 'IM101', title: 'Fundamentals of Database Management Systems', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: 'Web Dev\'t NC III COC-3' },
          { excludedFromGwa: false, code: 'IAS101', title: 'Information Assurance and Security 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Web Dev\'t NC III COC-3' },
          { excludedFromGwa: false, code: 'CC102', title: 'Computer Programming 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: 'Web Dev\'t NC III COC-2' },
          { excludedFromGwa: true, code: 'PE 2', title: 'Fitness Exercises', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Enhancement'], standing: null, note: 'PE 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'Gen Psy', title: 'General Psychology', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE History', title: 'Readings in Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAS102', title: 'Information Assurance and Security 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Information Assurance and Security 1'], standing: null, note: 'IAS 101', qualification: 'Web Dev\'t NC III COC-3' },
          { excludedFromGwa: false, code: 'CSS', title: 'Computer Architecture and Organization (with networking)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: 'CSS NC II' },
          { excludedFromGwa: false, code: 'CC103', title: 'Computer Programming 2', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Computer Programming 1'], standing: null, note: 'CC 102', qualification: 'Game Art Dev\'t NC III' },
          { excludedFromGwa: false, code: 'ANI2D', title: 'Multimedia Art 2 (2D Animation)', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Multimedia Art 1 (Visual Graphics Design)'], standing: null, note: 'VGD', qualification: '2D Animation NC III' },
          { excludedFromGwa: false, code: 'FL', title: 'Foreign Language', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 3', title: 'Physical Activities Towards Health and Fitness 1 (Dance & Music)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Fitness Exercises'], standing: null, note: 'PE 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'SOC SCI 1', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE US', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MOR', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SA101', title: 'Systems Administration and Maintenance', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Information Assurance and Security 2', 'Computer Architecture and Organization (with networking)', 'Fundamentals of Database Management Systems'], standing: null, note: 'IAS 102; CSS; IM 101', qualification: 'Web Dev\'t NC III COC-1' },
          { excludedFromGwa: false, code: 'IPT102', title: 'Integrative Programming Technologies', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: 'Game Art Dev\'t NC III COCs' },
          { excludedFromGwa: false, code: 'PF101', title: 'Object-Oriented Programming', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: 'Web Dev\'t NC III COC-2' },
          { excludedFromGwa: false, code: 'GE Arts', title: 'Art Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE Ethics', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 1', title: 'Management Theory and Practices', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PE 4', title: 'Physical Activities Towards Health and Fitness 2 (Team Sports)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physical Activities Towards Health and Fitness 1 (Dance & Music)'], standing: null, note: 'PE 3', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 1', title: 'Supervised Industry Training 1 (Practicum)', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'ANI 3D', title: 'Multimedia Art 3 3D Animation', units: 6, lecHours: 3, labHours: 9, prereqTitles: ['Multimedia Art 2 (2D Animation)'], standing: null, note: 'ANI 2D', qualification: '3D Animation NC III COCs' },
          { excludedFromGwa: false, code: 'GA', title: 'Multimedia Art 4 Game Art', units: 5, lecHours: 3, labHours: 6, prereqTitles: ['Computer Programming 2'], standing: null, note: 'ANI 2D & 3D; CC103', qualification: 'Game Art Dev\'t NC III COCs' },
          { excludedFromGwa: false, code: 'MGT 2', title: 'Customer Relations & Negotiations', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Management Theory and Practices'], standing: null, note: 'MGT 1', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 3', title: 'Self-Efficacy and Leadership', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Customer Relations & Negotiations'], standing: null, note: 'MGT 2', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 4', title: 'People Skills and Stress Management', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Self-Efficacy and Leadership'], standing: null, note: 'MGT 3', qualification: '' },
          { excludedFromGwa: false, code: 'CC105', title: 'Information Management', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: 'Web Dev\'t NC III COC-3' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'MGT5', title: 'Strategic Management and Project management', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['People Skills and Stress Management'], standing: null, note: 'MGT 4', qualification: '' },
          { excludedFromGwa: false, code: 'GE CW', title: 'The Contemporary World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SIA101', title: 'System Integration and Architecture 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Information Management'], standing: null, note: 'CC 105', qualification: 'Game Art Dev\'t NC III COCs' },
          { excludedFromGwa: false, code: 'TP1', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CC106', title: 'Application Development & Emerging Technologies', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: 'Web Dev\'t NC III COC-1' },
          { excludedFromGwa: false, code: 'CC104', title: 'Data Structure & Algorithms', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: 'Web Dev\'t NC III COC-2' },
          { excludedFromGwa: false, code: 'CAP', title: 'Capstone Project Research', units: 6, lecHours: 3, labHours: 9, prereqTitles: ['Methods of Research'], standing: null, note: 'MOR', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIT 2', title: 'Supervised Industry Training 2 (Practicum)', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dit',
    programId: 'prog-dit',
    code: 'DIT',
    name: 'Diploma in Information Technology (Leading to BSIT & BMMA)',
    versionLabel: '',
    effectivity: 'Revised Training Year 2024-2027 (Batch 7)',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Mathematics in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BOSH 1', title: 'Basic Occupational Safety and Health', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TD', title: 'Technical Drafting', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Tech. Drafting NC II' },
          { excludedFromGwa: false, code: 'CC101', title: 'Introduction to Computing', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'VGD', title: 'Multimedia Art 1 (Visual Graphics Design)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'VGD NC III' },
          { excludedFromGwa: false, code: 'SP101', title: 'Social and Professional Issues', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE STS', title: 'Science, Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHfit 1', title: 'Movement Competency Training', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'National Service Training Program 1', units: 0, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'MS 101', title: 'Discrete Mathematics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'PT101', title: 'Platform Technologies', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'HCI 101', title: 'Intro to Human Computer Interaction 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: '' },
          { excludedFromGwa: false, code: 'WS101', title: 'Web Systems and Technologies', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Gen Psy', title: 'General Psychology', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IM101', title: 'Fundamentals of Database Management Systems', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'IAS101', title: 'Information Assurance and Security 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CC102', title: 'Computer Programming 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: '' },
          { excludedFromGwa: true, code: 'PATHfit 2', title: 'Exercise-Based Fitness Activity', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training'], standing: null, note: 'PATHfit 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'National Service Training Program 2', units: 0, lecHours: 0, labHours: 0, prereqTitles: ['National Service Training Program 1'], standing: null, note: 'NSTP 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'HCI 102', title: 'Human Computer Interaction 2', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Intro to Human Computer Interaction 1'], standing: null, note: 'HCI 101', qualification: '' },
          { excludedFromGwa: false, code: 'IAS102', title: 'Information Assurance and Security 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Information Assurance and Security 1'], standing: null, note: 'IAS 101', qualification: '' },
          { excludedFromGwa: false, code: 'CSS', title: 'Computer Architecture and Organization (with networking)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: 'CSSC NC II' },
          { excludedFromGwa: false, code: 'CC103', title: 'Computer Programming 2', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Computer Programming 1'], standing: null, note: 'CC 102', qualification: '' },
          { excludedFromGwa: false, code: 'TA', title: 'Traditional Animation', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'Animation NC II' },
          { excludedFromGwa: false, code: 'ANI2D', title: 'Multimedia Art 2 (2D Animation)', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '2D Animation NC III' },
          { excludedFromGwa: false, code: 'FL', title: 'Foreign Language', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHfit 3', title: 'Menu of Dances, Sports, Martial Arts, Group Exercise, Outdoor & Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Exercise-Based Fitness Activity'], standing: null, note: 'PATHfit 2', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'SOC SCI 1', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE Arts', title: 'Art Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE History', title: 'Readings in Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MOR', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SA101', title: 'Systems Administration and Maintenance', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Information Assurance and Security 2', 'Computer Architecture and Organization (with networking)', 'Fundamentals of Database Management Systems'], standing: null, note: 'IAS 102; CSS; IM 101', qualification: '' },
          { excludedFromGwa: false, code: 'IPT102', title: 'Integrative Programming Technologies', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: '' },
          { excludedFromGwa: false, code: 'PF101', title: 'Object-Oriented Programming', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: '' },
          { excludedFromGwa: false, code: 'GE Ethics', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 1', title: 'Management Theory and Practices', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHfit 4', title: 'Menu of Dances, Sports, Martial Arts, Group Exercise, Outdoor & Adventure Activities', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Menu of Dances, Sports, Martial Arts, Group Exercise, Outdoor & Adventure Activities'], standing: null, note: 'PATHfit 3', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIL 1', title: 'Supervised Industry Learning 1 (Practicum)', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'GE US', title: 'Understanding the Self', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ANI 3D', title: 'Multimedia Art 3 3D Animation', units: 6, lecHours: 3, labHours: 9, prereqTitles: ['Multimedia Art 2 (2D Animation)'], standing: null, note: 'ANI 2D', qualification: '' },
          { excludedFromGwa: false, code: 'GA', title: 'Multimedia Art 4 Game Art', units: 5, lecHours: 3, labHours: 6, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC103', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 2', title: 'Customer Relations & Negotiations', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Management Theory and Practices'], standing: null, note: 'MGT 1', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 3', title: 'Self-Efficacy and Leadership', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Customer Relations & Negotiations'], standing: null, note: 'MGT 2', qualification: '' },
          { excludedFromGwa: false, code: 'MGT 4', title: 'People Skills and Stress Management', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Self-Efficacy and Leadership'], standing: null, note: 'MGT 3', qualification: '' },
          { excludedFromGwa: false, code: 'CC105', title: 'Information Management', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Introduction to Computing'], standing: null, note: 'CC 101', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'MGT5', title: 'Strategic Management and Project Management', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['People Skills and Stress Management'], standing: null, note: 'MGT 4', qualification: '' },
          { excludedFromGwa: false, code: 'GE CW', title: 'The Contemporary World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'SIA101', title: 'System Integration and Architecture 1', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Information Management'], standing: null, note: 'CC 105', qualification: '' },
          { excludedFromGwa: false, code: 'TP1', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CC106', title: 'Application Development & Emerging Technologies', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Computer Programming 2'], standing: null, note: 'CC 103', qualification: '' },
          { excludedFromGwa: false, code: 'CC104', title: 'Data Structure & Algorithms', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Computer Programming 2', 'Discrete Mathematics'], standing: null, note: 'CC 103; MS 101', qualification: 'Web Dev\'t NC III' },
          { excludedFromGwa: false, code: 'CAP', title: 'Capstone Project Research', units: 6, lecHours: 3, labHours: 9, prereqTitles: ['Methods of Research'], standing: null, note: 'MOR', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SUMMER',
        subjects: [
          { excludedFromGwa: false, code: 'SIL 2', title: 'Supervised Industry Learning 2 (Practicum)', units: 6, lecHours: 0, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dmat',
    programId: 'prog-dmat',
    code: 'DMAT',
    name: 'Diploma in Multimedia Arts Technology',
    versionLabel: '',
    effectivity: '2026-2028 (Batch 1)',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'ANI01', title: '2D Basic Animation & Motion', units: 6, lecHours: 2, labHours: 12, prereqTitles: [], standing: null, note: '', qualification: '2D Basic Animation NC II' },
          { excludedFromGwa: false, code: 'MMA 01', title: 'Drawing I', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 02', title: 'Introduction to Multimedia', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 03', title: 'Elements and Principle of Design', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 04', title: 'Color Theory', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE01', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 01', title: 'NSTP I', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATH FIT 1', title: 'PATHFit I', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'MMA 05', title: 'Visual Design, Layout & Branding', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Visual Graphic Design NC III' },
          { excludedFromGwa: false, code: 'MMA 06', title: 'Principles of Advertising & Marketing', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Elements and Principle of Design', 'Color Theory'], standing: null, note: 'MMA03; MMA04', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 07', title: 'Typography and Layout', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Elements and Principle of Design', 'Color Theory'], standing: null, note: 'MMA03; MMA04', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 08', title: 'Digital Photography', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Elements and Principle of Design'], standing: null, note: 'MMA03', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 01.2', title: 'Drawing II', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Drawing I'], standing: null, note: 'MMA01', qualification: '' },
          { excludedFromGwa: false, code: 'GE02', title: 'Life and Work of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'NSTP II', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['NSTP I'], standing: null, note: 'NSTP 1', qualification: '' },
          { excludedFromGwa: true, code: 'PATH FIT II', title: 'PATHFit II', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['PATHFit I'], standing: null, note: 'PATHfit 1', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'ANI02', title: '2D Animation (Paperless)', units: 5, lecHours: 1, labHours: 12, prereqTitles: ['Visual Design, Layout & Branding'], standing: null, note: 'MMA05', qualification: '2D Animation NC III' },
          { excludedFromGwa: false, code: 'MMA 09', title: 'Scriptwriting and Storyboarding', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE03', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 10', title: 'Digital Arts and Illustration', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Typography and Layout'], standing: null, note: 'MMA07', qualification: '' },
          { excludedFromGwa: false, code: 'FL01', title: 'Foreign Language', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 11', title: 'Writing for New Media', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 12', title: 'Teamwork and Professionalism', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATH FIT III', title: 'PATHfit 3', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['PATHFit II'], standing: null, note: 'PATHFit II', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'ANI03', title: '2D Animation (CUTOUT)', units: 6, lecHours: 2, labHours: 12, prereqTitles: ['2D Animation (Paperless)'], standing: null, note: 'ANI02', qualification: '2D Animation (CUTOUT) NC III' },
          { excludedFromGwa: false, code: 'MMA 13', title: 'Advanced Character Rigging (Intro)', units: 2, lecHours: 0, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 14', title: 'Digital Marketing & SEO', units: 4, lecHours: 4, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TP01', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 15', title: 'Interactive Media Design', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Digital Arts and Illustration'], standing: null, note: 'MMA10', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 15', title: 'Fundamentals of Film and Video Production', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Writing for New Media', 'Digital Photography'], standing: null, note: 'MMA 11; MMA08', qualification: '' },
          { excludedFromGwa: true, code: 'PATH FIT IV', title: 'PATHfit 4', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['PATHfit 3'], standing: null, note: 'PATHFit III', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'MMA 16', title: '3D Modeling, Texturing & Lighting', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['Advanced Character Rigging (Intro)'], standing: null, note: 'MMA13', qualification: 'CS:3D Animation NCIII (Modelling); CS:3D Animation NCIII (Texturing); CS:3D Animation NCIII (Lighting)' },
          { excludedFromGwa: false, code: 'MMA 17', title: 'Advanced Character Animation', units: 2, lecHours: 0, labHours: 6, prereqTitles: ['2D Basic Animation & Motion'], standing: null, note: 'ANI01', qualification: 'CS:3D Animation NCIII (Animation)' },
          { excludedFromGwa: false, code: 'MMA 19', title: 'Portfolio Development', units: 3, lecHours: 1, labHours: 6, prereqTitles: ['Technopreneurship'], standing: null, note: 'TP01', qualification: '' },
          { excludedFromGwa: false, code: 'RES1', title: 'Capstone I', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 20', title: 'Digital Sound Production', units: 5, lecHours: 4, labHours: 3, prereqTitles: ['Interactive Media Design'], standing: null, note: 'MMA15', qualification: '' },
          { excludedFromGwa: false, code: 'MMA 21', title: 'Multimedia Publishing', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Capstone II', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Capstone I'], standing: null, note: 'RES1', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Internship (648 hours)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-dmet-mach',
    programId: 'prog-dmet-mach',
    code: 'DMET-MACH',
    name: 'Diploma in Mechanical Engineering Technology (Specialized in Machining)',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: 'WTP 1', title: 'Workshop Theory and Practice 1', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: '', qualification: 'MACHINING NC I' },
          { excludedFromGwa: true, code: 'PATHFit 1', title: 'Movement Competency Training or MCT Activities Toward Health and Fitness 1', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'Civic Welfare Training Service 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TD 1', title: 'Engineering Drawing', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CAL 1', title: 'Engineering Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 1/L', title: 'Chemistry for Engineers / Lab', units: 2, lecHours: 1, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Mathematics in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE HISTORY', title: 'Readings in Philippine History', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ETH', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Intermediate Machining', units: 5, lecHours: 2, labHours: 9, prereqTitles: ['Workshop Theory and Practice 1'], standing: null, note: 'WTP 1', qualification: 'MACHINING NC II' },
          { excludedFromGwa: true, code: 'PATHFit 2', title: 'Exercise-based Fitness Activity', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training or MCT Activities Toward Health and Fitness 1'], standing: null, note: 'PATHFIT 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 2', title: 'Civic Welfare Training Service 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Civic Welfare Training Service 1'], standing: null, note: 'NSTP 1', qualification: '' },
          { excludedFromGwa: false, code: 'CAL 2', title: 'Engineering Calculus 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'CAL 1', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 2/L', title: 'Physics for Engineers / Lab', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'CAL 1 (co-req CAL 2)', qualification: '' },
          { excludedFromGwa: false, code: 'BES PROG', title: 'Computer Fundamentals & Programming', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BES ECO', title: 'Engineering Economics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'ATS', title: 'Automotive Theories and Practices', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'CNC Milling Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'CNC MILLING MACHINE OPERATION NC II' },
          { excludedFromGwa: false, code: '', title: 'CNC Lathe Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'CNC LATHE MACHINE OPERATION NC II' },
          { excludedFromGwa: false, code: 'WP', title: 'Welding Theories and Practices', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'PATHFIT 3', title: 'Physical Activities Toward Health and Fitness 3', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Exercise-based Fitness Activity'], standing: null, note: 'PATHFIT 2', qualification: '' },
          { excludedFromGwa: false, code: 'STAT', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'CAL 2', qualification: '' },
          { excludedFromGwa: false, code: 'ELECT/L', title: 'Basic Electrical Engineering / Lab', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'NPS 2; CAL 2', qualification: '' },
          { excludedFromGwa: false, code: 'GE SOCSCI', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'FL', title: 'Foreign Language', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'TD 2', title: 'Computer Aided Drafting', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: 'TECHNICAL DRAFTING NC II' },
          { excludedFromGwa: false, code: '', title: 'Computer Hardware and Servicing', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'COMPUTER SYSTEMS SERVICING NC II' },
          { excludedFromGwa: true, code: 'PATHFIT 4', title: 'Physical Activities Toward Health and Fitness 4', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physical Activities Toward Health and Fitness 3'], standing: null, note: 'PATHFIT 3', qualification: '' },
          { excludedFromGwa: false, code: 'MECHA', title: 'Mechatronics Operations and Maintenance', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Basic Electrical Engineering / Lab'], standing: null, note: 'ELECT/L', qualification: '' },
          { excludedFromGwa: false, code: 'RAC', title: 'Refrigeration and Air-Conditioning Processes', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Basic Electrical Engineering / Lab'], standing: null, note: 'ELECT/L', qualification: '' },
          { excludedFromGwa: false, code: 'RES 1', title: 'Methods of Research for ME', units: 1, lecHours: 1, labHours: 0, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'STAT', qualification: '' },
          { excludedFromGwa: false, code: 'BES BOSH', title: 'Basic Occupational Safety and Health', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BES TECH', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BES MGT', title: 'Engineering Management', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE ARTS', title: 'Arts Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE SCITECH', title: 'Science, Technology, and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'CAD/CAM Applications', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'CAD/CAM OPERATION NC III' },
          { excludedFromGwa: false, code: '', title: 'Advanced Machining', units: 5, lecHours: 2, labHours: 9, prereqTitles: [], standing: null, note: 'Machining NC II', qualification: 'MACHINING NC III' },
          { excludedFromGwa: false, code: '', title: 'Advanced CNC Lathe Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'CNC Lathe Machine Operation NC II', qualification: 'CNC LATHE MACHINE OPERATION NC III' },
          { excludedFromGwa: false, code: '', title: 'Advanced CNC Milling Operations', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: 'CNC Milling Machine Operation NC II', qualification: 'CNC MILLING MACHINE OPERATION NC III' },
          { excludedFromGwa: false, code: 'RES 2', title: 'ME Project Study 1', units: 1, lecHours: 0, labHours: 3, prereqTitles: ['Methods of Research for ME'], standing: null, note: 'RES 1', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'RES 3', title: 'ME Project Study 2', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['ME Project Study 1'], standing: null, note: 'RES 2', qualification: 'RES 3 - ME Project Study 2' },
          { excludedFromGwa: false, code: '', title: 'Internship (600 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: 'all courses with resultant qualifications', qualification: 'Internship (600 HRS)' },
        ],
      },
    ],
  },
  {
    id: 'cur-dmet-weld',
    programId: 'prog-dmet-weld',
    code: 'DMET-WELD',
    name: 'Diploma in Mechanical Engineering Technology (Specialized in Welding)',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Shielded Metal Arc Welding NCI', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Shielded Metal Arc Welding NCI' },
          { excludedFromGwa: false, code: '', title: 'Gas Metal Arc Welding NCI', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Gas Metal Arc Welding NCI' },
          { excludedFromGwa: true, code: 'PATHFIT I', title: 'Movement Competency Training or (MCT) Activities Toward Health and Fitness 1', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP 1', title: 'Civic Welfare Training Service 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'TD 1', title: 'Engineering Drawing and Plans', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'NPS1/L', title: 'Chemistry for Engineers / Lab', units: 4, lecHours: 3, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'CAL 1', title: 'Engineering Calculus 1', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BOSH', title: 'Basic Occupational, Safety and Health for ME', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Shielded Metal Arc Welding NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Shielded Metal Arc Welding NCI'], standing: null, note: 'Shielded Metal Arc Welding NCI', qualification: 'Shielded Metal Arc Welding NCII' },
          { excludedFromGwa: false, code: '', title: 'Gas Metal Arc Welding NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Gas Metal Arc Welding NCI'], standing: null, note: 'Gas Metal Arc Welding NCI', qualification: 'Gas Metal Arc Welding NCII' },
          { excludedFromGwa: true, code: 'PATHFIT 2', title: 'Exercise-Based Fitness Activity', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training or (MCT) Activities Toward Health and Fitness 1'], standing: null, note: 'PATHFIT 1', qualification: '' },
          { excludedFromGwa: true, code: 'NSTP2', title: 'Civic Welfare Training Service 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Civic Welfare Training Service 1'], standing: null, note: 'NSTP 1', qualification: '' },
          { excludedFromGwa: false, code: 'TD 2', title: 'Computer Aided Drafting', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: 'Engineering Drawing', qualification: 'Technical Drafting NC II (Mechanical)' },
          { excludedFromGwa: false, code: 'WTP', title: 'Workshop Theory and Practice (Welding Metallurgy)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'Cal 2', title: 'Engineering Calculus 2', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'Cal 1', qualification: '' },
          { excludedFromGwa: false, code: 'GE SOCSCI', title: 'Life and Works of Rizal', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE MATH', title: 'Mathematics in the Modern World', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Gas Tungsten Arc Welding NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Shielded Metal Arc Welding NCII'], standing: null, note: 'Shielded Metal Arc Welding NCII', qualification: 'Gas Tungsten Arc Welding NCII' },
          { excludedFromGwa: false, code: '', title: 'Pipe Fitting Metallic NCII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Shielded Metal Arc Welding NCII'], standing: null, note: 'Shielded Metal Arc Welding NCII', qualification: 'Pipe Fitting Metallic NCII' },
          { excludedFromGwa: true, code: 'PATHFIT 3', title: 'Physical Activities Toward Health and Fitness 3', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Exercise-Based Fitness Activity'], standing: null, note: 'PATHFIT 2', qualification: '' },
          { excludedFromGwa: false, code: 'NPS 2/L', title: 'Physics for Engineers / Lab', units: 4, lecHours: 3, labHours: 3, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'Cal 1', qualification: '' },
          { excludedFromGwa: false, code: 'MST', title: 'Machine Shop Theory (Welding Inspection, Quality Control, and Basic Flux Cored Arc Welding)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Workshop Theory and Practice (Welding Metallurgy)'], standing: null, note: 'WTP', qualification: '' },
          { excludedFromGwa: false, code: 'STAT', title: 'Engineering Data Analysis', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Calculus 1'], standing: null, note: 'Cal 1', qualification: '' },
          { excludedFromGwa: false, code: 'BES MGT', title: 'Engineering Management', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'FL', title: 'Foreign Language', units: 2, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE SCITECH', title: 'Science, Technology and Society', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Shielded Metal Arc Welding NCIII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Shielded Metal Arc Welding NCII'], standing: null, note: 'Shielded Metal Arc Welding NCII', qualification: 'Shielded Metal Arc Welding NCIII' },
          { excludedFromGwa: false, code: '', title: 'Gas Metal Arc Welding NCIII', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Gas Metal Arc Welding NCII'], standing: null, note: 'Gas Metal Arc Welding NCII', qualification: 'Gas Metal Arc Welding NCIII' },
          { excludedFromGwa: true, code: 'PATHFIT 4', title: 'Physical Activities Toward Health and Fitness 4', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Physical Activities Toward Health and Fitness 3'], standing: null, note: 'PATHFIT 3', qualification: '' },
          { excludedFromGwa: false, code: 'RES 1', title: 'Methods of Research', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Engineering Data Analysis'], standing: null, note: 'STAT', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Computer Systems Servicing NC II', units: 3, lecHours: 1, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'COMPUTER SYSTEMS SERVICING NC II' },
          { excludedFromGwa: false, code: 'ELECT/L', title: 'Basic Electrical Engineering', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Engineering Calculus 2'], standing: null, note: 'NPS2; Cal 2', qualification: '' },
          { excludedFromGwa: false, code: 'GE ARTS', title: 'Arts Appreciation', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'GE-ENG', title: 'Purposive Communication', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Shielded Metal Arc Welding NCIV', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Shielded Metal Arc Welding NCIII'], standing: null, note: 'Shielded Metal Arc Welding NCIII', qualification: 'Shielded Metal Arc Welding NCIV' },
          { excludedFromGwa: false, code: '', title: 'Gas Tungsten Arc Welding NCIV', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Gas Tungsten Arc Welding NCII'], standing: null, note: 'Gas Tungsten Arc Welding NCII', qualification: 'Gas Tungsten Arc Welding NCIV' },
          { excludedFromGwa: false, code: 'RES 2', title: 'Project Development in Specialized Field I (Proposal)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Project Development in Specialized Field I (Proposal)'], standing: null, note: 'Project Development in Specialized Field I (Proposal)', qualification: '' },
          { excludedFromGwa: false, code: 'BES TECH', title: 'Technopreneurship', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'BES PROG', title: 'Computer Fundamentals & Programming', units: 1, lecHours: 0, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: 'RAC', title: 'Refrigeration and Air Conditioning Processes', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Basic Electrical Engineering'], standing: null, note: 'ELECT/L', qualification: '' },
          { excludedFromGwa: false, code: 'GE-ETH', title: 'Ethics', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: 'RES 3', title: 'Project Development in Specialized Field II', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Project Development in Specialized Field I (Proposal)'], standing: null, note: 'Project Development in Specialized Field I (Proposal)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
    ],
  },
  {
    id: 'cur-drot',
    programId: 'prog-drot',
    code: 'DROT',
    name: 'Diploma in Restaurant Operations Technology (Supervisory and Administration)',
    versionLabel: '',
    effectivity: '5 Academic Semester, 1 Semester Internship',
    supersededBy: '',
    terms: [
      {
        yearLevel: 1,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Purposive Communication (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Mathematics in the Modern World (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals of Accounting/Business and Management (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Macro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Kitchen Essentials & Basic Food Preparation (Core)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Cookery NC II' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
        ],
      },
      {
        yearLevel: 1,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Science, Technology and Society (Basic/GE)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Professional Development and Applied Ethics (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Micro Perspective of Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Macro Perspective of Tourism and Hospitality (Common)'], standing: null, note: 'Macro Perspective of Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Entrepreneurship in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Fundamentals of Accounting/Business and Management (Common)'], standing: null, note: 'Fundamentals of Accounting/Business and Management (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Applied Business Tools and Technologies (POS) (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals in Food Service Operations (Core)', units: 4, lecHours: 2, labHours: 6, prereqTitles: [], standing: null, note: '', qualification: 'Food and Beverage Services NC II' },
          { excludedFromGwa: true, code: '', title: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 1) (Basic/GE mandated)', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'National Service Training Program 2 (CWTS) (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)'], standing: null, note: 'National Service Training Program 1 (LTS/CWTS/ROTC) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Life and Works of Rizal (Basic/GE mandated)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Philippine Culture and Tourism Geography (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Foreign Language 1 (Common) Korean Language Basic', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Quality Service Management in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Gastronomy (Food and Culture)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Bar and Beverage Service (Core)', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Bartending NC II' },
          { excludedFromGwa: false, code: '', title: 'Fundamentals in Coffee Operations (Core)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Risk Management as Applied to Safety, Security and Sanitation (Common)'], standing: null, note: 'Risk Management as Applied to Safety, Security and Sanitation (Common)', qualification: 'Barista NC II' },
          { excludedFromGwa: true, code: '', title: 'Pathfit 3', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Movement Competency Training (PATHFit 1) (Basic/GE mandated)'], standing: null, note: 'Movement Competency Training (PATHFit 2) (Basic/GE mandated)', qualification: '' },
        ],
      },
      {
        yearLevel: 2,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Strategic Management in Tourism (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Quality Service Management in Tourism and Hospitality (Common)'], standing: null, note: 'Quality Service Management in Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Ergonomics and Facilities Planning for the Hospitality Industry (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Foreign Language 2 (Common) Korean Language Advanced', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Foreign Language 1 (Common) Korean Language Basic'], standing: null, note: 'Foreign Language 1 (Common) Korean Language Basic', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Intro to MICE', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Introduction to Transport (Merge All - Cruise, Airline, Land with Industry Seminar and Tour)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Food and Beverage Operations (Core)', units: 4, lecHours: 2, labHours: 6, prereqTitles: ['Kitchen Essentials & Basic Food Preparation (Core)', 'Fundamentals in Food Service Operations (Core)'], standing: null, note: 'Kitchen Essentials & Basic Food Preparation (Core); Fundamentals in Food Service Operations', qualification: 'Food and Beverage services NC III' },
          { excludedFromGwa: false, code: '', title: 'Bar and Beverage Operations', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Bar and Beverage Service (Core)', 'Fundamentals in Coffee Operations (Core)'], standing: null, note: 'Bar and Beverage Service; Fundamentals in Coffee Operations', qualification: '' },
          { excludedFromGwa: true, code: '', title: 'Pathfit 4', units: 2, lecHours: 2, labHours: 0, prereqTitles: ['Pathfit 3'], standing: null, note: 'Pathfit 3', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'FIRST',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Operations Management in Tourism and Hospitality Industry (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: ['Quality Service Management in Tourism and Hospitality (Common)'], standing: null, note: 'Quality Service Management in Tourism and Hospitality (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Tourism and Hospitality Marketing (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Multicultural Diversity in Workplace for the Tourism Professional (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Legal Aspects in Tourism and Hospitality (Common)', units: 3, lecHours: 3, labHours: 0, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Research in Hospitality (Research 1) (Common)', units: 3, lecHours: 2, labHours: 3, prereqTitles: [], standing: null, note: '', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Food and Beverage Cost Control (Core)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Food and Beverage Operations (Core)'], standing: null, note: 'Food and Beverage Operations (FBS NC III)', qualification: 'Food and Beverage Services NC IV' },
          { excludedFromGwa: false, code: '', title: 'Bar and Beverage Management (Core)', units: 3, lecHours: 2, labHours: 3, prereqTitles: ['Bar and Beverage Operations'], standing: null, note: 'Bar and Beverage Operations', qualification: '' },
        ],
      },
      {
        yearLevel: 3,
        period: 'SECOND',
        subjects: [
          { excludedFromGwa: false, code: '', title: 'Capstone', units: 2, lecHours: 1, labHours: 3, prereqTitles: ['Research in Hospitality (Research 1) (Common)'], standing: null, note: 'Research in Hospitality (Research 1) (Common)', qualification: '' },
          { excludedFromGwa: false, code: '', title: 'Internship (648 HRS)', units: 12, lecHours: 0, labHours: 36, prereqTitles: [], standing: null, note: 'All Academic Courses', qualification: '' },
        ],
      },
    ],
  },
];
