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

/** Defaults to true (Social Security participates in the plan) when unset - matching the benefit
 *  slider's own nonzero default. The toggle exists so someone who genuinely expects none (already
 *  ineligible, a foreign retiree, a deliberately conservative plan, etc.) can remove it from the
 *  model entirely, rather than only being able to drag the benefit slider to $0 while it's still
 *  nominally "on" (see SocialSecurityToggle.tsx and RetirementPage.tsx). */
export function socialSecurityEnabled(answers: Answers): boolean {
  return answers.socialSecurityEnabled !== false;
}
