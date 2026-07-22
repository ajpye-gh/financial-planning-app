import { QUESTIONS, isQuestionnaireComplete, ownsHome, visibleQuestions } from '@src/lib/questions';

describe('visibleQuestions', () => {
  it('returns every question when none have a showIf gate', () => {
    // Today's QUESTIONS has no conditional follow-ups (see SPEC.md §4.2 - goals absorbed what would
    // have been the "planning to move" follow-up), so visibility should be answer-independent.
    expect(visibleQuestions({})).toHaveLength(QUESTIONS.length);
    expect(visibleQuestions({ housing: 'own', hasPartnerIncome: true, hasKids: false })).toHaveLength(
      QUESTIONS.length,
    );
  });
});

describe('ownsHome', () => {
  it('is true only when housing is answered "own"', () => {
    expect(ownsHome({ housing: 'own' })).toBe(true);
    expect(ownsHome({ housing: 'rent' })).toBe(false);
    expect(ownsHome({})).toBe(false);
  });
});

describe('isQuestionnaireComplete', () => {
  it('is false until every visible question has an answer', () => {
    expect(isQuestionnaireComplete({})).toBe(false);
    expect(isQuestionnaireComplete({ housing: 'own' })).toBe(false);
    expect(isQuestionnaireComplete({ housing: 'own', hasPartnerIncome: false })).toBe(false);
  });

  it('is true once every visible question is answered', () => {
    expect(isQuestionnaireComplete({ housing: 'rent', hasPartnerIncome: false, hasKids: true })).toBe(true);
  });
});
