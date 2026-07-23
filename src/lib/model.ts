import type { BaseInputs } from './baseData';
import type { Child } from './children';
import { isPurchaseGoal, type RecurringGoal } from './goals';
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
  children: Child[];
  primaryIncome: IncomeStreamInputs;
  partnerIncome: IncomeStreamInputs;
}

export interface YearSnapshot {
  year: number;
  netIncome: number;
  livingCosts: number;
  kidsCost: number;
  housingCost: number;
  /** Monthly cost from completed non-property purchase goals (e.g. a boat) - additive on top of
   *  housingCost, unlike a completed property purchase which replaces it (see computeYearFigures). */
  purchaseCosts: number;
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

/** All free cash invests into brokerage; a dedicated reserve/emergency-fund target is just an
 *  `accumulate`-mode goal now (see goals.ts's "Emergency fund top-up" catalog entry), not a base
 *  mechanic. Cash today only moves if brokerage runs dry, as a last-resort draw-down. */
function advanceUnallocatedPool(pool: UnallocatedPool, freeCash: number, investmentReturnPct: number): void {
  pool.brokerage = pool.brokerage * (1 + investmentReturnPct / 100) + freeCash * 12;
  if (pool.brokerage < 0) {
    pool.cash += pool.brokerage;
    pool.brokerage = 0;
  }
}

function isGoalActive(goal: RecurringGoal, year: number): boolean {
  return year >= goal.startYear && year <= goal.endYear;
}

/** A goal's Y0 starting balance: its one-time cash/brokerage allocation, plus home equity if it's
 *  the one goal that claimed it (see goals.ts's equityAllocated/canAllocateEquity). */
function goalStartingBalance(goal: RecurringGoal, homeEquity: number): number {
  return goal.cashAllocated + goal.brokerageAllocated + (goal.equityAllocated ? homeEquity : 0);
}

/** Not a slider - loan term rarely varies, and it's one fewer slider to clutter a property goal
 *  with. Mortgage rate, unlike this, is a per-goal field (see goals.ts) since a future purchase's
 *  prevailing rate can differ from today's. */
export const MORTGAGE_TERM_YEARS = 30;

/** Standard amortization formula for a fixed-rate loan's monthly principal+interest payment.
 *  Zero-rate is special-cased (division by zero otherwise) - an interest-free loan just splits the
 *  principal evenly across every payment. */
export function monthlyMortgagePayment(loanAmount: number, annualRatePct: number, termYears: number): number {
  if (loanAmount <= 0) {
    return 0;
  }
  const numPayments = termYears * 12;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return loanAmount / numPayments;
  }
  return (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments));
}

/** Among property goals already completed as of `year` (endYear < year), the most recently
 *  completed one - that's the home you're actually living in now, so its estimated mortgage payment
 *  is what replaces your base housing cost (see computeYearFigures). `undefined` if none have
 *  completed yet, in which case the base housing cost still applies. */
function activePropertyGoal(goals: RecurringGoal[], year: number): RecurringGoal | undefined {
  return goals
    .filter((goal) => goal.category === 'property' && goal.endYear < year)
    .sort((a, b) => b.endYear - a.endYear)[0];
}

export interface MortgageEstimate {
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
}

/** Estimates a property goal's mortgage: down payment is the goal's target amount when set - the
 *  whole point of the goal is to reach that target and then buy, so the estimate (and the actual
 *  housing-cost replacement below) assume you hit it, same as the goal's own "Balance: $X / $Y
 *  target" framing already does. Falls back to `projectedBalance` (the goal's actual accumulated/
 *  frozen balance) only when no target is set. Shared by the live GoalCard preview and the real
 *  housing-cost-replacement computation so the two can never disagree. */
export function estimateMortgage(goal: RecurringGoal, projectedBalance: number): MortgageEstimate {
  const downPayment = goal.targetAmount ?? projectedBalance;
  const purchasePrice = (goal.purchasePriceK ?? 0) * 1000;
  const loanAmount = Math.max(0, purchasePrice - downPayment);
  const monthlyPayment = monthlyMortgagePayment(loanAmount, goal.mortgageRatePct ?? 0, MORTGAGE_TERM_YEARS);
  return { purchasePrice, downPayment, loanAmount, monthlyPayment };
}

/** Mutates `balances` in place. Before startYear, a goal's seed balance still compounds (money
 *  invested early grows even before the goal starts actively contributing). After endYear, the
 *  balance freezes entirely - no more growth, not just no more contribution - the goal is considered
 *  reached/realized at that point, not still sitting invested. */
function advanceGoalBalances(year: number, goals: RecurringGoal[], balances: Record<string, number>, investmentReturnPct: number): void {
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      if (year > goal.endYear) {
        continue;
      }
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
      series[goal.id].push(Math.round(balances[goal.id] ?? 0));
    }
  }
}

interface YearContext {
  base: BaseInputs;
  goals: RecurringGoal[];
  children: Child[];
  primary: IncomeStreamContext;
  partner: IncomeStreamContext;
  inflation: number;
  nonHousingLiving: number;
  fixedHousing: number;
  inflatingHousingBase: number;
  /** Live reference to runModel's goalBalances, mutated in place by advanceGoalBalances each year
   *  after this year's figures are computed - so it always reflects the balance as of the *previous*
   *  year when read here, which (thanks to the endYear freeze) is exactly a completed goal's frozen
   *  ending balance from then on. */
  goalBalances: Record<string, number>;
}

interface YearFigures {
  inflationFactor: number;
  income: number;
  livingCosts: number;
  kidsCost: number;
  housingCost: number;
  purchaseCosts: number;
  goalContributions: Record<string, number>;
  totalExpenses: number;
  freeCash: number;
  grossSalary: number;
  partnerGrossSalary: number;
}

/** The current housing cost: a completed property purchase's estimated mortgage payment (fixed,
 *  doesn't inflate - same treatment as the base P&I) replaces the base housing cost entirely once
 *  it exists; otherwise the base cost applies as before. */
function computeHousingCost(year: number, ctx: YearContext, inflationFactor: number): number {
  const purchasedHome = activePropertyGoal(ctx.goals, year);
  if (purchasedHome) {
    const endingBalance = ctx.goalBalances[purchasedHome.id] ?? 0;
    return estimateMortgage(purchasedHome, endingBalance).monthlyPayment;
  }
  return ctx.fixedHousing + ctx.inflatingHousingBase * inflationFactor;
}

/** Monthly cost from every completed non-property purchase goal (e.g. a boat) - unlike a property
 *  purchase's mortgage payment, this is a manual today's-dollars estimate, so it inflates like any
 *  other living cost. */
function computePurchaseCosts(year: number, goals: RecurringGoal[], inflationFactor: number): number {
  let total = 0;
  for (const goal of goals) {
    if (goal.category !== 'property' && isPurchaseGoal(goal) && year > goal.endYear) {
      total += (goal.postPurchaseMonthlyCost ?? 0) * inflationFactor;
    }
  }
  return total;
}

function computeYearFigures(year: number, ctx: YearContext): YearFigures {
  const inflationFactor = Math.pow(1 + ctx.inflation / 100, year);
  const primary = streamIncomeAndGross(year, ctx.primary);
  const partner = streamIncomeAndGross(year, ctx.partner);
  const income = primary.income + partner.income;

  const livingCosts = ctx.nonHousingLiving * inflationFactor;
  const childCount = ctx.children.filter((child) => child.year <= year).length;
  const kidsCost = childCount * ctx.base.costPerKidMo * inflationFactor;
  const housingCost = computeHousingCost(year, ctx, inflationFactor);
  const purchaseCosts = computePurchaseCosts(year, ctx.goals, inflationFactor);

  const goalContributions: Record<string, number> = {};
  let goalTotal = 0;
  for (const goal of ctx.goals) {
    const amount = isGoalActive(goal, year) ? goal.monthlyAmount : 0;
    goalContributions[goal.id] = amount;
    goalTotal += amount;
  }

  const totalExpenses = livingCosts + kidsCost + housingCost + purchaseCosts;
  const freeCash = income - totalExpenses - goalTotal;

  return {
    inflationFactor,
    income,
    livingCosts,
    kidsCost,
    housingCost,
    purchaseCosts,
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
  const { base, ownsHome, goals, children, primaryIncome, partnerIncome } = inputs;

  const investmentReturn = base.investmentReturnPct;
  const inflation = base.inflationPct;

  const nonHousingLiving = base.expensesMo - base.housingPaymentMo;
  // Owning: P&I is fixed forever, the rest (escrow) inflates. Renting: the whole payment inflates.
  const fixedHousing = ownsHome ? base.housingPrincipalInterestMo : 0;
  const inflatingHousingBase = ownsHome ? base.housingPaymentMo - base.housingPrincipalInterestMo : base.housingPaymentMo;

  // Cash/brokerage allocated to a goal (see goals.ts's cashAllocated/brokerageAllocated) leaves the
  // shared pool and becomes that goal's starting balance instead.
  const cashAllocatedTotal = goals.reduce((sum, goal) => sum + goal.cashAllocated, 0);
  const brokerageAllocatedTotal = goals.reduce((sum, goal) => sum + goal.brokerageAllocated, 0);

  const pool: UnallocatedPool = {
    brokerage: base.brokerageTodayK * 1000 - brokerageAllocatedTotal,
    cash: base.cashTodayK * 1000 - cashAllocatedTotal,
  };
  const homeEquity = ownsHome ? Math.max(0, base.homeValueK - base.mortgageBalanceK) * 1000 : 0;

  const goalBalances: Record<string, number> = {};
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      goalBalances[goal.id] = goalStartingBalance(goal, homeEquity);
    }
  }
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
    children,
    primary: buildStreamContext(primaryIncome),
    partner: buildStreamContext(partnerIncome),
    inflation,
    nonHousingLiving,
    fixedHousing,
    inflatingHousingBase,
    goalBalances,
  };

  // Year 0: today, before any growth or inflation - anchors the chart at your actual current
  // numbers (income, expenses, and any children already at year 0) instead of jumping straight to
  // a year already one year out.
  const baselineFigures = computeYearFigures(0, yearContext);
  yearLabels.push('Y0');
  unallocatedSeries.push(Math.round(pool.brokerage + pool.cash));
  freeCashSeries.push(Math.round(baselineFigures.freeCash));
  recordGoalSeries(goals, goalBalances, goalSeries);

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
        purchaseCosts: figures.purchaseCosts,
        totalExpenses: figures.totalExpenses,
        freeCash,
        goalContributions: figures.goalContributions,
        grossSalary: figures.grossSalary,
        partnerGrossSalary: figures.partnerGrossSalary,
        realIncome: figures.income / figures.inflationFactor,
      };
    }

    advanceGoalBalances(year, goals, goalBalances, investmentReturn);
    advanceUnallocatedPool(pool, freeCash, investmentReturn);

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
    // Series index === year number now that index 0 is the Y0 baseline, so no -1 offset here.
    unallocatedAtInspect: unallocatedSeries[base.inspectYear],
    unallocatedAtEnd: finalUnallocated,
    snapshot,
    chart: { yearLabels, unallocatedSavings: unallocatedSeries, freeCash: freeCashSeries, goalBalances: goalSeries },
    verdict,
  };
}
