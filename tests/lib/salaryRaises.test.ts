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
  it('defaults to year 1 with no raise when the list is empty', () => {
    expect(nextBreakpoint([])).toEqual({ year: 1, raiseK: 0 });
  });

  it('picks one year past the latest existing breakpoint, carrying its raise forward', () => {
    const existing: SalaryRaiseBreakpoint[] = [
      { id: 'a', year: 1, raiseK: 5 },
      { id: 'b', year: 6, raiseK: 30 },
    ];
    expect(nextBreakpoint(existing)).toEqual({ year: 7, raiseK: 30 });
  });

  it('clamps to the 18-year horizon', () => {
    const existing: SalaryRaiseBreakpoint[] = [{ id: 'a', year: 18, raiseK: 50 }];
    expect(nextBreakpoint(existing)).toEqual({ year: 18, raiseK: 50 });
  });
});

describe('isValidBreakpoint', () => {
  const valid: SalaryRaiseBreakpoint = { id: 'r1', year: 4, raiseK: 20 };

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
    ['non-finite raiseK', { ...valid, raiseK: Number.NaN }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidBreakpoint(candidate)).toBe(false);
  });
});

describe('applyRaiseUpdate', () => {
  const CHAIN: SalaryRaiseBreakpoint[] = [
    { id: 'y1', year: 1, raiseK: 5 },
    { id: 'y4', year: 4, raiseK: 20 },
    { id: 'y6', year: 6, raiseK: 30 },
    { id: 'y10', year: 10, raiseK: 50 },
  ];

  it('leaves an already non-decreasing sequence untouched aside from the patched field', () => {
    const result = applyRaiseUpdate(CHAIN, 'y4', { raiseK: 25 });
    expect(result).toEqual([
      { id: 'y1', year: 1, raiseK: 5 },
      { id: 'y4', year: 4, raiseK: 25 },
      { id: 'y6', year: 6, raiseK: 30 },
      { id: 'y10', year: 10, raiseK: 50 },
    ]);
  });

  it('clamps a breakpoint up to the previous one\'s raise instead of letting it dip below', () => {
    const result = applyRaiseUpdate(CHAIN, 'y6', { raiseK: 10 });
    const y6 = result.find((b) => b.id === 'y6');
    // 10 < y4's 20, so it's floored at 20 rather than accepted as-is.
    expect(y6?.raiseK).toBe(20);
  });

  it('drags every later breakpoint up in unison when an earlier one is raised above them', () => {
    const result = applyRaiseUpdate(CHAIN, 'y1', { raiseK: 60 });
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'y1', raiseK: 60 }),
        expect.objectContaining({ id: 'y4', raiseK: 60 }),
        expect.objectContaining({ id: 'y6', raiseK: 60 }),
        expect.objectContaining({ id: 'y10', raiseK: 60 }),
      ]),
    );
  });

  it('re-derives the floor from year order after a year change reorders the sequence', () => {
    // Move y10 (raise 50) to year 2 - new order is y1(5), y10(50), y4(20), y6(30). y1 is still
    // earliest so it's untouched; y4 and y6 now sit behind y10's 50 and get dragged up to it.
    const result = applyRaiseUpdate(CHAIN, 'y10', { year: 2 });
    const byId = Object.fromEntries(result.map((b) => [b.id, b]));
    expect(byId.y1).toEqual({ id: 'y1', year: 1, raiseK: 5 });
    expect(byId.y10).toEqual({ id: 'y10', year: 2, raiseK: 50 });
    expect(byId.y4.raiseK).toBe(50);
    expect(byId.y6.raiseK).toBe(50);
  });

  it('never lets the first breakpoint drop below zero', () => {
    const result = applyRaiseUpdate(CHAIN, 'y1', { raiseK: -10 });
    expect(result.find((b) => b.id === 'y1')?.raiseK).toBe(0);
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
});
