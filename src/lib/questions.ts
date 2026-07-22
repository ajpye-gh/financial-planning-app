export type Answers = Record<string, boolean | string>;

export function ownsHome(answers: Answers): boolean {
  return answers.housing === 'own';
}
