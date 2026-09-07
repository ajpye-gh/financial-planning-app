import {
  estimateMortgage,
  monthlyMortgagePayment,
  projectHomeEquity,
  runModel,
  type IncomeStreamInputs,
  type ModelInputs,
} from '@src/lib/model';
import type { BaseInputs } from '@src/lib/baseData';
import type { Child } from '@src/lib/children';
import type { RecurringGoal } from '@src/lib/goals';
import type { SalaryRaiseBreakpoint } from '@src/lib/salaryRaises';

// P&I is now computed from balance/rate/term (see monthlyMortgagePayment) instead of being a
// manually-entered fixture field. Solving for the balance that reproduces exactly the same $1200/mo
// figure the old fixture hardcoded keeps every hand-derived expected value below (which assumed a
// fixed $1200 P&I) still correct, without having to redo all that arithmetic by hand.
const BASE_MORTGAGE_RATE_PCT = 6;
const BASE_MORTGAGE_TERM_YEARS = 30;
const BASE_PI_TARGET = 1200;

function loanAmountForPayment(targetPayment: number, annualRatePct: number, termYears: number): number {
  const monthlyRate = annualRatePct / 100 / 12;
  const numPayments = termYears * 12;
  return (targetPayment * (1 - Math.pow(1 + monthlyRate, -numPayments))) / monthlyRate;
}

const BASE_MORTGAGE_BALANCE = loanAmountForPayment(BASE_PI_TARGET, BASE_MORTGAGE_RATE_PCT, BASE_MORTGAGE_TERM_YEARS);

// A fixed fixture, independent of Defaults.json, so this test stays stable regardless of what the
// committed defaults happen to contain.
const BASE: BaseInputs = {
  expensesMo: 4000,
  housingPaymentMo: 1800,
  homeValueK: 350,
  mortgageBalanceK: BASE_MORTGAGE_BALANCE / 1000,
  currentMortgageRatePct: BASE_MORTGAGE_RATE_PCT,
  mortgageTermYears: BASE_MORTGAGE_TERM_YEARS,
  mortgageInsuranceMo: 0,
  mortgageExtraPrincipalMo: 0,
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
  category: 'other',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  startYear: 1,
  endYear: 18,
  cashAllocated: 0,
  brokerageAllocated: 0,
  equityAllocated: false,
  isPurchase: false,
};

const COLLEGE_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'college',
  name: 'College',
  mode: 'accumulate',
  category: 'other',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  targetAmount: 80000,
  startYear: 1,
  endYear: 18,
  cashAllocated: 0,
  brokerageAllocated: 0,
  equityAllocated: false,
  isPurchase: false,
};

const PROPERTY_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'property',
  name: 'Property purchase',
  mode: 'accumulate',
  category: 'property',
  monthlyAmount: 500,
  monthlyAmountRange: { min: 0, max: 5000, step: 100 },
  startYear: 1,
  endYear: 18,
  cashAllocated: 0,
  brokerageAllocated: 0,
  equityAllocated: false,
  isPurchase: true,
  purchasePriceK: 400,
  mortgageRatePct: 6,
};

const BOAT_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'boat',
  name: 'Boat',
  mode: 'accumulate',
  category: 'other',
  monthlyAmount: 200,
  monthlyAmountRange: { min: 0, max: 2000, step: 50 },
  startYear: 1,
  endYear: 3,
  cashAllocated: 0,
  brokerageAllocated: 0,
  equityAllocated: false,
  isPurchase: true,
  postPurchaseMonthlyCost: 150,
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

  describe('unallocated pool (no reserve-target - see goals.ts "Emergency fund" for that now)', () => {
    it('grows unallocated savings by exactly free cash * 12, with cash today left untouched', () => {
      const result = run({
        goals: [],
        base: { ...BASE, investmentReturnPct: 0, cashTodayK: 20, brokerageTodayK: 50, inspectYear: 1 },
      });

      const freeCashY1 = result.snapshot.freeCash;
      expect(result.chart.unallocatedSavings[1]).toBe(Math.round(70000 + freeCashY1 * 12));
    });
  });

  describe('goal asset allocation (cashAllocated / brokerageAllocated)', () => {
    it("seeds an accumulate goal's Y0 balance from its allocation, and pulls that out of the shared pool", () => {
      const funded: RecurringGoal = { ...COLLEGE_GOAL, cashAllocated: 5000, brokerageAllocated: 10000 };
      const result = run({ goals: [funded], base: { ...BASE, cashTodayK: 20, brokerageTodayK: 50 } });

      expect(result.chart.goalBalances.college[0]).toBe(15000);
      // The shared pool starts with the remainder: (20000 cash + 50000 brokerage) - 15000 allocated.
      expect(result.chart.unallocatedSavings[0]).toBe(55000);
    });

    it('conserves total starting assets: pool + every allocated goal balance sums to cash + brokerage today', () => {
      const funded: RecurringGoal = { ...COLLEGE_GOAL, cashAllocated: 5000, brokerageAllocated: 10000 };
      const result = run({ goals: [funded], base: { ...BASE, cashTodayK: 20, brokerageTodayK: 50 } });

      expect(result.chart.unallocatedSavings[0] + result.chart.goalBalances.college[0]).toBe(70000);
    });

    it('leaves an unallocated goal starting at $0, with the full pool untouched', () => {
      const result = run({ goals: [COLLEGE_GOAL], base: { ...BASE, cashTodayK: 20, brokerageTodayK: 50 } });

      expect(result.chart.goalBalances.college[0]).toBe(0);
      expect(result.chart.unallocatedSavings[0]).toBe(70000);
    });
  });

  describe('projectHomeEquity', () => {
    const OWNED_BASE = { ...BASE, currentMortgageRatePct: 3 };

    it('projects home value via appreciation (inflation-linked) and mortgage balance via amortization', () => {
      const result = projectHomeEquity(OWNED_BASE, true, 3);

      expect(result.homeValue).toBeCloseTo(350000 * Math.pow(1.03, 3), 6);
      expect(result.mortgageBalance).toBeGreaterThan(0);
      expect(result.mortgageBalance).toBeLessThan(OWNED_BASE.mortgageBalanceK * 1000);
      expect(result.equity).toBeCloseTo(result.homeValue - result.mortgageBalance, 6);
    });

    it('is $0 across the board when renting - no current home', () => {
      expect(projectHomeEquity(OWNED_BASE, false, 5)).toEqual({ year: 5, homeValue: 0, mortgageBalance: 0, equity: 0 });
    });

    it('grows over time as the mortgage pays down and the home appreciates', () => {
      const year3 = projectHomeEquity(OWNED_BASE, true, 3);
      const year8 = projectHomeEquity(OWNED_BASE, true, 8);
      expect(year8.equity).toBeGreaterThan(year3.equity);
    });

    it('floors the mortgage balance at $0 once the loan would be fully paid off', () => {
      // The level payment is calibrated (by definition of the standard amortization formula) to
      // fully pay off the balance in exactly mortgageTermYears (30) at the OWNED_BASE rate - so year
      // 40 is well past payoff regardless of the exact balance/rate, past the app's own 18yr horizon
      // too, just to confirm the flooring behavior itself is correct.
      const result = projectHomeEquity(OWNED_BASE, true, 40);
      expect(result.mortgageBalance).toBe(0);
    });
  });

  describe('goal asset allocation (equityAllocated)', () => {
    it('does not seed the Y0 balance with equity - it is injected at endYear instead', () => {
      const funded: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: true, endYear: 3 };
      const result = run({ goals: [funded], base: { ...BASE, currentMortgageRatePct: 3 } });

      expect(result.chart.goalBalances.property[0]).toBe(0);
    });

    it('injects the realistically projected equity exactly at endYear, matching projectHomeEquity', () => {
      const funded: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: true, monthlyAmount: 0, endYear: 3 };
      const base = { ...BASE, currentMortgageRatePct: 3 };
      const result = run({ goals: [funded], base });

      const expectedEquity = projectHomeEquity(base, true, 3).equity;
      expect(result.chart.goalBalances.property[2]).toBe(0); // year before endYear: still nothing
      expect(result.chart.goalBalances.property[3]).toBeCloseTo(expectedEquity, 0); // rounded to whole dollars in the series
    });

    it('leaves the goal unfunded by equity when not allocated', () => {
      const noContribution: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: false, monthlyAmount: 0 };
      const result = run({ goals: [noContribution], base: { ...BASE, currentMortgageRatePct: 3 } });
      expect(result.chart.goalBalances.property[18]).toBe(0);
    });

    it('stacks equity on top of ongoing monthly contributions', () => {
      const funded: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: true, endYear: 3 };
      const base = { ...BASE, currentMortgageRatePct: 3 };
      const withEquity = run({ goals: [funded], base }).chart.goalBalances.property[3];
      const withoutEquity = run({ goals: [{ ...funded, equityAllocated: false }], base }).chart.goalBalances.property[3];

      expect(withEquity).toBeGreaterThan(withoutEquity);
      // Precision -1 (nearest $10), not 0: withEquity and withoutEquity are each independently
      // Math.round()'ed to whole dollars in their own goalBalances series, so their difference can be
      // off by up to ~$1 from the raw unrounded equity figure - unrelated to this fixture's mortgage
      // numbers specifically, just a rounding-boundary margin that needs a little more slack.
      expect(withEquity - withoutEquity).toBeCloseTo(projectHomeEquity(base, true, 3).equity, -1);
    });

    it("doesn't seed equity for a renter, even if allocated", () => {
      const funded: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: true, monthlyAmount: 0 };
      const result = run({ goals: [funded], ownsHome: false, base: { ...BASE, currentMortgageRatePct: 3 } });

      expect(result.chart.goalBalances.property[18]).toBe(0);
    });

    it('does not compound the injected equity further - frozen immediately, same as any other post-endYear balance', () => {
      const funded: RecurringGoal = { ...PROPERTY_GOAL, equityAllocated: true, monthlyAmount: 0, endYear: 3 };
      const base = { ...BASE, currentMortgageRatePct: 3 };
      const result = run({ goals: [funded], base });

      expect(result.chart.goalBalances.property[10]).toBe(result.chart.goalBalances.property[3]);
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

    it('freezes an accumulate-mode balance entirely after endYear - no more growth, not just no more contributions', () => {
      const windowed: RecurringGoal = { ...COLLEGE_GOAL, startYear: 1, endYear: 3 };
      const result = run({ goals: [windowed] });
      const balances = result.chart.goalBalances.college;

      // Every year past endYear 3 holds at exactly the year-3 balance - the goal is considered
      // reached/realized at that point, not still sitting invested and compounding.
      for (let year = 4; year <= 18; year++) {
        expect(balances[year]).toBe(balances[3]);
      }
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

  describe('monthlyMortgagePayment', () => {
    it('matches a hand-verified standard amortization payment', () => {
      // $300,000 loan, 6% annual (0.5%/mo), 30yr (360 payments):
      // M = 300000 * 0.005 / (1 - 1.005^-360) ~= 1798.65
      expect(monthlyMortgagePayment(300000, 6, 30)).toBeCloseTo(1798.65, 1);
    });

    it('splits the principal evenly across payments at a zero interest rate', () => {
      expect(monthlyMortgagePayment(360000, 0, 30)).toBeCloseTo(1000, 6);
    });

    it('is $0 for a zero or negative loan amount (down payment covers the full price)', () => {
      expect(monthlyMortgagePayment(0, 6, 30)).toBe(0);
      expect(monthlyMortgagePayment(-5000, 6, 30)).toBe(0);
    });
  });

  describe('estimateMortgage', () => {
    it('uses the projected balance as the down payment - property goals have no separate target amount', () => {
      const estimate = estimateMortgage(PROPERTY_GOAL, 100000);

      expect(estimate.purchasePrice).toBe(400000);
      expect(estimate.downPayment).toBe(100000);
      expect(estimate.loanAmount).toBe(300000);
      expect(estimate.monthlyPayment).toBeCloseTo(monthlyMortgagePayment(300000, 6, 30), 6);
    });

    it('a larger projected balance lowers the loan amount and the monthly payment', () => {
      const lower = estimateMortgage(PROPERTY_GOAL, 50000);
      const higher = estimateMortgage(PROPERTY_GOAL, 150000);

      expect(higher.loanAmount).toBeLessThan(lower.loanAmount);
      expect(higher.monthlyPayment).toBeLessThan(lower.monthlyPayment);
    });

    it('never lets the loan amount go negative when the projected balance exceeds the purchase price', () => {
      const estimate = estimateMortgage(PROPERTY_GOAL, 500000);

      expect(estimate.loanAmount).toBe(0);
      expect(estimate.monthlyPayment).toBe(0);
    });
  });

  describe('housing cost replacement (a completed property purchase)', () => {
    it('uses the base housing cost before the purchase completes', () => {
      const result = run({ goals: [PROPERTY_GOAL], base: { ...BASE, inspectYear: 3 } });
      // Year 3 <= endYear 18: purchase hasn't completed, base housing (1200 + 600*1.03^3) applies.
      expect(result.snapshot.housingCost).toBeCloseTo(1200 + 600 * Math.pow(1.03, 3), 6);
    });

    it('replaces the base housing cost with the estimated mortgage payment once the purchase completes, using the actual projected balance as the down payment', () => {
      const completed: RecurringGoal = { ...PROPERTY_GOAL, startYear: 1, endYear: 2, monthlyAmount: 2000 };
      const result = run({ goals: [completed], base: { ...BASE, inspectYear: 5 } });

      const downPayment = result.chart.goalBalances.property[2];
      const expectedPayment = monthlyMortgagePayment(400000 - downPayment, 6, 30);
      expect(result.snapshot.housingCost).toBeCloseTo(expectedPayment, 6);
    });

    it('does not inflate the post-purchase mortgage payment - same fixed-P&I treatment as base housing', () => {
      const completed: RecurringGoal = { ...PROPERTY_GOAL, startYear: 1, endYear: 2 };
      const year5 = run({ goals: [completed], base: { ...BASE, inspectYear: 5 } });
      const year10 = run({ goals: [completed], base: { ...BASE, inspectYear: 10 } });

      expect(year5.snapshot.housingCost).toBeCloseTo(year10.snapshot.housingCost, 6);
    });

    it('uses the most recently completed property goal when more than one has completed', () => {
      const first: RecurringGoal = { ...PROPERTY_GOAL, id: 'first', startYear: 1, endYear: 2, purchasePriceK: 300 };
      const second: RecurringGoal = { ...PROPERTY_GOAL, id: 'second', startYear: 3, endYear: 4, purchasePriceK: 600 };
      const result = run({ goals: [first, second], base: { ...BASE, inspectYear: 6 } });

      const secondDownPayment = result.chart.goalBalances.second[4];
      const expectedPayment = monthlyMortgagePayment(600000 - secondDownPayment, 6, 30);
      expect(result.snapshot.housingCost).toBeCloseTo(expectedPayment, 6);
    });
  });

  describe('other purchase costs (non-property isPurchase goals)', () => {
    it('adds nothing before the purchase completes', () => {
      const result = run({ goals: [BOAT_GOAL], base: { ...BASE, inspectYear: 2 } });
      expect(result.snapshot.purchaseCosts).toBe(0);
    });

    it('adds the manual monthly cost on top of expenses once completed, inflated from today', () => {
      const result = run({ goals: [BOAT_GOAL], base: { ...BASE, inspectYear: 5 } });
      expect(result.snapshot.purchaseCosts).toBeCloseTo(150 * Math.pow(1.03, 5), 6);
    });

    it('does not replace housing cost - additive, unlike a property purchase', () => {
      const withBoat = run({ goals: [BOAT_GOAL], base: { ...BASE, inspectYear: 5 } });
      const withoutBoat = run({ goals: [], base: { ...BASE, inspectYear: 5 } });

      expect(withBoat.snapshot.housingCost).toBeCloseTo(withoutBoat.snapshot.housingCost, 6);
      expect(withBoat.snapshot.totalExpenses).toBeGreaterThan(withoutBoat.snapshot.totalExpenses);
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
