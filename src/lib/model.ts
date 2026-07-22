import type { BaseInputs } from './baseData';
import type { RecurringGoal } from './goals';
import type { SalaryRaiseBreakpoint } from './salaryRaises';

/** A single wage earner's salary trajectory: today's gross salary, cumulative raises above it, a flat
 *  keep rate converting gross to net, and an optional permanent job loss. Primary and partner both use
 *  this exact shape, computed the exact same way (see `streamIncomeAndGross`). */
export interface IncomeStreamInputs {
  salaryY0K: number;
  growthAfterLastRaisePct: number;
  netKeepRatePct: number;
  raises: SalaryRaiseBreakpoint[];
  /** From this year on (inclusive), this stream's gross salary is $0 - permanent, and overrides any
   *  raise breakpoints scheduled after it. */
  jobLossYear?: number;
}

export interface ModelInputs {
  base: BaseInputs;
  ownsHome: boolean;
  goals: RecurringGoal[];
  primaryIncome: IncomeStreamInputs;
  partnerIncome: IncomeStreamInputs;
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
  partnerGrossSalary: number;
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

interface IncomeStreamContext {
  salaryY0: number;
  raiseMilestones: [number, number][];
  growthAfterLastRaise: number;
  netKeepRate: number;
  jobLossYear?: number;
}

function buildStreamContext(stream: IncomeStreamInputs): IncomeStreamContext {
  return {
    salaryY0: stream.salaryY0K * 1000,
    raiseMilestones: [...stream.raises].sort((a, b) => a.year - b.year).map((breakpoint) => [breakpoint.year, breakpoint.raiseK * 1000]),
    growthAfterLastRaise: stream.growthAfterLastRaisePct,
    netKeepRate: stream.netKeepRatePct / 100,
    jobLossYear: stream.jobLossYear,
  };
}

/** A permanent job loss zeroes gross salary (and therefore income) from that year on, regardless of
 *  any raise breakpoints scheduled after it. */
function streamIncomeAndGross(year: number, stream: IncomeStreamContext): { gross: number; income: number } {
  if (stream.jobLossYear !== undefined && year >= stream.jobLossYear) {
    return { gross: 0, income: 0 };
  }
  const gross = salaryAtYear(year, stream.salaryY0, stream.raiseMilestones, stream.growthAfterLastRaise);
  return { gross, income: (gross * stream.netKeepRate) / 12 };
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
  primary: IncomeStreamContext;
  partner: IncomeStreamContext;
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
  partnerGrossSalary: number;
}

function computeYearFigures(year: number, ctx: YearContext): YearFigures {
  const inflationFactor = Math.pow(1 + ctx.inflation / 100, year);
  const primary = streamIncomeAndGross(year, ctx.primary);
  const partner = streamIncomeAndGross(year, ctx.partner);
  const income = primary.income + partner.income;

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

  return {
    inflationFactor,
    income,
    livingCosts,
    kidsCost,
    housingCost,
    goalContributions,
    totalExpenses,
    freeCash,
    grossSalary: primary.gross,
    partnerGrossSalary: partner.gross,
  };
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
  const { base, ownsHome, goals, primaryIncome, partnerIncome } = inputs;

  const investmentReturn = base.investmentReturnPct;
  const inflation = base.inflationPct;
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
    primary: buildStreamContext(primaryIncome),
    partner: buildStreamContext(partnerIncome),
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
        partnerGrossSalary: figures.partnerGrossSalary,
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
