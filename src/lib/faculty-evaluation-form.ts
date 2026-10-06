/**
 * The Faculty Evaluation trainees answer in the portal — the one thing that
 * unlocks a subject's grade. It is about the trainer, not the course.
 *
 * TESDA issues no official form, so this is the centre's own. Its structure
 * follows the evaluation forms trainees will already know from university
 * portals — lettered sections of statements rated on a five-point agreement
 * scale, a self-evaluation, then open comments — but the statements are
 * written for TVET: a trainer on a shop floor, with tools, safety and
 * competency-based assessment, rather than a lecturer with a syllabus.
 *
 * Shared by the portal (which renders it) and the server (which validates
 * every answer against it), so the two can never disagree about what was
 * asked. Rewording a statement is safe; changing an `id` orphans the answers
 * already given to it.
 */

export interface EvaluationItem {
  id: string;
  text: string;
}

export interface EvaluationArea {
  id: string;
  title: string;
  /**
   * Whether this section is about the trainer. The trainee's self-evaluation
   * is not, so it never enters the trainer's averages.
   */
  aboutTrainer: boolean;
  items: EvaluationItem[];
}

/** A number the trainee types — kept to a range so a typo cannot skew a mean. */
export interface EvaluationNumberQuestion {
  id: string;
  text: string;
  min: number;
  max: number;
}

export interface EvaluationCommentQuestion {
  id: string;
  text: string;
  required: boolean;
}

export const RATING_SCALE: Array<{ value: number; label: string }> = [
  { value: 5, label: 'Strongly Agree' },
  { value: 4, label: 'Agree' },
  { value: 3, label: 'Neutral' },
  { value: 2, label: 'Disagree' },
  { value: 1, label: 'Strongly Disagree' },
];

export const EVALUATION_AREAS: EvaluationArea[] = [
  {
    id: 'A',
    title: 'Training Delivery',
    aboutTrainer: true,
    items: [
      { id: 'A1', text: 'The trainer made me interested in learning the competency.' },
      { id: 'A2', text: 'Training hours were used well and kept to schedule.' },
      { id: 'A3', text: 'The trainer demonstrated each task before we performed it.' },
      { id: 'A4', text: 'The trainer used different methods — demonstration, practice, discussion — to help us learn.' },
      { id: 'A5', text: 'I was encouraged to solve problems and try tasks on my own.' },
      { id: 'A6', text: 'Feedback on my practical work was given promptly and helped me improve.' },
      { id: 'A7', text: 'The trainer was available for consultation outside training hours.' },
    ],
  },
  {
    id: 'B',
    title: 'Workshop Management and Safety',
    aboutTrainer: true,
    items: [
      { id: 'B1', text: 'The trainer prepared job sheets and materials that supported each task.' },
      { id: 'B2', text: 'The trainer made sure everyone had enough time on the tools and equipment.' },
      { id: 'B3', text: 'The trainer kept the workshop, laboratory or kitchen clean, orderly and safe.' },
      { id: 'B4', text: 'The trainer enforced safety rules and the proper use of PPE.' },
      { id: 'B5', text: 'The trainer checked that tools and equipment were working before we used them.' },
    ],
  },
  {
    id: 'C',
    title: 'Assessment and Feedback',
    aboutTrainer: true,
    items: [
      { id: 'C1', text: 'The trainer explained the competencies we had to learn at the start.' },
      { id: 'C2', text: 'The trainer made clear how we would be assessed and graded.' },
      { id: 'C3', text: 'The trainer assessed us fairly, according to the stated criteria.' },
      { id: 'C4', text: "The trainer's tasks and assessments matched real work in the industry." },
    ],
  },
  {
    id: 'D',
    title: 'Overall Rating of the Trainer',
    aboutTrainer: true,
    items: [
      { id: 'D1', text: 'The trainer treated every trainee with fairness and respect.' },
      { id: 'D2', text: 'Because of this trainer, I feel confident performing the tasks of this competency.' },
      { id: 'D3', text: 'The trainer showed mastery of the trade, not just of the lessons.' },
      { id: 'D4', text: 'I would recommend this trainer to other trainees.' },
    ],
  },
  {
    id: 'E',
    title: 'Trainee Self-Evaluation',
    aboutTrainer: false,
    items: [
      { id: 'E1', text: 'I took an active part in demonstrations and practice.' },
      { id: 'E2', text: 'I gave enough time and effort to meet the requirements.' },
      { id: 'E3', text: 'I can now perform the tasks of this competency on my own.' },
      { id: 'E4', text: 'I followed safety rules in every practical session.' },
    ],
  },
];

export const EVALUATION_NUMBERS: EvaluationNumberQuestion[] = [
  { id: 'N1', text: 'On average, how many hours a week did you practise outside class? (0 – 40)', min: 0, max: 40 },
  { id: 'N2', text: 'How many training sessions of this subject did you miss? (0 – 30)', min: 0, max: 30 },
];

export const EVALUATION_COMMENTS: EvaluationCommentQuestion[] = [
  { id: 'F1', text: 'What does this trainer do best?', required: true },
  { id: 'F2', text: 'What could this trainer improve?', required: true },
  { id: 'F3', text: 'Any other message for the trainer?', required: false },
];

export const ALL_EVALUATION_ITEMS: EvaluationItem[] = EVALUATION_AREAS.flatMap((a) => a.items);

/** The items that are about the trainer — what their averages are made of. */
export const TRAINER_ITEMS: EvaluationItem[] = EVALUATION_AREAS.filter((a) => a.aboutTrainer).flatMap(
  (a) => a.items,
);

/** The scale's own words for an average, e.g. 4.32 → Agree. */
export function ratingLabel(average: number): string {
  if (average >= 4.5) return 'Strongly Agree';
  if (average >= 3.5) return 'Agree';
  if (average >= 2.5) return 'Neutral';
  if (average >= 1.5) return 'Disagree';
  return 'Strongly Disagree';
}

/**
 * The fewest answers a trainer's own results need before they are shown.
 * Below it, a trainee in a small class could be identified from their
 * ratings — the anonymity the form promises would be broken.
 */
export const MIN_RESPONSES_FOR_TRAINER = 3;
