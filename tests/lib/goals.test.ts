import {
  GOAL_CATALOG,
  canAllocateBrokerage,
  canAllocateCash,
  canAllocateEquity,
  enforceExclusiveEquity,
  generateGoalId,
  isValidGoal,
  rebalanceAllocations,
  sanitizeAllocations,
  type RecurringGoal,
} from '@src/lib/goals';

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

  it('tags Retirement savings as category "retirement", Emergency fund top-up as "emergency", everything else "other"', () => {
    const categoryFor = (label: string) => GOAL_CATALOG.find((candidate) => candidate.label === label)?.create(generateGoalId()).category;

    expect(categoryFor('Retirement savings')).toBe('retirement');
    expect(categoryFor('Emergency fund top-up')).toBe('emergency');
    expect(categoryFor('Travel')).toBe('other');
    expect(categoryFor('College savings')).toBe('other');
    expect(categoryFor('Custom savings goal')).toBe('other');
    expect(categoryFor('Custom spending goal')).toBe('other');
  });

  it('starts every catalog entry with no asset allocation', () => {
    for (const entry of GOAL_CATALOG) {
      const goal = entry.create(generateGoalId());
      expect(goal.cashAllocated).toBe(0);
      expect(goal.brokerageAllocated).toBe(0);
      expect(goal.equityAllocated).toBe(false);
    }
  });

  it('includes a Property purchase entry, in accumulate mode with category "property"', () => {
    const entry = GOAL_CATALOG.find((candidate) => candidate.label === 'Property purchase');
    const goal = entry?.create(generateGoalId());
    expect(goal?.mode).toBe('accumulate');
    expect(goal?.category).toBe('property');
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
    ['invalid category', { ...valid, category: 'college' }],
    ['negative cashAllocated', { ...valid, cashAllocated: -1 }],
    ['non-finite cashAllocated', { ...valid, cashAllocated: 'lots' }],
    ['negative brokerageAllocated', { ...valid, brokerageAllocated: -1 }],
    ['non-boolean equityAllocated', { ...valid, equityAllocated: 'yes' }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidGoal(candidate)).toBe(false);
  });
});

describe('canAllocateCash', () => {
  it('only allows accumulate-mode goals in the emergency category', () => {
    expect(canAllocateCash({ mode: 'accumulate', category: 'emergency' })).toBe(true);
    expect(canAllocateCash({ mode: 'accumulate', category: 'retirement' })).toBe(false);
    expect(canAllocateCash({ mode: 'accumulate', category: 'other' })).toBe(false);
    expect(canAllocateCash({ mode: 'consume', category: 'emergency' })).toBe(false);
  });
});

describe('canAllocateBrokerage', () => {
  it('allows any accumulate-mode goal except retirement', () => {
    expect(canAllocateBrokerage({ mode: 'accumulate', category: 'emergency' })).toBe(true);
    expect(canAllocateBrokerage({ mode: 'accumulate', category: 'other' })).toBe(true);
    expect(canAllocateBrokerage({ mode: 'accumulate', category: 'retirement' })).toBe(false);
    expect(canAllocateBrokerage({ mode: 'consume', category: 'other' })).toBe(false);
  });
});

describe('canAllocateEquity', () => {
  it('only allows accumulate-mode goals in the property category', () => {
    expect(canAllocateEquity({ mode: 'accumulate', category: 'property' })).toBe(true);
    expect(canAllocateEquity({ mode: 'accumulate', category: 'other' })).toBe(false);
    expect(canAllocateEquity({ mode: 'consume', category: 'property' })).toBe(false);
  });
});

describe('sanitizeAllocations', () => {
  const base: RecurringGoal = {
    kind: 'recurring',
    id: 'g1',
    name: 'Test goal',
    mode: 'accumulate',
    category: 'other',
    monthlyAmount: 100,
    monthlyAmountRange: { min: 0, max: 1000, step: 10 },
    startYear: 1,
    endYear: 18,
    cashAllocated: 0,
    brokerageAllocated: 0,
    equityAllocated: false,
  };

  it('zeroes brokerageAllocated on a retirement goal', () => {
    const goal = sanitizeAllocations({ ...base, category: 'retirement', brokerageAllocated: 5000 });
    expect(goal.brokerageAllocated).toBe(0);
  });

  it('zeroes cashAllocated on any non-emergency goal', () => {
    const goal = sanitizeAllocations({ ...base, category: 'other', cashAllocated: 5000 });
    expect(goal.cashAllocated).toBe(0);
  });

  it('zeroes equityAllocated on any non-property goal', () => {
    const goal = sanitizeAllocations({ ...base, category: 'other', equityAllocated: true });
    expect(goal.equityAllocated).toBe(false);
  });

  it('zeroes both cash/brokerage allocations on a consume-mode goal', () => {
    const goal = sanitizeAllocations({ ...base, mode: 'consume', category: 'emergency', cashAllocated: 500, brokerageAllocated: 500 });
    expect(goal.cashAllocated).toBe(0);
    expect(goal.brokerageAllocated).toBe(0);
  });

  it('leaves a permitted allocation untouched', () => {
    const goal = sanitizeAllocations({ ...base, category: 'emergency', cashAllocated: 5000, brokerageAllocated: 3000 });
    expect(goal.cashAllocated).toBe(5000);
    expect(goal.brokerageAllocated).toBe(3000);
  });

  it('leaves equityAllocated untouched on a property goal', () => {
    const goal = sanitizeAllocations({ ...base, category: 'property', equityAllocated: true });
    expect(goal.equityAllocated).toBe(true);
  });
});

describe('enforceExclusiveEquity', () => {
  const base: RecurringGoal = {
    kind: 'recurring',
    id: 'g1',
    name: 'Test goal',
    mode: 'accumulate',
    category: 'property',
    monthlyAmount: 100,
    monthlyAmountRange: { min: 0, max: 1000, step: 10 },
    startYear: 1,
    endYear: 18,
    cashAllocated: 0,
    brokerageAllocated: 0,
    equityAllocated: true,
  };

  it('clears equityAllocated on every other goal, leaving the target goal untouched', () => {
    const goals: RecurringGoal[] = [
      { ...base, id: 'g1', equityAllocated: true },
      { ...base, id: 'g2', equityAllocated: true },
      { ...base, id: 'g3', equityAllocated: false },
    ];
    const result = enforceExclusiveEquity(goals, 'g2');
    expect(result.map((g) => [g.id, g.equityAllocated])).toEqual([
      ['g1', false],
      ['g2', true],
      ['g3', false],
    ]);
  });
});

describe('rebalanceAllocations', () => {
  const base: RecurringGoal = {
    kind: 'recurring',
    id: 'g1',
    name: 'Test goal',
    mode: 'accumulate',
    category: 'emergency',
    monthlyAmount: 100,
    monthlyAmountRange: { min: 0, max: 1000, step: 10 },
    startYear: 1,
    endYear: 18,
    cashAllocated: 0,
    brokerageAllocated: 0,
    equityAllocated: false,
  };

  it('leaves allocations untouched when the total still covers them', () => {
    const goals: RecurringGoal[] = [
      { ...base, id: 'g1', cashAllocated: 4000 },
      { ...base, id: 'g2', cashAllocated: 3000 },
    ];
    const result = rebalanceAllocations(goals, 10000, 0);
    expect(result.map((g) => g.cashAllocated)).toEqual([4000, 3000]);
  });

  it('scales every allocation down proportionally when the total shrinks below what was promised', () => {
    const goals: RecurringGoal[] = [
      { ...base, id: 'g1', cashAllocated: 4000 },
      { ...base, id: 'g2', cashAllocated: 6000 },
    ];
    // Total dropped to 5000, was 10000 - factor 0.5.
    const result = rebalanceAllocations(goals, 5000, 0);
    expect(result.map((g) => g.cashAllocated)).toEqual([2000, 3000]);
  });

  it('scales cash and brokerage independently', () => {
    const goals: RecurringGoal[] = [{ ...base, id: 'g1', category: 'other', cashAllocated: 0, brokerageAllocated: 8000 }];
    const result = rebalanceAllocations(goals, 0, 4000);
    expect(result[0].brokerageAllocated).toBe(4000);
  });

  it('is a no-op when nothing is allocated', () => {
    const goals: RecurringGoal[] = [{ ...base, id: 'g1' }];
    expect(rebalanceAllocations(goals, 0, 0)).toEqual(goals);
  });
});
