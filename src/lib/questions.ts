import type { FilingStatus } from './tax';

export type Answers = Record<string, boolean | string>;

export function ownsHome(answers: Answers): boolean {
  return answers.housing === 'own';
}

/** Defaults to 'single' when unset - consistent with partner fields already defaulting to "no
 *  partner" (partnerSalaryY0K: 0) rather than assuming a partner exists. */
export function filingStatus(answers: Answers): FilingStatus {
  return answers.filingStatus === 'marriedJoint' ? 'marriedJoint' : 'single';
}
