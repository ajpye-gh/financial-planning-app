import { buildRetirementVerdict, estimateRetirementIncome, POST_RETIREMENT_YEARS, projectRetirementBalance } from '@src/lib/retirement';

describe('projectRetirementBalance', () => {
  describe('accumulation phase (Y0 through the target year)', () => {
    it('starts at the starting balance in Y0', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 4, 3);
      expect(result.yearLabels[0]).toBe('Y0');
      expect(result.balances[0]).toBe(100000);
    });

    it('produces one entry per year from Y0 through target year + POST_RETIREMENT_YEARS', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 4, 3);
      const expectedLength = 10 + POST_RETIREMENT_YEARS + 1;
      expect(result.yearLabels).toHaveLength(expectedLength);
      expect(result.balances).toHaveLength(expectedLength);
      expect(result.yearLabels.slice(0, 11)).toEqual(['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10']);
      expect(result.yearLabels.at(-1)).toBe(`Y${10 + POST_RETIREMENT_YEARS}`);
    });

    it('marks retirementYearIndex as the target year', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 4, 3);
      expect(result.retirementYearIndex).toBe(10);
    });

    it('with zero contribution, compounds purely at the investment return', () => {
      const result = projectRetirementBalance(100000, 0, 10, 2, 4, 3);
      expect(result.balances[1]).toBe(Math.round(100000 * 1.1));
      expect(result.balances[2]).toBe(Math.round(100000 * 1.1 * 1.1));
    });

    it('with zero investment return, grows by exactly the annual contribution each year', () => {
      const result = projectRetirementBalance(100000, 1000, 0, 3, 4, 3);
      expect(result.balances.slice(0, 4)).toEqual([100000, 112000, 124000, 136000]);
    });

    it('with a target year of 0 (already retired), skips accumulation and starts the drawdown immediately from Y0', () => {
      const result = projectRetirementBalance(1000000, 5000, 6, 0, 4, 3);
      expect(result.retirementYearIndex).toBe(0);
      expect(result.balances[0]).toBe(1000000);
      // Year 1 is already the first year of decumulation: 1,000,000*1.06 - 40,000 = 1,020,000.
      expect(result.balances[1]).toBe(1020000);
      expect(result.yearLabels).toHaveLength(POST_RETIREMENT_YEARS + 1);
    });

    it('with zero starting balance and zero contribution, stays at zero throughout (including decumulation)', () => {
      const result = projectRetirementBalance(0, 0, 6, 5, 4, 3);
      expect(result.balances.every((balance) => balance === 0)).toBe(true);
    });
  });

  describe('decumulation phase (drawdown after the target year)', () => {
    it("draws down the balance at retirement by the withdrawal rate in the first year, then grows the withdrawal with inflation each year after (the '4% rule')", () => {
      // $1,000,000 at retirement, 4% initial withdrawal ($40,000), 0% investment return (isolates
      // the withdrawal math from growth) and 10% inflation for an easy-to-verify multiplier.
      const result = projectRetirementBalance(1000000, 0, 0, 0, 4, 10);
      // Year 1 of retirement: 1,000,000 - 40,000 = 960,000.
      expect(result.balances[1]).toBe(960000);
      // Year 2: withdrawal grows 10% to 44,000; balance = 960,000 - 44,000 = 916,000.
      expect(result.balances[2]).toBe(916000);
    });

    it('grows the remaining balance at the investment return, net of the (inflation-adjusted) withdrawal', () => {
      const withGrowth = projectRetirementBalance(1000000, 0, 6, 0, 4, 3);
      const noGrowth = projectRetirementBalance(1000000, 0, 0, 0, 4, 3);
      expect(withGrowth.balances[5]).toBeGreaterThan(noGrowth.balances[5]);
    });

    it('floors the balance at $0 and records the first depletion year, once withdrawals outpace growth', () => {
      // A small balance with a large withdrawal rate and no growth depletes almost immediately.
      const result = projectRetirementBalance(10000, 0, 0, 0, 50, 0);
      expect(result.depletionYear).not.toBeNull();
      expect(result.balances[result.depletionYear as number]).toBe(0);
      // Stays at 0 for every year after depletion too.
      expect(result.balances.at(-1)).toBe(0);
    });

    it('depletionYear is null when the balance lasts the full projection window', () => {
      // A large balance, modest withdrawal rate, and healthy growth - shouldn't run out.
      const result = projectRetirementBalance(2000000, 0, 6, 0, 3, 3);
      expect(result.depletionYear).toBeNull();
    });
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

describe('buildRetirementVerdict', () => {
  it('reports success when the balance lasts the full projection window', () => {
    const projection = projectRetirementBalance(2000000, 0, 6, 20, 3, 3);
    const verdict = buildRetirementVerdict(projection);
    expect(verdict.tone).toBe('success');
    expect(verdict.detail).toContain(`${POST_RETIREMENT_YEARS}`);
  });

  it('reports danger with the depletion year and years-into-retirement when it runs out', () => {
    const projection = projectRetirementBalance(10000, 0, 0, 5, 50, 0);
    const verdict = buildRetirementVerdict(projection);
    expect(verdict.tone).toBe('danger');
    expect(projection.depletionYear).not.toBeNull();
    expect(verdict.headline).toContain(String(projection.depletionYear));
    expect(verdict.detail).toContain(String((projection.depletionYear as number) - 5));
  });
});
