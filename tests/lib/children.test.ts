import { generateChildId, isValidChild, nextChildYear } from '@src/lib/children';
import type { Child } from '@src/lib/children';

describe('generateChildId', () => {
  it('produces unique ids across repeated calls', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateChildId()));
    expect(ids.size).toBe(20);
  });
});

describe('nextChildYear', () => {
  it('defaults to year 0 (already here today) when the list is empty', () => {
    expect(nextChildYear([])).toBe(0);
  });

  it('picks one year past the latest existing arrival', () => {
    const existing: Child[] = [
      { id: 'a', year: 0 },
      { id: 'b', year: 4 },
    ];
    expect(nextChildYear(existing)).toBe(5);
  });

  it('clamps to the 18-year horizon', () => {
    const existing: Child[] = [{ id: 'a', year: 18 }];
    expect(nextChildYear(existing)).toBe(18);
  });
});

describe('isValidChild', () => {
  const valid: Child = { id: 'c1', year: 4 };

  it('accepts a well-formed child', () => {
    expect(isValidChild(valid)).toBe(true);
  });

  it('accepts year 0 (already part of the household today)', () => {
    expect(isValidChild({ ...valid, year: 0 })).toBe(true);
  });

  it.each([
    ['non-object', 'nope'],
    ['null', null],
    ['missing id', { ...valid, id: '' }],
    ['year below 0', { ...valid, year: -1 }],
    ['year above the 18-year horizon', { ...valid, year: 19 }],
    ['non-finite year', { ...valid, year: 'four' }],
  ])('rejects %s', (_label, candidate) => {
    expect(isValidChild(candidate)).toBe(false);
  });
});
