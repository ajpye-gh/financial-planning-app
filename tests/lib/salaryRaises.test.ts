import {
  DEFAULT_SALARY_RAISES,
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

describe('DEFAULT_SALARY_RAISES', () => {
  it('is sorted ascending by year and every entry is otherwise valid', () => {
    const years = DEFAULT_SALARY_RAISES.map((breakpoint) => breakpoint.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    for (const breakpoint of DEFAULT_SALARY_RAISES) {
      expect(isValidBreakpoint({ id: 'x', ...breakpoint })).toBe(true);
    }
  });
});
