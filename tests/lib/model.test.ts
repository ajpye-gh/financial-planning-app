import { runModel, type IncomeStreamInputs, type ModelInputs } from '@src/lib/model';
import type { BaseInputs } from '@src/lib/baseData';
import type { Child } from '@src/lib/children';
import type { RecurringGoal } from '@src/lib/goals';
import type { SalaryRaiseBreakpoint } from '@src/lib/salaryRaises';

// A fixed fixture, independent of Defaults.json, so this test stays stable regardless of what the
// committed defaults happen to contain.
const BASE: BaseInputs = {
  expensesMo: 4000,
  housingPaymentMo: 1800,
  housingPrincipalInterestMo: 1200,
  homeValueK: 350,
  mortgageBalanceK: 250,
  brokerageTodayK: 50,
  cashTodayK: 20,
  salaryY0K: 70,
  salaryGrowthAfterY10Pct: 2,
  netKeepRatePct: 65,
  partnerSalaryY0K: 0,
  partnerSalaryGrowthAfterY10Pct: 2,
  partnerNetKeepRatePct: 65,
  costPerKidMo: 500,
  inflationPct: 3,
  investmentReturnPct: 6,
  inspectYear: 5,
};

const NO_CHILDREN: Child[] = [];

const SALARY_RAISES: SalaryRaiseBreakpoint[] = [
  { id: 'r1', year: 1, raiseK: 5 },
  { id: 'r4', year: 4, raiseK: 20 },
  { id: 'r6', year: 6, raiseK: 30 },
  { id: 'r10', year: 10, raiseK: 50 },
];

const PRIMARY_INCOME: IncomeStreamInputs = {
  salaryY0K: 70,
  growthAfterLastRaisePct: 2,
  netKeepRatePct: 65,
  raises: SALARY_RAISES,
};

// $0 salary is a genuine no-op through the income formula (gross stays 0 regardless of raises/growth),
// matching how the app defaults an unused partner stream.
const NO_PARTNER_INCOME: IncomeStreamInputs = {
  salaryY0K: 0,
  growthAfterLastRaisePct: 0,
  netKeepRatePct: 0,
  raises: [],
};

/** Runs the model with the fixtures above, overridable per-test. */
function run(overrides: Partial<ModelInputs>) {
  return runModel({
    base: BASE,
    ownsHome: true,
    goals: [],
    children: NO_CHILDREN,
    primaryIncome: PRIMARY_INCOME,
    partnerIncome: NO_PARTNER_INCOME,
    ...overrides,
  });
}

const TRAVEL_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'travel',
  name: 'Travel',
  mode: 'consume',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  startYear: 1,
  endYear: 18,
};

const COLLEGE_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'college',
  name: 'College',
  mode: 'accumulate',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  targetAmount: 80000,
  startYear: 1,
  endYear: 18,
};

describe('runModel', () => {
  it('matches hand-verified year-1 figures for an owner with goals (hand-derived from the model formulas)', () => {
    const result = run({ goals: [TRAVEL_GOAL, COLLEGE_GOAL] });

    // income = 75000*0.65/12 = 4062.5; livingCosts = 2200*1.03 = 2266;
    // housingCost = 1200 + 600*1.03 = 1818; freeCash = 4062.5 - 2266 - 1818 - 600 = -621.5
    // Index 1 (chart index 0 is the Y0 "today" baseline, before any inflation/growth).
    expect(result.chart.freeCash[1]).toBe(-621);
    // free cash is negative, so nothing tops up the reserve: brokerage = 50000*1.06 + (-621.5*12) =
    // 45542; unallocated = 45542 + 20000 (cash untouched)
    expect(result.chart.unallocatedSavings[1]).toBe(65542);
    // college balance: 0*1.06 + 300*12 = 3600
    expect(result.chart.goalBalances.college[1]).toBe(3600);
    // travel is consume-mode - no balance series at all
    expect(result.chart.goalBalances.travel).toBeUndefined();

    expect(result.snapshot.year).toBe(5);
    expect(result.snapshot.goalContributions).toEqual({ travel: 300, college: 300 });
  });

  it('reports unallocatedAtInspect for the chosen inspect year, distinct from unallocatedAtEnd (year 18)', () => {
    const result = run({ goals: [] });

    // Series index === year number (index 0 is the Y0 baseline).
    expect(result.unallocatedAtInspect).toBe(result.chart.unallocatedSavings[BASE.inspectYear]);
    expect(result.unallocatedAtInspect).not.toBe(result.unallocatedAtEnd);
    expect(result.unallocatedAtEnd).toBe(result.chart.unallocatedSavings[18]);
  });

  it('starts the chart at a Y0 baseline reflecting today - before any inflation or growth', () => {
    const result = run({ goals: [] });

    expect(result.chart.yearLabels[0]).toBe('Y0');
    // Y0 unallocated savings === today's starting brokerage + cash, untouched by any growth.
    expect(result.chart.unallocatedSavings[0]).toBe(70000);
  });

  it('treats the full housing payment as inflating when renting, vs. a fixed P&I portion when owning', () => {
    const owner = run({ goals: [] });
    const renter = run({ ownsHome: false, goals: [] });

    // Year 1: owner housing = 1200 + 600*1.03 = 1818; renter housing = 1800*1.03 = 1854. Same income
    // and expenses otherwise, so the renter's higher housing cost shows up directly as lower free cash.
    expect(renter.chart.freeCash[1]).toBeLessThan(owner.chart.freeCash[1]);
  });

  it('drops a paid-in-full goal contribution out of free cash immediately (consume mode has no balance to exhaust)', () => {
    const withGoal = run({ goals: [TRAVEL_GOAL] });
    const withoutGoal = run({ goals: [] });

    expect(withoutGoal.freeCashAtInspect - withGoal.freeCashAtInspect).toBeCloseTo(TRAVEL_GOAL.monthlyAmount, 6);
  });

  it('reports a warning verdict once free cash goes negative but savings still cover it', () => {
    const heavyGoal: RecurringGoal = { ...COLLEGE_GOAL, monthlyAmount: 5000 };
    const result = run({ goals: [heavyGoal] });

    expect(result.verdict.tone).not.toBe('success');
  });

  it('reports success when cashflow stays positive throughout', () => {
    // A higher keep rate than the fixture's default 65%, since 65% runs slightly negative in year 1
    // for this fixture's expenses - bumped just for this test to exercise the "always positive" path.
    const result = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, netKeepRatePct: 80 } });

    expect(result.verdict).toEqual({
      tone: 'success',
      headline: 'Works.',
      detail: 'Free cash stays positive and savings keep building.',
    });
  });

  it('throws if the inspect year falls outside the modeled 1-18 range', () => {
    const result = () => run({ base: { ...BASE, inspectYear: 0 }, goals: [] });
    expect(result).toThrow();
  });

  describe('children / kids cost', () => {
    it('counts a year-0 child (already part of the household) immediately, inflated from today', () => {
      const result = run({ goals: [], children: [{ id: 'c1', year: 0 }], base: { ...BASE, inspectYear: 1 } });
      expect(result.snapshot.kidsCost).toBeCloseTo(500 * 1.03, 6);
    });

    it('does not count a future child before their arrival year', () => {
      const result = run({ goals: [], children: [{ id: 'c1', year: 5 }], base: { ...BASE, inspectYear: 1 } });
      expect(result.snapshot.kidsCost).toBe(0);
    });

    it('counts a future child from their arrival year on, inflated', () => {
      const result = run({ goals: [], children: [{ id: 'c1', year: 5 }], base: { ...BASE, inspectYear: 5 } });
      expect(result.snapshot.kidsCost).toBeCloseTo(500 * Math.pow(1.03, 5), 6);
    });

    it('sums cost across multiple active children', () => {
      const result = run({
        goals: [],
        children: [
          { id: 'c1', year: 0 },
          { id: 'c2', year: 0 },
        ],
        base: { ...BASE, inspectYear: 1 },
      });
      expect(result.snapshot.kidsCost).toBeCloseTo(2 * 500 * 1.03, 6);
    });

    it('folds a year-0 child into the Y0 chart baseline too', () => {
      const withChild = run({ goals: [], children: [{ id: 'c1', year: 0 }] });
      const without = run({ goals: [], children: [] });

      expect(without.chart.freeCash[0] - withChild.chart.freeCash[0]).toBe(500);
    });
  });

  describe('unallocated pool (no reserve-target top-up - see goals.ts "Emergency fund top-up" for that now)', () => {
    it('grows unallocated savings by exactly free cash * 12, with cash today left untouched', () => {
      const result = run({
        goals: [],
        base: { ...BASE, investmentReturnPct: 0, cashTodayK: 20, brokerageTodayK: 50, inspectYear: 1 },
      });

      const freeCashY1 = result.snapshot.freeCash;
      expect(result.chart.unallocatedSavings[1]).toBe(Math.round(70000 + freeCashY1 * 12));
    });
  });

  describe('goal active windows (startYear/endYear)', () => {
    it('contributes $0 before startYear and after endYear, full amount inside the window', () => {
      const windowed: RecurringGoal = { ...TRAVEL_GOAL, startYear: 5, endYear: 8 };
      const result = run({ goals: [windowed] });

      // Length 19: the Y0 baseline plus years 1-18.
      expect(result.chart.freeCash.length).toBe(19);
      // Free cash with the goal active (years 5-8) should be exactly $300 lower than the same year
      // with no goal at all; outside that window it should be identical. Series index === year number.
      const withoutGoal = run({ goals: [] });
      for (let year = 1; year <= 18; year++) {
        const diff = withoutGoal.chart.freeCash[year] - result.chart.freeCash[year];
        if (year >= 5 && year <= 8) {
          expect(diff).toBe(300);
        } else {
          expect(diff).toBe(0);
        }
      }
    });

    it('keeps an accumulate-mode balance compounding after endYear with no new contributions', () => {
      const windowed: RecurringGoal = { ...COLLEGE_GOAL, startYear: 1, endYear: 3 };
      const result = run({ goals: [windowed] });
      const balances = result.chart.goalBalances.college;

      // Balance still grows year-over-year after year 3 (investment return applied)... (index === year)
      expect(balances[6]).toBeGreaterThan(balances[4]);
      // ...but by ~the return rate (allowing a few dollars of rounding drift, since each year's
      // balance is independently rounded before the next year's growth is applied to it).
      expect(Math.abs(balances[6] - balances[5] * 1.06)).toBeLessThan(2);
    });

    it('holds an accumulate-mode balance at $0 before startYear', () => {
      const windowed: RecurringGoal = { ...COLLEGE_GOAL, startYear: 6, endYear: 18 };
      const result = run({ goals: [windowed] });
      const balances = result.chart.goalBalances.college;

      // Indices 0-5 are years 0-5, all before startYear 6.
      expect(balances.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
      expect(balances[6]).toBeGreaterThan(0);
    });
  });

  describe('configurable salary raise breakpoints', () => {
    it('compounds from Y0 immediately when there are no breakpoints at all', () => {
      const result = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, raises: [] } });

      // No breakpoints => growthAfterLastRaisePct (2%) applies from year 0: gross = 70000*1.02 = 71400
      // income = 71400*0.65/12 = 3867.5; freeCash = 3867.5 - 2266 - 1818 = -216.5
      // Index 1 = year 1 (chart index 0 is the Y0 baseline).
      expect(result.chart.freeCash[1]).toBe(-216);
    });

    it('does not require breakpoints to be pre-sorted by year', () => {
      const sorted = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, raises: SALARY_RAISES } });
      const shuffled = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, raises: [...SALARY_RAISES].reverse() } });

      expect(shuffled.chart.freeCash).toEqual(sorted.chart.freeCash);
    });

    it('applies "growth after last raise" starting from the final breakpoint, not a fixed year 10', () => {
      const oneBreakpoint = run({
        goals: [],
        primaryIncome: { ...PRIMARY_INCOME, raises: [{ id: 'r1', year: 3, raiseK: 15 }], growthAfterLastRaisePct: 5 },
      });

      // Year 3 is the last (only) breakpoint: gross salary = 85k there, then compounds at 5%/yr.
      // Year 4 gross = 85000 * 1.05 = 89250; income = 89250*0.65/12 = 4834.38
      // livingCosts = 2200*1.03^4 = 2476.12; housingCost = 1200 + 600*1.03^4 = 1875.31
      // freeCash = 4834.38 - 2476.12 - 1875.31 = 482.95
      expect(oneBreakpoint.chart.freeCash[4]).toBe(483);
    });

    it('raising salaryY0K alone never decreases free cash in any year', () => {
      // Raises are relative to Y0 (raiseK above it), and income is a flat share of gross salary, so
      // bumping Y0 shifts the whole gross-salary curve - and therefore income - up in every year,
      // never down. (This is the property the earlier Y0/raise-milestone bug fix was chasing.)
      const base = run({ goals: [] });
      const higherY0 = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, salaryY0K: 150 } });

      for (let year = 1; year <= 18; year++) {
        expect(higherY0.chart.freeCash[year]).toBeGreaterThanOrEqual(base.chart.freeCash[year]);
      }
    });
  });

  describe('job loss', () => {
    it('zeroes gross salary and income from that year on, permanently', () => {
      const result = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, jobLossYear: 3 } });

      expect(result.snapshot.year).toBe(5);
      expect(result.snapshot.grossSalary).toBe(0);
      expect(result.snapshot.netIncome).toBe(0);
    });

    it("overrides any raise breakpoints scheduled after the job-loss year - they never take effect", () => {
      const withoutLoss = run({ goals: [] });
      const withLoss = run({ goals: [], primaryIncome: { ...PRIMARY_INCOME, jobLossYear: 6 } });

      // Year 5 (before the yr6 job loss): identical to the no-job-loss run.
      expect(withLoss.chart.freeCash[5]).toBe(withoutLoss.chart.freeCash[5]);
      // Year 6 on: gross salary is $0 even though a raise breakpoint exists at yr6/yr10.
      for (let year = 6; year <= 18; year++) {
        expect(withLoss.chart.freeCash[year]).toBeLessThan(withoutLoss.chart.freeCash[year]);
      }
    });
  });

  describe('partner income', () => {
    const withPartner = (salaryY0K: number, netKeepRatePct: number, jobLossYear: number): ModelInputs['partnerIncome'] => ({
      salaryY0K,
      growthAfterLastRaisePct: 0,
      netKeepRatePct,
      raises: [],
      jobLossYear,
    });

    it('raises free cash in the years the partner is working', () => {
      const noPartner = run({ goals: [], partnerIncome: withPartner(0, 60, 10) });
      const withIncome = run({ goals: [], partnerIncome: withPartner(40, 60, 10) });

      // Year 5 (< jobLossYear 10): partner income = 40000*0.60/12 = 2000/mo, added straight through.
      expect(withIncome.chart.freeCash[5] - noPartner.chart.freeCash[5]).toBeCloseTo(2000, 6);
    });

    it('has no effect at all in years after the partner stops working - never negative', () => {
      const lowIncome = run({ goals: [], partnerIncome: withPartner(20, 60, 10) });
      const highIncome = run({ goals: [], partnerIncome: withPartner(80, 60, 10) });

      // Year 11 (>= jobLossYear 10): partner's gross salary is $0 regardless of salaryY0K, so no diff.
      expect(highIncome.chart.freeCash[11]).toBe(lowIncome.chart.freeCash[11]);
    });

    it('increasing partner income never decreases free cash in any year', () => {
      const lower = run({ goals: [], partnerIncome: withPartner(10, 60, 8) });
      const higher = run({ goals: [], partnerIncome: withPartner(60, 60, 8) });

      for (let year = 1; year <= 18; year++) {
        expect(higher.chart.freeCash[year]).toBeGreaterThanOrEqual(lower.chart.freeCash[year]);
      }
    });
  });
});
