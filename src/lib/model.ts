import type { BaseInputs } from './baseData';
import type { Child } from './children';
import { isPurchaseGoal, type RecurringGoal } from './goals';
import type { SalaryRaiseBreakpoint } from './salaryRaises';

/** A single wage earner's salary trajectory: today's gross salary, a curve of absolute-income
 *  breakpoints it grows into, a flat keep rate converting gross to net, an optional yearly bonus, and
 *  an optional permanent job loss. Primary and partner both use this exact shape, computed the exact
 *  same way (see `streamIncomeAndGross`). */
export interface IncomeStreamInputs {
  salaryY0K: number;
  growthAfterLastRaisePct: number;
  netKeepRatePct: number;
  raises: SalaryRaiseBreakpoint[];
  /** Yearly bonus, in today's dollars - stays flat over the horizon (no automatic inflation growth),
   *  same treatment as salaryY0K/raises: an explicit nominal figure the user updates themselves
   *  rather than one this model grows on its own. Taxed at `netKeepRatePct`, same as salary. */
  annualBonusK: number;
  /** From this year on (inclusive), this stream's gross salary AND bonus are $0 - permanent, and
   *  overrides any raise breakpoints scheduled after it. */
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

/** `incomeMilestones` are ABSOLUTE gross income targets (e.g. year 4 => $105k total, not "$5k more
 *  than today"), anchored at `(0, salaryY0)`. Already floored to be non-decreasing from `salaryY0`
 *  onward by the time this runs (see `buildStreamContext`), so this is a plain interpolation with no
 *  extra clamping of its own. */
function incomeAtYear(year: number, salaryY0: number, incomeMilestones: [number, number][]): number {
  const milestones: [number, number][] = [[0, salaryY0], ...incomeMilestones];
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

/** `incomeMilestones` must be sorted ascending by year. Growth compounds after the last breakpoint
 *  (year 0, i.e. immediately, if there are none). */
function salaryAtYear(year: number, salaryY0: number, incomeMilestones: [number, number][], growthAfterLastRaisePct: number): number {
  const lastYear = incomeMilestones.length > 0 ? incomeMilestones[incomeMilestones.length - 1][0] : 0;
  if (year >= lastYear) {
    const salaryAtLastRaise = incomeAtYear(lastYear, salaryY0, incomeMilestones);
    return salaryAtLastRaise * Math.pow(1 + growthAfterLastRaisePct / 100, year - lastYear);
  }
  return incomeAtYear(year, salaryY0, incomeMilestones);
}

interface IncomeStreamContext {
  salaryY0: number;
  incomeMilestones: [number, number][];
  growthAfterLastRaise: number;
  netKeepRate: number;
  annualBonus: number;
  jobLossYear?: number;
}

function buildStreamContext(stream: IncomeStreamInputs): IncomeStreamContext {
  const salaryY0 = stream.salaryY0K * 1000;
  // Floor each breakpoint (sorted ascending by year) at the running max, starting from salaryY0 - so
  // the curve is guaranteed non-decreasing even if salaryY0K is raised/lowered independently of the
  // breakpoints (applyRaiseUpdate in salaryRaises.ts only enforces monotonicity among the breakpoints
  // themselves at edit time - it has no visibility into salaryY0K), or a breakpoint from before this
  // absolute-income semantics change sits below the current salary. Without this, an out-of-order edit
  // could silently model a pay cut partway through the timeline.
  let floor = salaryY0;
  const incomeMilestones: [number, number][] = [...stream.raises]
    .sort((a, b) => a.year - b.year)
    .map((breakpoint) => {
      const incomeAtBreakpoint = Math.max(breakpoint.incomeK * 1000, floor);
      floor = incomeAtBreakpoint;
      return [breakpoint.year, incomeAtBreakpoint];
    });
  return {
    salaryY0,
    incomeMilestones,
    growthAfterLastRaise: stream.growthAfterLastRaisePct,
    netKeepRate: stream.netKeepRatePct / 100,
    annualBonus: stream.annualBonusK * 1000,
    jobLossYear: stream.jobLossYear,
  };
}

/** A permanent job loss zeroes gross salary, bonus, and therefore income from that year on,
 *  regardless of any raise breakpoints scheduled after it. */
function streamIncomeAndGross(year: number, stream: IncomeStreamContext): { gross: number; income: number } {
  if (stream.jobLossYear !== undefined && year >= stream.jobLossYear) {
    return { gross: 0, income: 0 };
  }
  const gross = salaryAtYear(year, stream.salaryY0, stream.incomeMilestones, stream.growthAfterLastRaise);
  // Bonus is taxed/reduced the same way salary is (netKeepRate applies to both), then folded straight
  // into monthly net income alongside it. It's deliberately NOT added to `gross` - the breakdown
  // table's "salary, gross" row (see YearSnapshot.grossSalary) is specifically salary, and a bonus
  // line isn't broken out there separately; it still flows through freeCash via `income` either way.
  const income = (gross * stream.netKeepRate) / 12 + (stream.annualBonus * stream.netKeepRate) / 12;
  return { gross, income };
}

interface UnallocatedPool {
  brokerage: number;
  cash: number;
}

/** All free cash invests into brokerage; a dedicated reserve/emergency-fund target is just an
 *  `accumulate`-mode goal now (see goals.ts's "Emergency fund" catalog entry), not a base
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

/** A goal's Y0 starting balance: its one-time cash/brokerage allocation. Home equity (if claimed via
 *  equityAllocated) is deliberately NOT included here - unlike cash/brokerage, it isn't liquid money
 *  that starts "investing" today. It's injected once, at the goal's endYear, as its own realistically
 *  projected amount (see projectHomeEquity/advanceGoalBalances) instead of compounding at the market
 *  investment return for years like a brokerage account would. */
function goalStartingBalance(goal: RecurringGoal): number {
  return goal.cashAllocated + goal.brokerageAllocated;
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

/** Estimates a property goal's mortgage: down payment is the goal's actual projected balance at
 *  endYear (its monthly contributions/allocations, including any rolled-over home equity - see
 *  projectHomeEquity - all compounded/injected the same way the real model does it). Property goals
 *  have no separate "target amount" to aim for instead - "Total property price" already captures
 *  the number that matters. Shared by the live GoalCard preview and the real housing-cost-
 *  replacement computation below so the two can never disagree. */
export function estimateMortgage(goal: RecurringGoal, projectedBalance: number): MortgageEstimate {
  const purchasePrice = (goal.purchasePriceK ?? 0) * 1000;
  const loanAmount = Math.max(0, purchasePrice - projectedBalance);
  const monthlyPayment = monthlyMortgagePayment(loanAmount, goal.mortgageRatePct ?? 0, MORTGAGE_TERM_YEARS);
  return { purchasePrice, downPayment: projectedBalance, loanAmount, monthlyPayment };
}

/** Balance remaining on a fixed-payment loan after `numPayments` more payments - the standard
 *  amortization recurrence, run forward from a known current balance/rate/payment rather than
 *  needing to first solve for the loan's total remaining term. */
function remainingLoanBalance(currentBalance: number, annualRatePct: number, monthlyPayment: number, numPayments: number): number {
  if (currentBalance <= 0 || monthlyPayment <= 0) {
    return Math.max(0, currentBalance);
  }
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) {
    return Math.max(0, currentBalance - monthlyPayment * numPayments);
  }
  const growth = Math.pow(1 + monthlyRate, numPayments);
  return Math.max(0, currentBalance * growth - (monthlyPayment * (growth - 1)) / monthlyRate);
}

export interface HomeEquityProjection {
  year: number;
  homeValue: number;
  mortgageBalance: number;
  equity: number;
}

/** Projects what your CURRENT home's equity will be `year` years from now, instead of treating
 *  today's equity as a lump sum that "invests" and grows at the market investment return (unrealistic
 *  - a house isn't a brokerage account). Home value grows at the general inflation rate (a simple
 *  stand-in for appreciation, consistent with how inflation already drives other costs); the mortgage
 *  balance pays down via standard amortization at its own rate (currentMortgageRatePct - a separate,
 *  per-loan assumption, since your existing mortgage's rate isn't a future purchase's rate) against
 *  the required P&I payment, now computed from balance/rate/term (see the Mortgage tab) instead of a
 *  manually-entered figure. Deliberately excludes any voluntary extra principal (mortgageExtraPrincipalMo)
 *  - that only speeds up the Mortgage tab's own schedule/payoff date, not this roll-up projection. */
export function projectHomeEquity(base: BaseInputs, ownsHome: boolean, year: number): HomeEquityProjection {
  if (!ownsHome) {
    return { year, homeValue: 0, mortgageBalance: 0, equity: 0 };
  }
  const homeValue = base.homeValueK * 1000 * Math.pow(1 + base.inflationPct / 100, year);
  const monthlyPI = monthlyMortgagePayment(base.mortgageBalanceK * 1000, base.currentMortgageRatePct, base.mortgageTermYears);
  const mortgageBalance = remainingLoanBalance(base.mortgageBalanceK * 1000, base.currentMortgageRatePct, monthlyPI, year * 12);
  return { year, homeValue, mortgageBalance, equity: Math.max(0, homeValue - mortgageBalance) };
}

/** Mutates `balances` in place. Before startYear, a goal's seed balance still compounds (money
 *  invested early grows even before the goal starts actively contributing). After endYear, the
 *  balance freezes entirely - no more growth, not just no more contribution - the goal is considered
 *  reached/realized at that point, not still sitting invested. A goal that claimed home equity
 *  (equityAllocated) gets it injected exactly once, in its final active year (endYear) - realistically
 *  projected (see projectHomeEquity), not compounded at the investment return like cash/brokerage.
 *  `category: 'emergency'` goals (the Emergency fund) compound at `cashGrowthPct` instead of
 *  `investmentReturnPct` - emergency savings sit in cash/savings accounts, not the market, so they
 *  shouldn't ride the same (much higher) market-return assumption as every other accumulating goal. */
function advanceGoalBalances(
  year: number,
  goals: RecurringGoal[],
  balances: Record<string, number>,
  investmentReturnPct: number,
  cashGrowthPct: number,
  base: BaseInputs,
  ownsHome: boolean,
): void {
  for (const goal of goals) {
    if (goal.mode !== 'accumulate' || year > goal.endYear) {
      continue;
    }
    const previous = balances[goal.id] ?? 0;
    const contribution = isGoalActive(goal, year) ? goal.monthlyAmount * 12 : 0;
    const growthRate = goal.category === 'emergency' ? cashGrowthPct : investmentReturnPct;
    let balance = previous * (1 + growthRate / 100) + contribution;
    if (goal.equityAllocated && year === goal.endYear) {
      balance += projectHomeEquity(base, ownsHome, year).equity;
    }
    balances[goal.id] = balance;
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
  const cashGrowth = base.cashGrowthPct;
  const inflation = base.inflationPct;

  const nonHousingLiving = base.expensesMo - base.housingPaymentMo;
  // Owning: P&I is fixed forever, the rest (escrow) inflates. Renting: the whole payment inflates.
  // P&I is computed from the standard mortgage inputs (balance/rate/term - see the Mortgage tab)
  // instead of being a manually-entered slider. Mortgage insurance and any voluntary extra principal
  // are scoped to the Mortgage tab's own schedule/payoff date and deliberately don't feed into this
  // household cashflow figure.
  const fixedHousing = ownsHome ? monthlyMortgagePayment(base.mortgageBalanceK * 1000, base.currentMortgageRatePct, base.mortgageTermYears) : 0;
  const inflatingHousingBase = ownsHome ? base.housingPaymentMo - fixedHousing : base.housingPaymentMo;

  // Cash/brokerage allocated to a goal (see goals.ts's cashAllocated/brokerageAllocated) leaves the
  // shared pool and becomes that goal's starting balance instead.
  const cashAllocatedTotal = goals.reduce((sum, goal) => sum + goal.cashAllocated, 0);
  const brokerageAllocatedTotal = goals.reduce((sum, goal) => sum + goal.brokerageAllocated, 0);

  const pool: UnallocatedPool = {
    brokerage: base.brokerageTodayK * 1000 - brokerageAllocatedTotal,
    cash: base.cashTodayK * 1000 - cashAllocatedTotal,
  };

  const goalBalances: Record<string, number> = {};
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      goalBalances[goal.id] = goalStartingBalance(goal);
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

    advanceGoalBalances(year, goals, goalBalances, investmentReturn, cashGrowth, base, ownsHome);
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
