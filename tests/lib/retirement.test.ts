import { estimateRetirementIncome, projectRetirementBalance } from '@src/lib/retirement';

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

describe('estimateRetirementIncome', () => {
  it('applies the withdrawal rate to the balance and converts to a monthly figure', () => {
    // $1,000,000 * 4% = $40,000/yr = $3,333.33/mo, in the target year's (nominal) dollars.
    const result = estimateRetirementIncome(1000000, 4, 0, 30);
    expect(result.monthlyIncomeNominal).toBeCloseTo(3333.33, 2);
  });

  it("deflates the nominal income back to today's dollars using inflation over the target year", () => {
    const result = estimateRetirementIncome(1000000, 4, 3, 30);
    expect(result.monthlyIncomeReal).toBeCloseTo(result.monthlyIncomeNominal / Math.pow(1.03, 30), 6);
    expect(result.monthlyIncomeReal).toBeLessThan(result.monthlyIncomeNominal);
  });

  it('real and nominal income are equal at year 0 (no time for inflation to erode it)', () => {
    const result = estimateRetirementIncome(1000000, 4, 3, 0);
    expect(result.monthlyIncomeReal).toBeCloseTo(result.monthlyIncomeNominal, 6);
  });

  it('a higher withdrawal rate produces more income from the same balance', () => {
    const lower = estimateRetirementIncome(1000000, 3, 0, 20);
    const higher = estimateRetirementIncome(1000000, 5, 0, 20);
    expect(higher.monthlyIncomeNominal).toBeGreaterThan(lower.monthlyIncomeNominal);
  });

  it('is $0 for a $0 balance', () => {
    const result = estimateRetirementIncome(0, 4, 3, 30);
    expect(result.monthlyIncomeNominal).toBe(0);
    expect(result.monthlyIncomeReal).toBe(0);
  });
});
