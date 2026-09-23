import { freshPlan, isValidJobLossYear, isValidPlan, listSavedPlans, loadSavedPlan, savePlan, type Plan } from '@src/lib/plans';
import { DEFAULT_BASE_RANGES } from '@src/lib/baseData';

beforeEach(() => {
  localStorage.clear();
});

describe('freshPlan', () => {
  it('produces a valid, empty-goals starting plan', () => {
    const plan = freshPlan();
    expect(isValidPlan(plan)).toBe(true);
    expect(plan.goals).toEqual([]);
    expect(plan.children).toEqual([]);
    expect(plan.answers).toEqual({ housing: 'own' });
  });
});

describe('isValidJobLossYear', () => {
  it.each([
    [1, true],
    [18, true],
    [0, false],
    [19, false],
    [undefined, false],
    ['five', false],
  ])('%p -> %p', (value, expected) => {
    expect(isValidJobLossYear(value)).toBe(expected);
  });
});

describe('isValidPlan', () => {
  const valid = freshPlan();

  it('accepts a well-formed plan', () => {
    expect(isValidPlan(valid)).toBe(true);
  });

  it.each([
    ['non-object', 'nope'],
    ['null', null],
    ['missing answers', { ...valid, answers: undefined }],
    ['missing baseInputs', { ...valid, baseInputs: undefined }],
    ['non-array goals', { ...valid, goals: 'nope' }],
    ['an invalid goal', { ...valid, goals: [{ kind: 'recurring' }] }],
    ['non-array salaryRaises', { ...valid, salaryRaises: 'nope' }],
    ['non-array children', { ...valid, children: 'nope' }],
    ['an invalid child', { ...valid, children: [{ id: 'c1', year: -1 }] }],
    ['an out-of-range jobLossYear', { ...valid, jobLossYear: 99 }],
    ['an out-of-range partnerJobLossYear', { ...valid, partnerJobLossYear: 99 }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidPlan(candidate)).toBe(false);
  });

  it('accepts an undefined jobLossYear/partnerJobLossYear (no job loss set)', () => {
    expect(isValidPlan({ ...valid, jobLossYear: undefined, partnerJobLossYear: undefined })).toBe(true);
  });

  it('accepts a property goal predating the isFirstPurchase field - older saved plans still load', () => {
    const oldPropertyGoal = {
      kind: 'recurring',
      id: 'g1',
      name: 'First home purchase',
      mode: 'accumulate',
      category: 'property',
      monthlyAmount: 500,
      monthlyAmountRange: { min: 0, max: 5000, step: 100 },
      startYear: 1,
      endYear: 5,
      cashAllocated: 0,
      brokerageAllocated: 0,
      equityAllocated: false,
      isPurchase: true,
      purchasePriceK: 300,
      mortgageRatePct: 6.5,
      // No isFirstPurchase field - simulates a plan saved before this field existed.
    };
    expect(isValidPlan({ ...valid, goals: [oldPropertyGoal] })).toBe(true);
  });

  it('rejects a plan whose salaryRaises use the pre-migration delta shape (raiseK, no incomeK)', () => {
    const legacy = { ...valid, salaryRaises: [{ id: 'r1', year: 1, raiseK: 5 }] };
    expect(isValidPlan(legacy)).toBe(false);
  });
});

describe('saved plan registry (listSavedPlans / savePlan / loadSavedPlan)', () => {
  it('starts empty', () => {
    expect(listSavedPlans()).toEqual([]);
    expect(loadSavedPlan('Anything')).toBeNull();
  });

  it('saves a plan and lists/loads it back by name', () => {
    const plan = freshPlan();
    savePlan('Base case', plan);

    expect(listSavedPlans()).toEqual(['Base case']);
    expect(loadSavedPlan('Base case')).toEqual(plan);
  });

  it('lists multiple saved plans alphabetically', () => {
    savePlan('Zebra plan', freshPlan());
    savePlan('Apple plan', freshPlan());

    expect(listSavedPlans()).toEqual(['Apple plan', 'Zebra plan']);
  });

  it('overwrites an existing plan saved under the same name', () => {
    const original = freshPlan();
    const updated: Plan = { ...freshPlan(), answers: { housing: 'rent' } };
    savePlan('My plan', original);
    savePlan('My plan', updated);

    expect(listSavedPlans()).toEqual(['My plan']);
    expect(loadSavedPlan('My plan')).toEqual(updated);
  });

  it('drops corrupt entries from the registry instead of failing the whole list', () => {
    localStorage.setItem(
      'financial-planning-app:plans',
      JSON.stringify({ Good: freshPlan(), Bad: { not: 'a plan' } }),
    );

    expect(listSavedPlans()).toEqual(['Good']);
  });

  it('backfills baseInputs fields missing from an older saved plan (e.g. annualBonusK, added in a later release) with current defaults on load', () => {
    const plan = freshPlan();
    const { annualBonusK: _bonus, partnerAnnualBonusK: _partnerBonus, ...legacyBaseInputs } = plan.baseInputs;
    const legacyPlan = { ...plan, baseInputs: legacyBaseInputs };
    localStorage.setItem('financial-planning-app:plans', JSON.stringify({ Legacy: legacyPlan }));

    const loaded = loadSavedPlan('Legacy');
    expect(loaded?.baseInputs.annualBonusK).toBe(DEFAULT_BASE_RANGES.annualBonusK.default);
    expect(loaded?.baseInputs.partnerAnnualBonusK).toBe(DEFAULT_BASE_RANGES.partnerAnnualBonusK.default);
    // Every other field is untouched.
    expect(loaded?.baseInputs.salaryY0K).toBe(plan.baseInputs.salaryY0K);
  });
});
