import { buildRetirementVerdict, estimateHouseholdRetirementIncome, POST_RETIREMENT_YEARS, projectRetirementBalance } from '@src/lib/retirement';
import { estimateRetirementTax } from '@src/lib/tax';

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

describe('estimateHouseholdRetirementIncome', () => {
  it('combines tax-free Roth withdrawal, gross Traditional withdrawal, and gross Social Security, minus tax', () => {
    // Roth: 500,000*4%=20,000/yr tax-free. Traditional: 300,000*4%=12,000/yr taxable.
    // SS: $2,000/mo * 12 = 24,000/yr, no inflation (year 0).
    const result = estimateHouseholdRetirementIncome(500000, 4, 300000, 4, 2000, 'single', 3, 0);
    expect(result.rothAnnual).toBeCloseTo(20000, 6);
    expect(result.traditionalAnnualGross).toBeCloseTo(12000, 6);
    expect(result.ssAnnualGross).toBeCloseTo(24000, 6);

    const expectedTax = estimateRetirementTax(12000, 24000, 'single', 1);
    expect(result.tax.tax).toBeCloseTo(expectedTax.tax, 6);

    const expectedNetAnnual = 20000 + 12000 + 24000 - expectedTax.tax;
    expect(result.netMonthlyNominal).toBeCloseTo(expectedNetAnnual / 12, 6);
  });

  it("inflates the Social Security input forward to the target year, same as other today's-dollar inputs", () => {
    const atYear0 = estimateHouseholdRetirementIncome(0, 4, 0, 4, 2000, 'single', 3, 0);
    const atYear10 = estimateHouseholdRetirementIncome(0, 4, 0, 4, 2000, 'single', 3, 10);
    expect(atYear10.ssAnnualGross).toBeCloseTo(atYear0.ssAnnualGross * Math.pow(1.03, 10), 6);
  });

  it('a Roth-only household (no Traditional, no Social Security) owes no tax', () => {
    const result = estimateHouseholdRetirementIncome(1000000, 4, 0, 4, 0, 'single', 3, 20);
    expect(result.tax.tax).toBe(0);
    expect(result.netMonthlyNominal).toBeCloseTo(result.rothAnnual / 12, 6);
  });

  it("deflates net income back to today's dollars using the target year's inflation factor", () => {
    const result = estimateHouseholdRetirementIncome(500000, 4, 300000, 4, 2000, 'single', 3, 20);
    const inflationFactor = Math.pow(1.03, 20);
    expect(result.netMonthlyReal).toBeCloseTo(result.netMonthlyNominal / inflationFactor, 6);
  });
});

describe('buildRetirementVerdict', () => {
  const lastingProjection = () => projectRetirementBalance(2000000, 0, 6, 20, 3, 3);
  const depletingProjection = () => projectRetirementBalance(10000, 0, 0, 5, 50, 0);

  it('reports success when both pots last the full projection window', () => {
    const verdict = buildRetirementVerdict(lastingProjection(), lastingProjection());
    expect(verdict.tone).toBe('success');
    expect(verdict.detail).toContain(`${POST_RETIREMENT_YEARS}`);
  });

  it('reports danger with both depletion years when both pots run out', () => {
    const roth = depletingProjection();
    const traditional = depletingProjection();
    const verdict = buildRetirementVerdict(roth, traditional);
    expect(verdict.tone).toBe('danger');
    expect(roth.depletionYear).not.toBeNull();
    expect(verdict.headline).toContain(String(Math.max(roth.depletionYear as number, traditional.depletionYear as number)));
  });

  it('reports a warning naming Roth when only Roth depletes, noting Traditional continues', () => {
    const roth = depletingProjection();
    const traditional = lastingProjection();
    const verdict = buildRetirementVerdict(roth, traditional);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Roth');
    expect(verdict.headline).toContain(String(roth.depletionYear));
    expect(verdict.detail).toContain('Traditional savings continue');
  });

  it('reports a warning naming Traditional when only Traditional depletes, noting Roth continues', () => {
    const roth = lastingProjection();
    const traditional = depletingProjection();
    const verdict = buildRetirementVerdict(roth, traditional);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Traditional');
    expect(verdict.headline).toContain(String(traditional.depletionYear));
    expect(verdict.detail).toContain('Roth savings continue');
  });
});
