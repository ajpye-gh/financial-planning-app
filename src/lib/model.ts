import type { BaseInputs } from './baseData';
import type { RecurringGoal } from './goals';

export interface ModelInputs {
  base: BaseInputs;
  ownsHome: boolean;
  goals: RecurringGoal[];
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
  unallocatedAtEnd: number;
  snapshot: YearSnapshot;
  chart: ChartSeries;
  verdict: Verdict;
}

export const HORIZON_YEARS = 18;

function salaryAtYear(year: number, milestones: [number, number][], growthAfterY10Pct: number): number {
  const last = milestones[milestones.length - 1];
  if (year >= 10) {
    return last[1] * Math.pow(1 + growthAfterY10Pct / 100, year - 10);
  }
  for (let i = 1; i < milestones.length; i++) {
    const [ay, av] = milestones[i - 1];
    const [by, bv] = milestones[i];
    if (year <= by) {
      return av + ((bv - av) * (year - ay)) / (by - ay);
    }
  }
  return last[1];
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

function advanceGoalBalances(goals: RecurringGoal[], balances: Record<string, number>, investmentReturnPct: number): void {
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      const previous = balances[goal.id] ?? 0;
      balances[goal.id] = previous * (1 + investmentReturnPct / 100) + goal.monthlyAmount * 12;
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
  salaryMilestones: [number, number][];
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
  const grossSalary = salaryAtYear(year, ctx.salaryMilestones, ctx.growthAfterY10);
  let income = ctx.base.netIncomeMo + ((grossSalary - ctx.salaryMilestones[0][1]) * ctx.netKeepRate) / 12;
  if (year >= ctx.base.partnerIncomeStopsYear) {
    income -= ctx.base.partnerNetIncomeMo;
  }

  const livingCosts = ctx.nonHousingLiving * inflationFactor;
  const kidsCost = Math.min(ctx.base.kidsAdded, Math.floor(year / 2.5)) * ctx.base.costPerKidMo * inflationFactor;
  const housingCost = ctx.fixedHousing + ctx.inflatingHousingBase * inflationFactor;

  const goalContributions: Record<string, number> = {};
  let goalTotal = 0;
  for (const goal of ctx.goals) {
    goalContributions[goal.id] = goal.monthlyAmount;
    goalTotal += goal.monthlyAmount;
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
  const { base, ownsHome, goals } = inputs;

  const salaryMilestones: [number, number][] = [
    [0, base.salaryY0K * 1000],
    [1, base.salaryY1K * 1000],
    [4, base.salaryY4K * 1000],
    [6, base.salaryY6K * 1000],
    [10, base.salaryY10K * 1000],
  ];
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
    salaryMilestones,
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

    advanceGoalBalances(goals, goalBalances, investmentReturn);
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
    unallocatedAtEnd: finalUnallocated,
    snapshot,
    chart: { yearLabels, unallocatedSavings: unallocatedSeries, freeCash: freeCashSeries, goalBalances: goalSeries },
    verdict,
  };
}
