import { projectRetirementBalance } from '@src/lib/retirement';

describe('projectRetirementBalance', () => {
  it('starts at the starting balance in Y0', () => {
    const result = projectRetirementBalance(100000, 500, 6, 10);
    expect(result.yearLabels[0]).toBe('Y0');
    expect(result.balances[0]).toBe(100000);
  });

  it('produces one entry per year from Y0 through the target year', () => {
    const result = projectRetirementBalance(100000, 500, 6, 10);
    expect(result.yearLabels).toEqual(['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10']);
    expect(result.balances).toHaveLength(11);
  });

  it('with zero contribution, compounds purely at the investment return', () => {
    const result = projectRetirementBalance(100000, 0, 10, 2);
    expect(result.balances[1]).toBe(Math.round(100000 * 1.1));
    expect(result.balances[2]).toBe(Math.round(100000 * 1.1 * 1.1));
  });

  it('with zero investment return, grows by exactly the annual contribution each year', () => {
    const result = projectRetirementBalance(100000, 1000, 0, 3);
    expect(result.balances).toEqual([100000, 112000, 124000, 136000]);
  });

  it('with zero starting balance and zero contribution, stays at zero', () => {
    const result = projectRetirementBalance(0, 0, 6, 5);
    expect(result.balances.every((balance) => balance === 0)).toBe(true);
  });
});
