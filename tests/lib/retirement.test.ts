import { buildRetirementVerdict, MAX_PROJECTION_AGE, projectHouseholdRetirementIncome, projectRetirementBalance } from '@src/lib/retirement';
import { estimateRetirementTax } from '@src/lib/tax';

describe('projectRetirementBalance', () => {
  describe('accumulation phase (Y0 through the target year)', () => {
    it('starts at the starting balance in Y0', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 35, 4, 3);
      expect(result.yearLabels[0]).toBe('Y0');
      expect(result.balances[0]).toBe(100000);
    });

    it('produces one entry per year from Y0 through finalYear', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 35, 4, 3);
      const expectedLength = 36;
      expect(result.yearLabels).toHaveLength(expectedLength);
      expect(result.balances).toHaveLength(expectedLength);
      expect(result.yearLabels.slice(0, 11)).toEqual(['Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10']);
      expect(result.yearLabels.at(-1)).toBe('Y35');
    });

    it('marks retirementYearIndex as the target year', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 35, 4, 3);
      expect(result.retirementYearIndex).toBe(10);
    });

    it('with zero contribution, compounds purely at the investment return through the last pre-retirement year', () => {
      // targetYear=3 here so both checked indices (1, 2) fall strictly before retirement (index 3)
      // and stay pure accumulation - no withdrawal mixed in.
      const result = projectRetirementBalance(100000, 0, 10, 3, 30, 4, 3);
      expect(result.balances[1]).toBe(Math.round(100000 * 1.1));
      expect(result.balances[2]).toBe(Math.round(100000 * 1.1 * 1.1));
    });

    it('with zero investment return, grows by exactly the annual contribution through targetYear - 1, then the retirement year itself takes the first withdrawal instead of a contribution', () => {
      const result = projectRetirementBalance(100000, 1000, 0, 3, 28, 4, 3);
      // Y1 and Y2 each add a $12,000/yr contribution (Y2 = targetYear - 1, the last contribution
      // year). Y3 (targetYear, retirement itself) gets no new contribution and instead takes the
      // first withdrawal: 4% of 124,000 = 4,960, so 124,000 - 4,960 = 119,040.
      expect(result.balances.slice(0, 4)).toEqual([100000, 112000, 124000, 119040]);
      expect(result.withdrawals.slice(0, 4)).toEqual([0, 0, 0, 4960]);
    });

    it('the retirement year itself gets no new contribution but does take the first withdrawal - contributions stop the year before', () => {
      // 0% return isolates the arithmetic: contributions run through Y4 (targetYear - 1); Y5
      // (targetYear) gets no contribution but takes the first withdrawal instead - 4% of 148,000 =
      // 5,920.
      const result = projectRetirementBalance(100000, 1000, 0, 5, 30, 4, 3);
      expect(result.balances.slice(0, 6)).toEqual([100000, 112000, 124000, 136000, 148000, 142080]);
      expect(result.withdrawals.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 5920]);
    });

    it('with a target year of 0 (already retired), skips accumulation and starts the drawdown immediately in Y0 itself', () => {
      const result = projectRetirementBalance(1000000, 5000, 6, 0, 25, 4, 3);
      expect(result.retirementYearIndex).toBe(0);
      // Y0 is the first withdrawal year now, not just the raw input: 1,000,000*1.06 - 40,000 = 1,020,000.
      expect(result.balances[0]).toBe(1020000);
      expect(result.withdrawals[0]).toBe(40000);
      // Y1: withdrawal grows 3% to 41,200; balance = 1,020,000*1.06 - 41,200 = 1,040,000.
      expect(result.balances[1]).toBe(1040000);
      expect(result.yearLabels).toHaveLength(26);
    });

    it('with zero starting balance and zero contribution, stays at zero throughout (including decumulation)', () => {
      const result = projectRetirementBalance(0, 0, 6, 5, 30, 4, 3);
      expect(result.balances.every((balance) => balance === 0)).toBe(true);
    });
  });

  describe('decumulation phase (drawdown after the target year)', () => {
    it("draws down the balance immediately in the retirement year (Y0, already retired), then grows the withdrawal with inflation each year after (the '4% rule')", () => {
      // $1,000,000 at retirement, 4% initial withdrawal ($40,000), 0% investment return (isolates
      // the withdrawal math from growth) and 10% inflation for an easy-to-verify multiplier.
      const result = projectRetirementBalance(1000000, 0, 0, 0, 25, 4, 10);
      // Y0, the retirement year itself: 1,000,000 - 40,000 = 960,000.
      expect(result.balances[0]).toBe(960000);
      // Y1: withdrawal grows 10% to 44,000; balance = 960,000 - 44,000 = 916,000.
      expect(result.balances[1]).toBe(916000);
    });

    it('grows the remaining balance at the investment return, net of the (inflation-adjusted) withdrawal', () => {
      const withGrowth = projectRetirementBalance(1000000, 0, 6, 0, 25, 4, 3);
      const noGrowth = projectRetirementBalance(1000000, 0, 0, 0, 25, 4, 3);
      expect(withGrowth.balances[5]).toBeGreaterThan(noGrowth.balances[5]);
    });

    it('floors the balance at $0 and records the first depletion year, once withdrawals outpace growth', () => {
      // A small balance with a large withdrawal rate and no growth depletes almost immediately.
      const result = projectRetirementBalance(10000, 0, 0, 0, 25, 50, 0);
      expect(result.depletionYear).not.toBeNull();
      expect(result.balances[result.depletionYear as number]).toBe(0);
      // Stays at 0 for every year after depletion too.
      expect(result.balances.at(-1)).toBe(0);
    });

    it('depletionYear is null when the balance lasts the full projection window', () => {
      // A large balance, modest withdrawal rate, and healthy growth - shouldn't run out.
      const result = projectRetirementBalance(2000000, 0, 6, 0, 25, 3, 3);
      expect(result.depletionYear).toBeNull();
    });

    it('finalYear before the target year means no decumulation phase at all - just the accumulation years', () => {
      const result = projectRetirementBalance(100000, 0, 6, 10, 9, 4, 3);
      expect(result.yearLabels).toHaveLength(10);
      expect(result.withdrawals.every((withdrawal) => withdrawal === 0)).toBe(true);
      expect(result.depletionYear).toBeNull();
    });

    it('finalYear equal to the target year still includes exactly one decumulation year - the retirement year itself', () => {
      const result = projectRetirementBalance(100000, 0, 6, 10, 10, 4, 3);
      expect(result.yearLabels).toHaveLength(11);
      expect(result.withdrawals[10]).toBeGreaterThan(0);
    });
  });
});

describe('projectHouseholdRetirementIncome', () => {
  // targetYear=0 so decumulation starts immediately: index 0 is already the first year of retirement.
  const roth = () => projectRetirementBalance(500000, 0, 6, 0, 25, 4, 3);
  const traditional = () => projectRetirementBalance(300000, 0, 6, 0, 25, 4, 3);

  it('combines tax-free Roth withdrawal, gross Traditional withdrawal, and gross Social Security, minus tax', () => {
    const series = projectHouseholdRetirementIncome(roth(), traditional(), 2000, 'single', 3);
    // Year 0 (already retired, so this is the retirement year itself): Roth withdrawal
    // 500,000*4%=20,000 (tax-free); Traditional 300,000*4%=12,000 (taxable); SS $2,000/mo*12=24,000,
    // no inflation applied yet (year 0's inflationFactor is 1).
    const year0 = series[0];
    expect(year0.rothWithdrawal).toBeCloseTo(20000, 0);
    expect(year0.traditionalWithdrawal).toBeCloseTo(12000, 0);
    expect(year0.ssGross).toBeCloseTo(24000, 0);

    const expectedTax = estimateRetirementTax(year0.traditionalWithdrawal, year0.ssGross, 'single', 1);
    expect(year0.tax.tax).toBeCloseTo(expectedTax.tax, 6);
    expect(year0.netAnnual).toBeCloseTo(year0.rothWithdrawal + year0.traditionalWithdrawal + year0.ssGross - expectedTax.tax, 6);
  });

  it('has no Social Security before the retirement year, and it inflates forward starting then', () => {
    // targetYear=10 this time, so there's a real accumulation phase to check SS is $0 through.
    const rothLater = projectRetirementBalance(500000, 0, 6, 10, 35, 4, 3);
    const traditionalLater = projectRetirementBalance(300000, 0, 6, 10, 35, 4, 3);
    const series = projectHouseholdRetirementIncome(rothLater, traditionalLater, 2000, 'single', 3);

    for (let year = 0; year < 10; year++) {
      expect(series[year].ssGross).toBe(0);
    }
    expect(series[10].ssGross).toBeCloseTo(24000 * Math.pow(1.03, 10), 0);
    expect(series[11].ssGross).toBeCloseTo(24000 * Math.pow(1.03, 11), 0);
  });

  it('reflects the actual (depletion-capped) withdrawal, not the scheduled amount, once a pot runs dry', () => {
    // Small Traditional balance, large withdrawal rate, no growth - depletes almost immediately.
    const smallTraditional = projectRetirementBalance(10000, 0, 0, 0, 25, 50, 0);
    const bigRoth = projectRetirementBalance(1000000, 0, 6, 0, 25, 4, 3);
    const series = projectHouseholdRetirementIncome(bigRoth, smallTraditional, 0, 'single', 3);

    expect(smallTraditional.depletionYear).not.toBeNull();
    const depletionIndex = smallTraditional.depletionYear as number;
    // Once depleted, this pot contributes nothing further - matches its own frozen $0 balance.
    for (let year = depletionIndex + 1; year < series.length; year++) {
      expect(series[year].traditionalWithdrawal).toBe(0);
    }
  });

  it('a Roth-only household (no Traditional, no Social Security) owes no tax in any year', () => {
    const noTraditional = projectRetirementBalance(0, 0, 6, 0, 25, 4, 3);
    const series = projectHouseholdRetirementIncome(roth(), noTraditional, 0, 'single', 3);

    for (const entry of series) {
      expect(entry.tax.tax).toBe(0);
      expect(entry.netAnnual).toBeCloseTo(entry.rothWithdrawal, 6);
    }
  });

  it("deflates net income back to today's dollars using that year's inflation factor", () => {
    const series = projectHouseholdRetirementIncome(roth(), traditional(), 2000, 'single', 3);
    const year5 = series[5];
    const inflationFactor = Math.pow(1.03, 5);
    expect(year5.netMonthlyReal).toBeCloseTo(year5.netMonthlyNominal / inflationFactor, 6);
  });
});

describe('buildRetirementVerdict', () => {
  const CURRENT_AGE = 40;
  const lastingProjection = () => projectRetirementBalance(2000000, 0, 6, 20, 45, 3, 3);
  const depletingProjection = () => projectRetirementBalance(10000, 0, 0, 5, 30, 50, 0);

  it('reports success when both pots last the full projection window', () => {
    const verdict = buildRetirementVerdict(lastingProjection(), lastingProjection(), CURRENT_AGE);
    expect(verdict.tone).toBe('success');
    expect(verdict.detail).toContain(`${MAX_PROJECTION_AGE}`);
  });

  it('reports danger with both depletion ages when both pots run out', () => {
    const roth = depletingProjection();
    const traditional = depletingProjection();
    const verdict = buildRetirementVerdict(roth, traditional, CURRENT_AGE);
    expect(verdict.tone).toBe('danger');
    expect(roth.depletionYear).not.toBeNull();
    const lastAge = CURRENT_AGE + Math.max(roth.depletionYear as number, traditional.depletionYear as number);
    expect(verdict.headline).toContain(String(lastAge));
  });

  it('reports a warning naming Roth when only Roth depletes, noting Traditional continues', () => {
    const roth = depletingProjection();
    const traditional = lastingProjection();
    const verdict = buildRetirementVerdict(roth, traditional, CURRENT_AGE);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Roth');
    expect(verdict.headline).toContain(String(CURRENT_AGE + (roth.depletionYear as number)));
    expect(verdict.detail).toContain('Traditional savings continue');
  });

  it('reports a warning naming Traditional when only Traditional depletes, noting Roth continues', () => {
    const roth = lastingProjection();
    const traditional = depletingProjection();
    const verdict = buildRetirementVerdict(roth, traditional, CURRENT_AGE);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Traditional');
    expect(verdict.headline).toContain(String(CURRENT_AGE + (traditional.depletionYear as number)));
    expect(verdict.detail).toContain('Roth savings continue');
  });
});
