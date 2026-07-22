export interface QuestionOption {
  label: string;
  value: string;
}

export interface Question {
  id: string;
  prompt: string;
  type: 'boolean' | 'choice';
  options?: QuestionOption[];
  showIf?: (answers: Answers) => boolean;
}

export type Answers = Record<string, boolean | string>;

export const QUESTIONS: Question[] = [
  {
    id: 'housing',
    prompt: 'Do you own or rent your home?',
    type: 'choice',
    options: [
      { label: 'Own', value: 'own' },
      { label: 'Rent', value: 'rent' },
    ],
  },
  {
    id: 'hasPartnerIncome',
    prompt: 'Do you have a spouse or partner who earns income?',
    type: 'boolean',
  },
  {
    id: 'hasKids',
    prompt: 'Do you have kids, or plan to?',
    type: 'boolean',
  },
];

/** Questions actually applicable given the answers so far (honors `showIf`). */
export function visibleQuestions(answers: Answers): Question[] {
  return QUESTIONS.filter((question) => !question.showIf || question.showIf(answers));
}

export function ownsHome(answers: Answers): boolean {
  return answers.housing === 'own';
}

export function isQuestionnaireComplete(answers: Answers): boolean {
  return visibleQuestions(answers).every((question) => answers[question.id] !== undefined);
}
