import {
  DEFAULT_SALARY_RAISES,
  applyRaiseUpdate,
  generateBreakpointId,
  isValidBreakpoint,
  nextBreakpoint,
} from '@src/lib/salaryRaises';
import type { SalaryRaiseBreakpoint } from '@src/lib/salaryRaises';

describe('generateBreakpointId', () => {
  it('produces unique ids across repeated calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateBreakpointId()));
    expect(ids.size).toBe(20);
  });
});

describe('nextBreakpoint', () => {
  it('defaults to year 1 at the current starting salary when the list is empty', () => {
    expect(nextBreakpoint([], 70)).toEqual({ year: 1, incomeK: 70 });
  });

  it('picks one year past the latest existing breakpoint, carrying its income forward', () => {
    const existing: SalaryRaiseBreakpoint[] = [
      { id: 'a', year: 1, incomeK: 75 },
      { id: 'b', year: 6, incomeK: 100 },
    ];
    expect(nextBreakpoint(existing, 70)).toEqual({ year: 7, incomeK: 100 });
  });

  it('clamps to the 18-year horizon', () => {
    const existing: SalaryRaiseBreakpoint[] = [{ id: 'a', year: 18, incomeK: 120 }];
    expect(nextBreakpoint(existing, 70)).toEqual({ year: 18, incomeK: 120 });
  });
});

describe('isValidBreakpoint', () => {
  const valid: SalaryRaiseBreakpoint = { id: 'r1', year: 4, incomeK: 90 };

  it('accepts a well-formed breakpoint', () => {
    expect(isValidBreakpoint(valid)).toBe(true);
  });

  it.each([
    ['non-object', 'nope'],
    ['null', null],
    ['missing id', { ...valid, id: '' }],
    ['year below 1', { ...valid, year: 0 }],
    ['year above the 18-year horizon', { ...valid, year: 19 }],
    ['non-finite year', { ...valid, year: 'four' }],
    ['non-finite incomeK', { ...valid, incomeK: Number.NaN }],
    ['old delta-semantics shape (raiseK, no incomeK)', { id: 'r1', year: 4, raiseK: 20 }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidBreakpoint(candidate)).toBe(false);
  });
});

describe('applyRaiseUpdate', () => {
  const CHAIN: SalaryRaiseBreakpoint[] = [
    { id: 'y1', year: 1, incomeK: 75 },
    { id: 'y4', year: 4, incomeK: 90 },
    { id: 'y6', year: 6, incomeK: 100 },
    { id: 'y10', year: 10, incomeK: 120 },
  ];

  it('leaves an already non-decreasing sequence untouched aside from the patched field', () => {
    const result = applyRaiseUpdate(CHAIN, 'y4', { incomeK: 95 });
    expect(result).toEqual([
      { id: 'y1', year: 1, incomeK: 75 },
      { id: 'y4', year: 4, incomeK: 95 },
      { id: 'y6', year: 6, incomeK: 100 },
      { id: 'y10', year: 10, incomeK: 120 },
    ]);
  });

  it("clamps a breakpoint up to the previous one's income instead of letting it dip below", () => {
    const result = applyRaiseUpdate(CHAIN, 'y6', { incomeK: 80 });
    const y6 = result.find((b) => b.id === 'y6');
    // 80 < y4's 90, so it's floored at 90 rather than accepted as-is.
    expect(y6?.incomeK).toBe(90);
  });

  it('drags every later breakpoint up in unison when an earlier one is raised above them', () => {
    const result = applyRaiseUpdate(CHAIN, 'y1', { incomeK: 200 });
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'y1', incomeK: 200 }),
        expect.objectContaining({ id: 'y4', incomeK: 200 }),
        expect.objectContaining({ id: 'y6', incomeK: 200 }),
        expect.objectContaining({ id: 'y10', incomeK: 200 }),
      ]),
    );
  });

  it('re-derives the floor from year order after a year change reorders the sequence', () => {
    // Move y10 (income 120) to year 2 - new order is y1(75), y10(120), y4(90), y6(100). y1 is still
    // earliest so it's untouched; y4 and y6 now sit behind y10's 120 and get dragged up to it.
    const result = applyRaiseUpdate(CHAIN, 'y10', { year: 2 });
    const byId = Object.fromEntries(result.map((b) => [b.id, b]));
    expect(byId.y1).toEqual({ id: 'y1', year: 1, incomeK: 75 });
    expect(byId.y10).toEqual({ id: 'y10', year: 2, incomeK: 120 });
    expect(byId.y4.incomeK).toBe(120);
    expect(byId.y6.incomeK).toBe(120);
  });

  it('never lets the first breakpoint drop below zero', () => {
    const result = applyRaiseUpdate(CHAIN, 'y1', { incomeK: -10 });
    expect(result.find((b) => b.id === 'y1')?.incomeK).toBe(0);
  });
});

describe('DEFAULT_SALARY_RAISES', () => {
  it('is sorted ascending by year and every entry is otherwise valid', () => {
    const years = DEFAULT_SALARY_RAISES.map((breakpoint) => breakpoint.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const breakpoint of DEFAULT_SALARY_RAISES) {
      expect(isValidBreakpoint({ id: 'x', ...breakpoint })).toBe(true);
    }
  });

  it('is expressed as absolute income, at or above a $70k starting salary (Defaults.json salaryY0K.default)', () => {
    for (const breakpoint of DEFAULT_SALARY_RAISES) {
      expect(breakpoint.incomeK).toBeGreaterThanOrEqual(70);
    }
  });
});
