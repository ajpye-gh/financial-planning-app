import { runModel } from '@src/lib/model';
import type { BaseInputs } from '@src/lib/baseData';
import type { RecurringGoal } from '@src/lib/goals';

// A fixed fixture, independent of Defaults.json, so this test stays stable regardless of what the
// committed defaults happen to contain.
const BASE: BaseInputs = {
  netIncomeMo: 6000,
  expensesMo: 4000,
  housingPaymentMo: 1800,
  housingPrincipalInterestMo: 1200,
  homeValueK: 350,
  mortgageBalanceK: 250,
  brokerageTodayK: 50,
  cashTodayK: 20,
  reserveTargetK: 30,
  salaryY0K: 70,
  salaryRaiseY1K: 5,
  salaryRaiseY4K: 20,
  salaryRaiseY6K: 30,
  salaryRaiseY10K: 50,
  salaryGrowthAfterY10Pct: 2,
  netKeepRatePct: 65,
  partnerNetIncomeMo: 0,
  partnerIncomeStopsYear: 19,
  kidsAdded: 0,
  costPerKidMo: 500,
  inflationPct: 3,
  investmentReturnPct: 6,
  inspectYear: 5,
};

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
    const result = runModel({ base: BASE, ownsHome: true, goals: [TRAVEL_GOAL, COLLEGE_GOAL] });

    // income = 6000 + (75000-70000)*0.65/12 = 6270.83; livingCosts = 2200*1.03 = 2266;
    // housingCost = 1200 + 600*1.03 = 1818; freeCash = 6270.83 - 2266 - 1818 - 600 = 1586.83
    expect(result.chart.freeCash[0]).toBe(1587);
    // cash tops up to reserve (20000 -> 30000, using 10000 of the 19042 annual free cash), the rest
    // (9042) invests: brokerage = 50000*1.06 + 9042 = 62042; unallocated = 62042 + 30000
    expect(result.chart.unallocatedSavings[0]).toBe(92042);
    // college balance: 0*1.06 + 300*12 = 3600
    expect(result.chart.goalBalances.college[0]).toBe(3600);
    // travel is consume-mode - no balance series at all
    expect(result.chart.goalBalances.travel).toBeUndefined();

    expect(result.snapshot.year).toBe(5);
    expect(result.snapshot.goalContributions).toEqual({ travel: 300, college: 300 });
  });

  it('reports unallocatedAtInspect for the chosen inspect year, distinct from unallocatedAtEnd (year 18)', () => {
    const result = runModel({ base: BASE, ownsHome: true, goals: [] });

    expect(result.unallocatedAtInspect).toBe(result.chart.unallocatedSavings[BASE.inspectYear - 1]);
    expect(result.unallocatedAtInspect).not.toBe(result.unallocatedAtEnd);
    expect(result.unallocatedAtEnd).toBe(result.chart.unallocatedSavings[17]);
  });

  it('treats the full housing payment as inflating when renting, vs. a fixed P&I portion when owning', () => {
    const owner = runModel({ base: BASE, ownsHome: true, goals: [] });
    const renter = runModel({ base: BASE, ownsHome: false, goals: [] });

    // Year 1: owner housing = 1200 + 600*1.03 = 1818; renter housing = 1800*1.03 = 1854. Same income
    // and expenses otherwise, so the renter's higher housing cost shows up directly as lower free cash.
    expect(renter.chart.freeCash[0]).toBeLessThan(owner.chart.freeCash[0]);
  });

  it('drops a paid-in-full goal contribution out of free cash immediately (consume mode has no balance to exhaust)', () => {
    const withGoal = runModel({ base: BASE, ownsHome: true, goals: [TRAVEL_GOAL] });
    const withoutGoal = runModel({ base: BASE, ownsHome: true, goals: [] });

    expect(withoutGoal.freeCashAtInspect - withGoal.freeCashAtInspect).toBeCloseTo(TRAVEL_GOAL.monthlyAmount, 6);
  });

  it('reports a warning verdict once free cash goes negative but savings still cover it', () => {
    const heavyGoal: RecurringGoal = { ...COLLEGE_GOAL, monthlyAmount: 5000 };
    const result = runModel({ base: BASE, ownsHome: true, goals: [heavyGoal] });

    expect(result.verdict.tone).not.toBe('success');
  });

  it('reports success when cashflow stays positive throughout', () => {
    const result = runModel({ base: BASE, ownsHome: true, goals: [] });

    expect(result.verdict).toEqual({
      tone: 'success',
      headline: 'Works.',
      detail: 'Free cash stays positive and savings keep building.',
    });
  });

  it('throws if the inspect year falls outside the modeled 1-18 range', () => {
    const result = () => runModel({ base: { ...BASE, inspectYear: 0 }, ownsHome: true, goals: [] });
    expect(result).toThrow();
  });

  describe('goal active windows (startYear/endYear)', () => {
    it('contributes $0 before startYear and after endYear, full amount inside the window', () => {
      const windowed: RecurringGoal = { ...TRAVEL_GOAL, startYear: 5, endYear: 8 };
      const result = runModel({ base: BASE, ownsHome: true, goals: [windowed] });

      expect(result.chart.freeCash.length).toBe(18);
      // Free cash with the goal active (years 5-8, 0-indexed 4-7) should be exactly $300 lower than
      // the same year with no goal at all; outside that window it should be identical.
      const withoutGoal = runModel({ base: BASE, ownsHome: true, goals: [] });
      for (let year = 1; year <= 18; year++) {
        const diff = withoutGoal.chart.freeCash[year - 1] - result.chart.freeCash[year - 1];
        if (year >= 5 && year <= 8) {
          expect(diff).toBe(300);
        } else {
          expect(diff).toBe(0);
        }
      }
    });

    it('keeps an accumulate-mode balance compounding after endYear with no new contributions', () => {
      const windowed: RecurringGoal = { ...COLLEGE_GOAL, startYear: 1, endYear: 3 };
      const result = runModel({ base: BASE, ownsHome: true, goals: [windowed] });
      const balances = result.chart.goalBalances.college;

      // Balance still grows year-over-year after year 3 (investment return applied)...
      expect(balances[5]).toBeGreaterThan(balances[3]);
      // ...but by ~the return rate (allowing a few dollars of rounding drift, since each year's
      // balance is independently rounded before the next year's growth is applied to it).
      expect(Math.abs(balances[5] - balances[4] * 1.06)).toBeLessThan(2);
    });

    it('holds an accumulate-mode balance at $0 before startYear', () => {
      const windowed: RecurringGoal = { ...COLLEGE_GOAL, startYear: 6, endYear: 18 };
      const result = runModel({ base: BASE, ownsHome: true, goals: [windowed] });
      const balances = result.chart.goalBalances.college;

      expect(balances.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
      expect(balances[5]).toBeGreaterThan(0);
    });
  });
});
