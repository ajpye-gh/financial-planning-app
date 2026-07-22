import { GOAL_CATALOG, generateGoalId, isValidGoal } from '@src/lib/goals';

describe('generateGoalId', () => {
  it('produces unique ids across repeated calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateGoalId()));
    expect(ids.size).toBe(20);
  });
});

describe('GOAL_CATALOG', () => {
  it('every entry creates a valid goal', () => {
    for (const entry of GOAL_CATALOG) {
      const goal = entry.create(generateGoalId());
      expect(isValidGoal(goal)).toBe(true);
    }
  });

  it('includes a Retirement savings entry, in accumulate mode', () => {
    const entry = GOAL_CATALOG.find((candidate) => candidate.label === 'Retirement savings');
    expect(entry).toBeDefined();
    expect(entry?.create(generateGoalId()).mode).toBe('accumulate');
  });
});

describe('isValidGoal', () => {
  const valid = GOAL_CATALOG[0].create('goal-1');

  it('accepts a well-formed goal', () => {
    expect(isValidGoal(valid)).toBe(true);
  });

  it.each([
    ['non-object', 'nope'],
    ['null', null],
    ['wrong kind', { ...valid, kind: 'bigPurchase' }],
    ['missing id', { ...valid, id: '' }],
    ['missing name', { ...valid, name: '' }],
    ['invalid mode', { ...valid, mode: 'save' }],
    ['non-finite amount', { ...valid, monthlyAmount: Number.NaN }],
    ['inverted range', { ...valid, monthlyAmountRange: { min: 100, max: 0, step: 10 } }],
    ['zero step', { ...valid, monthlyAmountRange: { min: 0, max: 100, step: 0 } }],
    ['non-finite target', { ...valid, targetAmount: 'lots' }],
    ['startYear after endYear', { ...valid, startYear: 10, endYear: 5 }],
    ['non-finite startYear', { ...valid, startYear: 'five' }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidGoal(candidate)).toBe(false);
  });
});
