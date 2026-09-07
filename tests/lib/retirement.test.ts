import {
  buildEarlyWithdrawalWarning,
  buildRetirementVerdict,
  MAX_PROJECTION_AGE,
  projectedBalanceAtRetirement,
  projectHouseholdRetirementIncome,
  projectRetirementBalance,
  requiredMinimumDistribution,
  RMD_START_AGE,
  SS_MIN_CLAIMING_AGE,
  TRADITIONAL_EARLY_WITHDRAWAL_AGE,
} from '@src/lib/retirement';
import { estimateRetirementTax } from '@src/lib/tax';

describe('projectedBalanceAtRetirement', () => {
  it('matches the balance projectRetirementBalance itself carries into the retirement year (Y{targetYear - 1}\'s ending balance)', () => {
    const balance = projectedBalanceAtRetirement(100000, 500, 6, 10);
    const projection = projectRetirementBalance(100000, 500, 6, 10, 10, 0, 3);
    // 0% withdrawal rate isolates pure accumulation math: balances[9] (Y9, targetYear - 1) should be
    // what accumulated into the retirement year, before any withdrawal is taken out of it - within
    // rounding, since the array stores Math.round'd balances while this returns the raw figure.
    expect(balance).toBeCloseTo(projection.balances[9], 0);
  });

  it('equals the starting balance untouched when targetYear is 0 (already retired, no accumulation years)', () => {
    expect(projectedBalanceAtRetirement(250000, 1000, 6, 0)).toBe(250000);
  });

  it('is unaffected by monthlyContribution or investmentReturnPct once there are no accumulation years to apply them in', () => {
    expect(projectedBalanceAtRetirement(250000, 999999, 12, 0)).toBe(250000);
  });

  it('compounds with contributions the same way for any number of accumulation years', () => {
    const oneYear = projectedBalanceAtRetirement(100000, 500, 6, 1);
    const tenYears = projectedBalanceAtRetirement(100000, 500, 6, 10);
    expect(oneYear).toBe(100000);
    expect(tenYears).toBeGreaterThan(oneYear);
  });

  describe('dollar <-> rate equivalence (deriving an initial withdrawal rate from a monthly dollar target)', () => {
    // Mirrors RetirementPage.tsx's own conversion: rate% = (monthlyDollar * 12) / balanceAtRetirement * 100.
    function impliedRatePct(monthlyDollar: number, balanceAtRetirement: number): number {
      return balanceAtRetirement > 0 ? ((monthlyDollar * 12) / balanceAtRetirement) * 100 : 0;
    }

    it('a dollar target converted to a rate and passed through projectRetirementBalance reproduces exactly that dollar amount as the first withdrawal', () => {
      const startingBalance = 1000000;
      const monthlyContribution = 0;
      const investmentReturnPct = 6;
      const targetYear = 10;
      const monthlyDollarTarget = 3000;

      const balanceAtRetirement = projectedBalanceAtRetirement(startingBalance, monthlyContribution, investmentReturnPct, targetYear);
      const ratePct = impliedRatePct(monthlyDollarTarget, balanceAtRetirement);
      const projection = projectRetirementBalance(startingBalance, monthlyContribution, investmentReturnPct, targetYear, 30, ratePct, 3);

      expect(projection.withdrawals[targetYear]).toBeCloseTo(monthlyDollarTarget * 12, 0);
    });

    it('produces the exact same projection as the equivalent flat rate, since a dollar target is just another way of setting the same rate', () => {
      // 4% of the balance at retirement, expressed as a dollar target instead of a rate directly.
      const balanceAtRetirement = projectedBalanceAtRetirement(500000, 500, 6, 15);
      const monthlyDollarTarget = (balanceAtRetirement * 0.04) / 12;
      const ratePct = impliedRatePct(monthlyDollarTarget, balanceAtRetirement);

      const viaRate = projectRetirementBalance(500000, 500, 6, 15, 40, 4, 3);
      const viaDollar = projectRetirementBalance(500000, 500, 6, 15, 40, ratePct, 3);

      expect(viaDollar.balances).toEqual(viaRate.balances);
      expect(viaDollar.withdrawals).toEqual(viaRate.withdrawals);
    });

    it('is $0 (not NaN/Infinity) when there is no balance at retirement to speak of, regardless of the dollar target requested', () => {
      const ratePct = impliedRatePct(5000, 0);
      expect(ratePct).toBe(0);
      expect(Number.isFinite(ratePct)).toBe(true);

      const projection = projectRetirementBalance(0, 0, 6, 10, 30, ratePct, 3);
      expect(projection.withdrawals.every((withdrawal) => withdrawal === 0)).toBe(true);
    });
  });
});

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

  describe('effectiveWithdrawalRatePct', () => {
    it('is 0 for every accumulation year (no withdrawal yet)', () => {
      const result = projectRetirementBalance(100000, 500, 6, 10, 20, 4, 3);
      expect(result.effectiveWithdrawalRatePct.slice(0, 10).every((rate) => rate === 0)).toBe(true);
    });

    it('matches the withdrawalRatePct input exactly in the first withdrawal year', () => {
      // First withdrawal is always exactly withdrawalRatePct% of the balance carried into
      // retirement, whichever model computed it later.
      const result = projectRetirementBalance(1000000, 0, 0, 0, 25, 4, 3);
      expect(result.effectiveWithdrawalRatePct[0]).toBeCloseTo(4, 6);
    });

    it('drifts away from the input rate in later years, since the withdrawal grows with inflation while the balance follows investment return instead', () => {
      // 3% inflation vs 0% return: the withdrawal keeps growing 3%/yr off a balance that's instead
      // shrinking (grown 0%, minus the withdrawal itself) - so the effective rate should climb well
      // past the original 4%.
      const result = projectRetirementBalance(1000000, 0, 0, 0, 10, 4, 3);
      expect(result.effectiveWithdrawalRatePct[5]).toBeGreaterThan(result.effectiveWithdrawalRatePct[0]);
    });

    it('is ~100% in the depletion year itself (takes what remains), then 0 forever after, once the balance is $0', () => {
      const result = projectRetirementBalance(10000, 0, 0, 0, 25, 50, 0);
      const depletionIndex = result.depletionYear as number;
      expect(result.effectiveWithdrawalRatePct[depletionIndex]).toBeCloseTo(100, 0);
      expect(result.effectiveWithdrawalRatePct.at(-1)).toBe(0);
    });

    it('reflects the RMD-forced rate, not the lower voluntary rate, once an RMD applies', () => {
      const result = projectRetirementBalance(1000000, 0, 6, 0, 25, 2, 3, { currentAge: RMD_START_AGE });
      // RMD divisor 26.5 at this age -> ~3.77%, well above the chosen 2% rate.
      expect(result.effectiveWithdrawalRatePct[0]).toBeGreaterThan(2);
      expect(result.effectiveWithdrawalRatePct[0]).toBeCloseTo(100 / 26.5, 1);
    });
  });

  describe('Required Minimum Distributions (the optional rmd argument)', () => {
    it('forces a withdrawal up to the RMD once age reaches RMD_START_AGE, even above a lower scheduled rate', () => {
      // Already retired, currentAge=RMD_START_AGE itself - a 2% rate would normally take
      // $20,000 from $1,000,000, but the RMD (divisor 26.5 at this age) forces ~$37,736 instead.
      const result = projectRetirementBalance(1000000, 0, 6, 0, 25, 2, 3, { currentAge: RMD_START_AGE });
      expect(result.withdrawals[0]).toBeCloseTo(1000000 / 26.5, 0);
    });

    it('does not force anything before RMD_START_AGE, even when the rmd option is passed', () => {
      const result = projectRetirementBalance(1000000, 0, 6, 0, 25, 2, 3, { currentAge: RMD_START_AGE - 1 });
      expect(result.withdrawals[0]).toBeCloseTo(20000, 0);
    });

    it('leaves a voluntary withdrawal rate that already exceeds the RMD unaffected', () => {
      const withRmd = projectRetirementBalance(1000000, 0, 6, 0, 25, 10, 3, { currentAge: RMD_START_AGE });
      const withoutRmd = projectRetirementBalance(1000000, 0, 6, 0, 25, 10, 3);
      // 10% of 1,000,000 = 100,000, comfortably above the RMD floor - so the option changes nothing.
      expect(withRmd.withdrawals[0]).toBe(withoutRmd.withdrawals[0]);
    });

    it('applies no RMD floor at all when the rmd option is omitted, regardless of how low the rate is', () => {
      const result = projectRetirementBalance(1000000, 0, 6, 0, 25, 0.1, 3);
      expect(result.withdrawals[0]).toBeCloseTo(1000, 0);
    });
  });
});

describe('requiredMinimumDistribution', () => {
  it('is $0 for any age before RMD_START_AGE', () => {
    expect(requiredMinimumDistribution(1000000, RMD_START_AGE - 1)).toBe(0);
  });

  it('is balance / the Uniform Lifetime Table divisor at RMD_START_AGE', () => {
    expect(requiredMinimumDistribution(1000000, RMD_START_AGE)).toBeCloseTo(1000000 / 26.5, 6);
  });

  it('requires a larger fraction of the balance as age increases (the divisor shrinks)', () => {
    const at73 = requiredMinimumDistribution(1000000, 73);
    const at90 = requiredMinimumDistribution(1000000, 90);
    expect(at90).toBeGreaterThan(at73);
  });

  it('is $0 for a $0 or negative balance regardless of age', () => {
    expect(requiredMinimumDistribution(0, 90)).toBe(0);
    expect(requiredMinimumDistribution(-100, 90)).toBe(0);
  });

  it("reuses the table's last divisor for any age past its top row", () => {
    expect(requiredMinimumDistribution(1000000, 150)).toBeCloseTo(1000000 / 2.0, 6);
  });
});

describe('projectHouseholdRetirementIncome', () => {
  // targetYear=0 so decumulation starts immediately: index 0 is already the first year of retirement.
  const roth = () => projectRetirementBalance(500000, 0, 6, 0, 25, 4, 3);
  const traditional = () => projectRetirementBalance(300000, 0, 6, 0, 25, 4, 3);

  const baseIncomeInputs = {
    afterTaxProjection: projectRetirementBalance(0, 0, 6, 0, 25, 4, 3),
    afterTaxGainPct: 0,
    pensionMonthlyToday: 0,
    pensionStartAge: 65,
    ssMonthlyBenefitToday: 2000,
    currentAge: 65,
    filingStatus: 'single' as const,
    inflationPct: 3,
  };

  it('combines tax-free Roth withdrawal, gross Traditional withdrawal, and gross Social Security, minus tax', () => {
    const series = projectHouseholdRetirementIncome({ rothProjection: roth(), traditionalProjection: traditional(), ...baseIncomeInputs });
    // Year 0 (already retired, so this is the retirement year itself): Roth withdrawal
    // 500,000*4%=20,000 (tax-free); Traditional 300,000*4%=12,000 (taxable); SS $2,000/mo*12=24,000,
    // no inflation applied yet (year 0's inflationFactor is 1).
    const year0 = series[0];
    expect(year0.rothWithdrawal).toBeCloseTo(20000, 0);
    expect(year0.traditionalWithdrawal).toBeCloseTo(12000, 0);
    expect(year0.ssGross).toBeCloseTo(24000, 0);

    const expectedTax = estimateRetirementTax({
      traditionalWithdrawalAnnual: year0.traditionalWithdrawal,
      pensionAnnual: 0,
      ssBenefitAnnual: year0.ssGross,
      afterTaxWithdrawalAnnual: 0,
      afterTaxGainPct: 0,
      isEarlyTraditionalWithdrawal: false,
      filingStatus: 'single',
      inflationFactor: 1,
    });
    expect(year0.tax.tax).toBeCloseTo(expectedTax.tax, 6);
    expect(year0.netAnnual).toBeCloseTo(year0.rothWithdrawal + year0.traditionalWithdrawal + year0.ssGross - expectedTax.tax, 6);
  });

  it('has no Social Security before the retirement year, and it inflates forward starting then', () => {
    // targetYear=10 this time, so there's a real accumulation phase to check SS is $0 through.
    const rothLater = projectRetirementBalance(500000, 0, 6, 10, 35, 4, 3);
    const traditionalLater = projectRetirementBalance(300000, 0, 6, 10, 35, 4, 3);
    const series = projectHouseholdRetirementIncome({
      rothProjection: rothLater,
      traditionalProjection: traditionalLater,
      ...baseIncomeInputs,
    });

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
    const series = projectHouseholdRetirementIncome({
      rothProjection: bigRoth,
      traditionalProjection: smallTraditional,
      ...baseIncomeInputs,
      ssMonthlyBenefitToday: 0,
    });

    expect(smallTraditional.depletionYear).not.toBeNull();
    const depletionIndex = smallTraditional.depletionYear as number;
    // Once depleted, this pot contributes nothing further - matches its own frozen $0 balance.
    for (let year = depletionIndex + 1; year < series.length; year++) {
      expect(series[year].traditionalWithdrawal).toBe(0);
    }
  });

  it('a Roth-only household (no Traditional, no Social Security) owes no tax in any year', () => {
    const noTraditional = projectRetirementBalance(0, 0, 6, 0, 25, 4, 3);
    const series = projectHouseholdRetirementIncome({
      rothProjection: roth(),
      traditionalProjection: noTraditional,
      ...baseIncomeInputs,
      ssMonthlyBenefitToday: 0,
    });

    for (const entry of series) {
      expect(entry.tax.tax).toBe(0);
      expect(entry.netAnnual).toBeCloseTo(entry.rothWithdrawal, 6);
    }
  });

  it("deflates net income back to today's dollars using that year's inflation factor", () => {
    const series = projectHouseholdRetirementIncome({ rothProjection: roth(), traditionalProjection: traditional(), ...baseIncomeInputs });
    const year5 = series[5];
    const inflationFactor = Math.pow(1.03, 5);
    expect(year5.netMonthlyReal).toBeCloseTo(year5.netMonthlyNominal / inflationFactor, 6);
  });

  it('pension income starts at pensionStartAge independent of retirementYearIndex, and is fully taxed as ordinary income', () => {
    // currentAge=60, pension starts at 65 -> pensionStartYearOffset=5. Already retired (targetYear=0
    // for both pots), so this isolates the pension-specific gating from the retirement gating.
    const series = projectHouseholdRetirementIncome({
      rothProjection: roth(),
      traditionalProjection: traditional(),
      afterTaxProjection: projectRetirementBalance(0, 0, 6, 0, 25, 4, 3),
      afterTaxGainPct: 0,
      pensionMonthlyToday: 1000,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 0,
      currentAge: 60,
      filingStatus: 'single',
      inflationPct: 3,
    });

    for (let year = 0; year < 5; year++) {
      expect(series[year].pensionGross).toBe(0);
    }
    expect(series[5].pensionGross).toBeCloseTo(12000 * Math.pow(1.03, 5), 0);

    const withPension = series[5];
    const expectedTax = estimateRetirementTax({
      traditionalWithdrawalAnnual: withPension.traditionalWithdrawal,
      pensionAnnual: withPension.pensionGross,
      ssBenefitAnnual: 0,
      afterTaxWithdrawalAnnual: 0,
      afterTaxGainPct: 0,
      isEarlyTraditionalWithdrawal: false,
      filingStatus: 'single',
      inflationFactor: Math.pow(1.03, 5),
    });
    expect(withPension.tax.tax).toBeCloseTo(expectedTax.tax, 6);
  });

  it('surfaces the after-tax withdrawal and taxes only its taxable-gain slice at the flat LTCG rate', () => {
    // targetYear=0 so the after-tax pot's first withdrawal happens immediately, same as roth()/traditional().
    const afterTax = projectRetirementBalance(200000, 0, 6, 0, 25, 4, 3);
    const series = projectHouseholdRetirementIncome({
      rothProjection: roth(),
      traditionalProjection: traditional(),
      afterTaxProjection: afterTax,
      afterTaxGainPct: 40,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 0,
      currentAge: 65,
      filingStatus: 'single',
      inflationPct: 3,
    });

    // 200,000 * 4% = 8,000 withdrawal; 40% of that ($3,200) is taxable gain.
    const year0 = series[0];
    expect(year0.afterTaxWithdrawal).toBeCloseTo(8000, 0);
    expect(year0.tax.taxableGain).toBeCloseTo(3200, 0);
    expect(year0.tax.capitalGainsTax).toBeCloseTo(3200 * 0.15, 6);
    expect(year0.netAnnual).toBeCloseTo(
      year0.rothWithdrawal + year0.traditionalWithdrawal + year0.afterTaxWithdrawal - year0.tax.tax,
      6,
    );
  });

  it('never starts Social Security before SS_MIN_CLAIMING_AGE, even if retired earlier', () => {
    // currentAge=55, already retired (targetYear=0) - SS_MIN_CLAIMING_AGE=62 means index 0-6 (ages
    // 55-61) get no Social Security at all, despite already being retired.
    const series = projectHouseholdRetirementIncome({
      ...baseIncomeInputs,
      rothProjection: roth(),
      traditionalProjection: traditional(),
      currentAge: 55,
    });

    for (let year = 0; year < SS_MIN_CLAIMING_AGE - 55; year++) {
      expect(series[year].ssGross).toBe(0);
    }
    expect(series[SS_MIN_CLAIMING_AGE - 55].ssGross).toBeGreaterThan(0);
  });

  it('starts Social Security immediately (no gap) when already older than SS_MIN_CLAIMING_AGE at retirement', () => {
    const series = projectHouseholdRetirementIncome({ ...baseIncomeInputs, rothProjection: roth(), traditionalProjection: traditional() });
    expect(series[0].ssGross).toBeGreaterThan(0);
  });

  it('flags every Traditional withdrawal before TRADITIONAL_EARLY_WITHDRAWAL_AGE for the 10% penalty, and none at or after it', () => {
    // currentAge=55, retired now (targetYear=0): ages 55-59 (years 0-4) are early, age 60+ (year 5
    // on) is not.
    const earlyTraditional = projectRetirementBalance(300000, 0, 6, 0, 25, 4, 3);
    const series = projectHouseholdRetirementIncome({
      ...baseIncomeInputs,
      rothProjection: projectRetirementBalance(0, 0, 6, 0, 25, 4, 3),
      traditionalProjection: earlyTraditional,
      currentAge: 55,
    });

    for (let year = 0; year < TRADITIONAL_EARLY_WITHDRAWAL_AGE - 55; year++) {
      expect(series[year].tax.earlyWithdrawalPenalty).toBeGreaterThan(0);
    }
    expect(series[TRADITIONAL_EARLY_WITHDRAWAL_AGE - 55].tax.earlyWithdrawalPenalty).toBe(0);
  });
});

describe('buildEarlyWithdrawalWarning', () => {
  const CURRENT_AGE = 55;
  const earlyTraditional = () => projectRetirementBalance(300000, 0, 6, 0, 25, 4, 3);
  const onTimeTraditional = () => projectRetirementBalance(300000, 0, 6, 0, 25, 4, 3);
  const noWithdrawal = () => projectRetirementBalance(0, 0, 6, 0, 25, 4, 3);

  it('returns null when no year in the projection incurs the penalty', () => {
    const series = projectHouseholdRetirementIncome({
      rothProjection: noWithdrawal(),
      traditionalProjection: onTimeTraditional(),
      afterTaxProjection: noWithdrawal(),
      afterTaxGainPct: 0,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 0,
      currentAge: TRADITIONAL_EARLY_WITHDRAWAL_AGE,
      filingStatus: 'single',
      inflationPct: 3,
    });
    expect(buildEarlyWithdrawalWarning(series, TRADITIONAL_EARLY_WITHDRAWAL_AGE)).toBeNull();
  });

  it('returns a warning verdict naming the affected age range when the penalty applies', () => {
    const series = projectHouseholdRetirementIncome({
      rothProjection: noWithdrawal(),
      traditionalProjection: earlyTraditional(),
      afterTaxProjection: noWithdrawal(),
      afterTaxGainPct: 0,
      pensionMonthlyToday: 0,
      pensionStartAge: 65,
      ssMonthlyBenefitToday: 0,
      currentAge: CURRENT_AGE,
      filingStatus: 'single',
      inflationPct: 3,
    });
    const warning = buildEarlyWithdrawalWarning(series, CURRENT_AGE);
    expect(warning).not.toBeNull();
    expect(warning?.tone).toBe('warning');
    expect(warning?.headline).toContain(String(CURRENT_AGE));
    expect(warning?.headline).toContain(String(TRADITIONAL_EARLY_WITHDRAWAL_AGE - 1));
    expect(warning?.detail).toContain('10%');
  });
});

describe('buildRetirementVerdict', () => {
  const CURRENT_AGE = 40;
  const lastingProjection = () => projectRetirementBalance(2000000, 0, 6, 20, 45, 3, 3);
  const depletingProjection = () => projectRetirementBalance(10000, 0, 0, 5, 30, 50, 0);

  it('reports success when every pot lasts the full projection window', () => {
    const pots = [
      { name: 'Roth', projection: lastingProjection() },
      { name: 'Traditional', projection: lastingProjection() },
      { name: 'After-tax', projection: lastingProjection() },
    ];
    const verdict = buildRetirementVerdict(pots, CURRENT_AGE);
    expect(verdict.tone).toBe('success');
    expect(verdict.detail).toContain(`${MAX_PROJECTION_AGE}`);
  });

  it('reports danger with every depletion age when every pot runs out', () => {
    const roth = depletingProjection();
    const traditional = depletingProjection();
    const afterTax = depletingProjection();
    const pots = [
      { name: 'Roth', projection: roth },
      { name: 'Traditional', projection: traditional },
      { name: 'After-tax', projection: afterTax },
    ];
    const verdict = buildRetirementVerdict(pots, CURRENT_AGE);
    expect(verdict.tone).toBe('danger');
    expect(roth.depletionYear).not.toBeNull();
    const lastAge =
      CURRENT_AGE + Math.max(roth.depletionYear as number, traditional.depletionYear as number, afterTax.depletionYear as number);
    expect(verdict.headline).toContain(String(lastAge));
  });

  it('reports a warning naming just Roth when only Roth depletes, noting the other two continue', () => {
    const roth = depletingProjection();
    const pots = [
      { name: 'Roth', projection: roth },
      { name: 'Traditional', projection: lastingProjection() },
      { name: 'After-tax', projection: lastingProjection() },
    ];
    const verdict = buildRetirementVerdict(pots, CURRENT_AGE);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Roth');
    expect(verdict.headline).not.toContain('Traditional');
    expect(verdict.headline).toContain(String(CURRENT_AGE + (roth.depletionYear as number)));
    expect(verdict.detail).toContain('Traditional and After-tax');
  });

  it('reports a warning naming both depleted pots when two of three run out, noting the survivor continues', () => {
    const roth = depletingProjection();
    const traditional = depletingProjection();
    const pots = [
      { name: 'Roth', projection: roth },
      { name: 'Traditional', projection: traditional },
      { name: 'After-tax', projection: lastingProjection() },
    ];
    const verdict = buildRetirementVerdict(pots, CURRENT_AGE);
    expect(verdict.tone).toBe('warning');
    expect(verdict.headline).toContain('Roth and Traditional');
    expect(verdict.headline).not.toContain('After-tax');
    expect(verdict.detail).toContain('After-tax');
  });
});
