import type { BaseInputs } from './baseData';
import type { RecurringGoal } from './goals';
import type { SalaryRaiseBreakpoint } from './salaryRaises';

export interface ModelInputs {
  base: BaseInputs;
  ownsHome: boolean;
  goals: RecurringGoal[];
  salaryRaises: SalaryRaiseBreakpoint[];
}

export interface YearSnapshot {
  year: number;
  netIncome: number;
  livingCosts: number;
  kidsCost: number;
  housingCost: number;
  totalExpenses: number;
  freeCash: number;
  goalContributions: Record<string, number>;
  grossSalary: number;
  realIncome: number;
}

export interface ChartSeries {
  yearLabels: string[];
  unallocatedSavings: number[];
  freeCash: number[];
  /** Balance curve for each `mode: 'accumulate'` goal, keyed by goal id. */
  goalBalances: Record<string, number[]>;
}

export type VerdictTone = 'danger' | 'warning' | 'success';

export interface Verdict {
  tone: VerdictTone;
  headline: string;
  detail: string;
}

export interface ModelResult {
  freeCashAtInspect: number;
  unallocatedAtInspect: number;
  unallocatedAtEnd: number;
  snapshot: YearSnapshot;
  chart: ChartSeries;
  verdict: Verdict;
}

export const HORIZON_YEARS = 18;

/** `raiseMilestones` are cumulative raises above `salaryY0` (e.g. year 4 => $20k more than today),
 *  not absolute targets - so this curve shifts entirely with `salaryY0` instead of being squeezed or
 *  inverted by it. */
function raiseAtYear(year: number, raiseMilestones: [number, number][]): number {
  const milestones: [number, number][] = [[0, 0], ...raiseMilestones];
  const last = milestones[milestones.length - 1];
  for (let i = 1; i < milestones.length; i++) {
    const [ay, av] = milestones[i - 1];
    const [by, bv] = milestones[i];
    if (year <= by) {
      return av + ((bv - av) * (year - ay)) / (by - ay);
    }
  }
  return last[1];
}

/** `raiseMilestones` must be sorted ascending by year. Growth compounds after the last breakpoint
 *  (year 0, i.e. immediately, if there are none). */
function salaryAtYear(year: number, salaryY0: number, raiseMilestones: [number, number][], growthAfterLastRaisePct: number): number {
  const lastYear = raiseMilestones.length > 0 ? raiseMilestones[raiseMilestones.length - 1][0] : 0;
  if (year >= lastYear) {
    const salaryAtLastRaise = salaryY0 + raiseAtYear(lastYear, raiseMilestones);
    return salaryAtLastRaise * Math.pow(1 + growthAfterLastRaisePct / 100, year - lastYear);
  }
  return salaryY0 + raiseAtYear(year, raiseMilestones);
}

interface UnallocatedPool {
  brokerage: number;
  cash: number;
}

/** Tops cash up to the reserve target before investing anything else, mirroring financial-planning's mechanic. */
function advanceUnallocatedPool(pool: UnallocatedPool, freeCash: number, reserveTarget: number, investmentReturnPct: number): void {
  if (pool.cash < reserveTarget && freeCash > 0) {
    const topUp = Math.min(freeCash * 12, reserveTarget - pool.cash);
    pool.cash += topUp;
    pool.brokerage = pool.brokerage * (1 + investmentReturnPct / 100) + (freeCash * 12 - topUp);
  } else {
    pool.brokerage = pool.brokerage * (1 + investmentReturnPct / 100) + freeCash * 12;
  }
  if (pool.brokerage < 0) {
    pool.cash += pool.brokerage;
    pool.brokerage = 0;
  }
}

function isGoalActive(goal: RecurringGoal, year: number): boolean {
  return year >= goal.startYear && year <= goal.endYear;
}

/** Mutates `balances` in place. A goal's balance keeps compounding at the investment return even
 *  outside its active window - only the new contribution stops, matching how a real account behaves
 *  once you stop (or haven't yet started) funding it. */
function advanceGoalBalances(year: number, goals: RecurringGoal[], balances: Record<string, number>, investmentReturnPct: number): void {
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      const previous = balances[goal.id] ?? 0;
      const contribution = isGoalActive(goal, year) ? goal.monthlyAmount * 12 : 0;
      balances[goal.id] = previous * (1 + investmentReturnPct / 100) + contribution;
    }
  }
}

function initGoalSeries(goals: RecurringGoal[]): Record<string, number[]> {
  const series: Record<string, number[]> = {};
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      series[goal.id] = [];
    }
  }
  return series;
}

function recordGoalSeries(goals: RecurringGoal[], balances: Record<string, number>, series: Record<string, number[]>): void {
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      series[goal.id].push(Math.round(balances[goal.id]));
    }
  }
}

interface YearContext {
  base: BaseInputs;
  goals: RecurringGoal[];
  salaryY0: number;
  raiseMilestones: [number, number][];
  growthAfterY10: number;
  netKeepRate: number;
  inflation: number;
  nonHousingLiving: number;
  fixedHousing: number;
  inflatingHousingBase: number;
}

interface YearFigures {
  inflationFactor: number;
  income: number;
  livingCosts: number;
  kidsCost: number;
  housingCost: number;
  goalContributions: Record<string, number>;
  totalExpenses: number;
  freeCash: number;
  grossSalary: number;
}

function computeYearFigures(year: number, ctx: YearContext): YearFigures {
  const inflationFactor = Math.pow(1 + ctx.inflation / 100, year);
  const grossSalary = salaryAtYear(year, ctx.salaryY0, ctx.raiseMilestones, ctx.growthAfterY10);
  let income = ctx.base.netIncomeMo + ((grossSalary - ctx.salaryY0) * ctx.netKeepRate) / 12;
  if (year >= ctx.base.partnerIncomeStopsYear) {
    income -= ctx.base.partnerNetIncomeMo;
  }

  const livingCosts = ctx.nonHousingLiving * inflationFactor;
  const kidsCost = Math.min(ctx.base.kidsAdded, Math.floor(year / 2.5)) * ctx.base.costPerKidMo * inflationFactor;
  const housingCost = ctx.fixedHousing + ctx.inflatingHousingBase * inflationFactor;

  const goalContributions: Record<string, number> = {};
  let goalTotal = 0;
  for (const goal of ctx.goals) {
    const amount = isGoalActive(goal, year) ? goal.monthlyAmount : 0;
    goalContributions[goal.id] = amount;
    goalTotal += amount;
  }

  const totalExpenses = livingCosts + kidsCost + housingCost;
  const freeCash = income - totalExpenses - goalTotal;

  return { inflationFactor, income, livingCosts, kidsCost, housingCost, goalContributions, totalExpenses, freeCash, grossSalary };
}

function buildVerdict(finalUnallocated: number, everNegative: boolean, firstNegativeYear: number): Verdict {
  if (finalUnallocated < 0) {
    return {
      tone: 'danger',
      headline: 'Depleted.',
      detail: `Your unallocated savings run out before year ${HORIZON_YEARS}.`,
    };
  }
  if (everNegative) {
    return {
      tone: 'warning',
      headline: `Negative from year ${firstNegativeYear}.`,
      detail: 'Savings cover it, but get drawn down.',
    };
  }
  return {
    tone: 'success',
    headline: 'Works.',
    detail: 'Free cash stays positive and savings keep building.',
  };
}

export function runModel(inputs: ModelInputs): ModelResult {
  const { base, ownsHome, goals, salaryRaises } = inputs;

  const salaryY0 = base.salaryY0K * 1000;
  const raiseMilestones: [number, number][] = [...salaryRaises]
    .sort((a, b) => a.year - b.year)
    .map((breakpoint) => [breakpoint.year, breakpoint.raiseK * 1000]);
  const growthAfterY10 = base.salaryGrowthAfterY10Pct;
  const netKeepRate = base.netKeepRatePct / 100;
  const inflation = base.inflationPct;
  const investmentReturn = base.investmentReturnPct;
  const reserveTarget = base.reserveTargetK * 1000;

  const nonHousingLiving = base.expensesMo - base.housingPaymentMo;
  // Owning: P&I is fixed forever, the rest (escrow) inflates. Renting: the whole payment inflates.
  const fixedHousing = ownsHome ? base.housingPrincipalInterestMo : 0;
  const inflatingHousingBase = ownsHome ? base.housingPaymentMo - base.housingPrincipalInterestMo : base.housingPaymentMo;

  const pool: UnallocatedPool = { brokerage: base.brokerageTodayK * 1000, cash: base.cashTodayK * 1000 };
  const goalBalances: Record<string, number> = {};
  const goalSeries = initGoalSeries(goals);

  let everNegative = false;
  let firstNegativeYear = 0;
  let snapshot: YearSnapshot | null = null;

  const yearLabels: string[] = [];
  const unallocatedSeries: number[] = [];
  const freeCashSeries: number[] = [];

  const yearContext: YearContext = {
    base,
    goals,
    salaryY0,
    raiseMilestones,
    growthAfterY10,
    netKeepRate,
    inflation,
    nonHousingLiving,
    fixedHousing,
    inflatingHousingBase,
  };

  for (let year = 1; year <= HORIZON_YEARS; year++) {
    const figures = computeYearFigures(year, yearContext);
    const { freeCash } = figures;

    if (freeCash < 0 && !everNegative) {
      everNegative = true;
      firstNegativeYear = year;
    }

    if (year === base.inspectYear) {
      snapshot = {
        year,
        netIncome: figures.income,
        livingCosts: figures.livingCosts,
        kidsCost: figures.kidsCost,
        housingCost: figures.housingCost,
        totalExpenses: figures.totalExpenses,
        freeCash,
        goalContributions: figures.goalContributions,
        grossSalary: figures.grossSalary,
        realIncome: figures.income / figures.inflationFactor,
      };
    }

    advanceGoalBalances(year, goals, goalBalances, investmentReturn);
    advanceUnallocatedPool(pool, freeCash, reserveTarget, investmentReturn);

    yearLabels.push(`Y${year}`);
    unallocatedSeries.push(Math.round(pool.brokerage + pool.cash));
    freeCashSeries.push(Math.round(freeCash));
    recordGoalSeries(goals, goalBalances, goalSeries);
  }

  if (!snapshot) {
    throw new Error(`Inspect year ${base.inspectYear} is outside the modeled 1-${HORIZON_YEARS} range`);
  }

  const finalUnallocated = unallocatedSeries[unallocatedSeries.length - 1];
  const verdict = buildVerdict(finalUnallocated, everNegative, firstNegativeYear);

  return {
    freeCashAtInspect: snapshot.freeCash,
    unallocatedAtInspect: unallocatedSeries[base.inspectYear - 1],
    unallocatedAtEnd: finalUnallocated,
    snapshot,
    chart: { yearLabels, unallocatedSavings: unallocatedSeries, freeCash: freeCashSeries, goalBalances: goalSeries },
    verdict,
  };
}
