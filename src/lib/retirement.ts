import { estimateRetirementTax, type FilingStatus, type TaxEstimate } from './tax';
import type { Verdict } from './model';

export interface RetirementProjection {
  yearLabels: string[];
  balances: number[];
  /** Actual $ withdrawn each year - 0 before retirementYearIndex (accumulation, no withdrawals
   *  yet), the scheduled amount from retirementYearIndex onward while funds last, capped at
   *  whatever's actually left in the balance for the year it depletes, then 0 forever after
   *  (nothing left to withdraw). If retirementYearIndex is 0 (already retired today), that first
   *  withdrawal is taken immediately, right out of index 0. */
  withdrawals: number[];
  /** Actual withdrawal for that year as a percentage of the balance entering it (before that
   *  year's growth) - 0 during accumulation and whenever the entering balance was $0. Drifts away
   *  from the withdrawalRatePct input over time: the withdrawal amount itself grows with inflation
   *  every year after the first, while the balance follows investment performance instead, so this
   *  is what the withdrawal rate actually was that year, not the fixed input. */
  effectiveWithdrawalRatePct: number[];
  /** Index into yearLabels/balances where retirement begins (== targetYear) - accumulation runs
   *  through the index before this one; this index and every one after it is a decumulation year. */
  retirementYearIndex: number;
  /** The first year balance hits $0 during decumulation, or null if it lasts the full projection
   *  window without running out. */
  depletionYear: number | null;
}

/** Retirement projections (and the "Inspect age" slider's range) always run through this age -
 *  fixed rather than a set number of years past retirement, so someone retiring at 40 gets just as
 *  much drawdown runway to inspect as someone retiring at 65. Keep DEFAULT_BASE_RANGES's
 *  retirementInspectAge.max in Defaults.json in sync with this (a test asserts it). */
export const MAX_PROJECTION_AGE = 100;

/** Real earliest Social Security claiming age - the RETIREMENT_SOCIAL_SECURITY_START_AGE_FIELD
 *  slider's floor (see baseFields.tsx). Claiming this early permanently cuts the benefit - see
 *  socialSecurityAdjustmentFactor. */
export const SS_MIN_CLAIMING_AGE = 62;

/** Real "full retirement age" under current law (67, for anyone born 1960 or later) - the age a
 *  Social Security benefit estimate is normally quoted against, with no early-claim reduction or
 *  delayed-retirement-credit adjustment either way. Same "single point-in-time snapshot of current
 *  law" scope as the rest of this app (e.g. tax.ts's 2024 brackets) - doesn't model the lower FRA
 *  that applies to anyone born before 1960. */
export const SS_FULL_RETIREMENT_AGE = 67;

/** Real age Social Security delayed retirement credits stop accruing - the
 *  RETIREMENT_SOCIAL_SECURITY_START_AGE_FIELD slider's ceiling. Real law gives no further benefit
 *  increase for waiting past this age, so there's no reason to model claiming later. */
export const SS_MAX_CLAIMING_AGE = 70;

/** Clamps a chosen Social Security start age into the real legal claiming window
 *  [SS_MIN_CLAIMING_AGE, SS_MAX_CLAIMING_AGE] - shared by socialSecurityAdjustmentFactor and
 *  projectHouseholdRetirementIncome's own start-year math, so both agree on the same effective age
 *  even if a caller somehow passes one outside the slider's own enforced range. */
export function clampSocialSecurityStartAge(age: number): number {
  return Math.min(Math.max(age, SS_MIN_CLAIMING_AGE), SS_MAX_CLAIMING_AGE);
}

/** The real SSA early-claim reduction / delayed-retirement-credit formula, as a multiplier on the
 *  benefit estimate at SS_FULL_RETIREMENT_AGE (1.0 exactly at full retirement age). Claiming before
 *  it permanently reduces the benefit: 5/9 of 1% per month for the first 36 months early, then 5/12
 *  of 1% per month for any month earlier than that - the standard two-slope SSA formula, maxing out
 *  at a 30% cut at the earliest possible age (62, 60 months early under a 67 FRA). Claiming after it
 *  permanently increases the benefit via delayed retirement credits: 2/3 of 1% per month (8%/year),
 *  capped at SS_MAX_CLAIMING_AGE - a 24% boost at 70. See
 *  https://www.ssa.gov/benefits/retirement/planner/delayret.html. */
export function socialSecurityAdjustmentFactor(startAge: number): number {
  const clampedAge = clampSocialSecurityStartAge(startAge);
  const monthsFromFullRetirementAge = (clampedAge - SS_FULL_RETIREMENT_AGE) * 12;

  if (monthsFromFullRetirementAge >= 0) {
    return 1 + monthsFromFullRetirementAge * (2 / 3 / 100);
  }

  const earlyMonths = -monthsFromFullRetirementAge;
  const first36EarlyMonths = Math.min(earlyMonths, 36);
  const earlyMonthsBeyond36 = Math.max(earlyMonths - 36, 0);
  return 1 - first36EarlyMonths * (5 / 9 / 100) - earlyMonthsBeyond36 * (5 / 12 / 100);
}

/** Real IRS early-withdrawal age for Traditional 401(k)/IRA accounts - 59½ in law, rounded to a
 *  whole year here since every other age in this app is a whole number. Withdrawing before this
 *  incurs EARLY_WITHDRAWAL_PENALTY_PCT (see tax.ts) on top of ordinary income tax. */
export const TRADITIONAL_EARLY_WITHDRAWAL_AGE = 60;

/** Real age Required Minimum Distributions begin on Traditional (pre-tax) accounts under
 *  SECURE 2.0 - 73 for 2023-2032 (rising to 75 in 2033, not modeled here, same "point-in-time
 *  snapshot of current law" scope as tax.ts's 2024 brackets). Roth accounts have no RMDs (Roth
 *  401(k)s were exempted starting 2024, matching Roth IRAs), and after-tax accounts never had them. */
export const RMD_START_AGE = 73;

/** IRS Uniform Lifetime Table (effective 2022), age -> distribution period. RMD = account balance /
 *  divisor for the owner's age that year. Ages past 120 all use the same divisor per the real table. */
const RMD_DIVISORS: Record<number, number> = {
  73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2,
  81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2,
  91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8, 100: 6.4,
  101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
};
const RMD_TABLE_MAX_AGE = 120;

/** The Required Minimum Distribution for a Traditional account: $0 before RMD_START_AGE (or on a
 *  $0/negative balance), otherwise balance / that age's Uniform Lifetime Table divisor - ages past
 *  the table's top row all use its last divisor, matching the real table's own convention. */
export function requiredMinimumDistribution(balance: number, age: number): number {
  if (age < RMD_START_AGE || balance <= 0) {
    return 0;
  }
  const divisor = RMD_DIVISORS[Math.min(age, RMD_TABLE_MAX_AGE)];
  return balance / divisor;
}

interface AccumulationPhase {
  balances: number[];
  yearLabels: string[];
  /** The balance carried into targetYear itself, before that year's own growth/withdrawal - i.e.
   *  exactly what projectRetirementBalance applies its withdrawal rate against. Equal to
   *  startingBalance, unmodified, when targetYear is 0 (no accumulation years to run). */
  endingBalance: number;
}

/** The accumulation half of projectRetirementBalance's arc (compound growth + a fixed monthly
 *  contribution, Y0 through targetYear - 1), factored out so projectedBalanceAtRetirement below can
 *  reuse the exact same math without duplicating it - see that function's own comment for why a
 *  caller would want the ending balance in isolation. */
function accumulatePhase(startingBalance: number, monthlyContribution: number, investmentReturnPct: number, targetYear: number): AccumulationPhase {
  const balances = [Math.round(startingBalance)];
  const yearLabels = ['Y0'];
  let balance = startingBalance;

  for (let year = 1; year < targetYear; year++) {
    balance = balance * (1 + investmentReturnPct / 100) + monthlyContribution * 12;
    balances.push(Math.round(balance));
    yearLabels.push(`Y${year}`);
  }

  return { balances, yearLabels, endingBalance: balance };
}

/** The projected balance carried into targetYear itself, before that year's own growth/withdrawal -
 *  i.e. exactly the figure projectRetirementBalance's withdrawalRatePct is a percentage of. Exposed
 *  so a caller (see RetirementPage.tsx) can convert a dollar withdrawal target into the equivalent
 *  rate - `(monthlyDollar * 12) / projectedBalanceAtRetirement(...) * 100` - and pass that rate
 *  through projectRetirementBalance unchanged, rather than projectRetirementBalance needing to know
 *  about dollar targets at all. Rate-independent (depends only on the accumulation-phase inputs -
 *  starting balance, contribution, return, target year - never on the withdrawal rate itself), so
 *  there's no circularity in deriving a rate from it and feeding that rate back into the same
 *  projection. */
export function projectedBalanceAtRetirement(
  startingBalance: number,
  monthlyContribution: number,
  investmentReturnPct: number,
  targetYear: number,
): number {
  return accumulatePhase(startingBalance, monthlyContribution, investmentReturnPct, targetYear).endingBalance;
}

interface DecumulationStep {
  balance: number;
  withdrawal: number;
  depleted: boolean;
}

/** One year of decumulation: grow the balance at the investment return, then take the smaller of
 *  the scheduled withdrawal or whatever's actually there (so you can't withdraw more than exists).
 *  Shared by the immediate-retirement (targetYear === 0) case and the main decumulation loop below,
 *  so both apply the exact same "4% rule" math. */
function applyDecumulationStep(balance: number, investmentReturnPct: number, scheduledWithdrawal: number): DecumulationStep {
  const grown = balance * (1 + investmentReturnPct / 100);
  const withdrawal = Math.min(scheduledWithdrawal, grown);
  const remaining = grown - withdrawal;
  return { balance: Math.max(remaining, 0), withdrawal, depleted: remaining <= 0 };
}

/** Projects the full retirement arc: accumulation (compound growth + a fixed monthly contribution,
 *  same formula as model.ts's advanceGoalBalances) through targetYear - 1, then decumulation
 *  starting at targetYear itself through finalYear (years from today - the caller works out how far
 *  that is, RetirementPage always uses MAX_PROJECTION_AGE - currentAge) - the standard "4% rule"
 *  mechanics: the first year's withdrawal is `withdrawalRatePct` of the balance carried in from the
 *  accumulation phase, and every year after that the withdrawal amount itself grows with inflation
 *  (to hold its purchasing power) regardless of how the portfolio performs, while the remaining
 *  balance keeps growing at the investment return net of that withdrawal. Balance floors at $0 -
 *  once depleted, it stays depleted; the actual (capped) amount withdrawn each year is tracked
 *  separately (see `withdrawals`) since it can't exceed what's left. If finalYear < targetYear
 *  there's no decumulation phase to project - falls out naturally from the loop bounds below, no
 *  special-casing needed.
 *
 *  targetYear - 1 is the last year with a new contribution; targetYear (retirement year itself) is
 *  the first year with a withdrawal (and the first year retirement income tax applies). This holds
 *  even when targetYear === 0 (already retired today): Y0 immediately reflects that
 *  first withdrawal rather than showing the raw input untouched for a year, so "the balance today"
 *  and "the balance at retirement" mean the same thing once you're already retired.
 *
 *  rmd, when passed (Traditional pots only - see RetirementPage.tsx), forces each decumulation
 *  year's actual withdrawal up to at least that year's Required Minimum Distribution once age
 *  reaches RMD_START_AGE - same as real law: RMDs are a floor on top of whatever you'd otherwise
 *  withdraw, not a replacement for a higher voluntary withdrawal.
 *
 *  ssBridge, when passed (Traditional pots only, and only when retiring before Social Security
 *  starts - see RetirementPage.tsx's ssWithdrawalBridgeEnabled gating), models the opt-in "Social
 *  Security bridge" strategy: from ssBridge.startYearOffset onward, the scheduled withdrawal is cut
 *  back by that year's (inflated) Social Security benefit, floored at $0 - the idea being Social
 *  Security now covers the difference in income, so the account doesn't need to keep supplying the
 *  full amount. Applied before the RMD floor, since RMDs are a legal requirement regardless of
 *  which voluntary strategy is in play. */
export function projectRetirementBalance(
  startingBalance: number,
  monthlyContribution: number,
  investmentReturnPct: number,
  targetYear: number,
  finalYear: number,
  withdrawalRatePct: number,
  inflationPct: number,
  rmd?: { currentAge: number },
  ssBridge?: { startYearOffset: number; annualBenefitToday: number },
): RetirementProjection {
  const accumulation = accumulatePhase(startingBalance, monthlyContribution, investmentReturnPct, targetYear);
  const balances = accumulation.balances;
  const withdrawals = balances.map(() => 0);
  const effectiveWithdrawalRatePct = balances.map(() => 0);
  const yearLabels = accumulation.yearLabels;
  let balance = accumulation.endingBalance;

  let scheduledWithdrawal = balance * (withdrawalRatePct / 100);
  let depletionYear: number | null = null;

  const effectiveWithdrawal = (year: number) => {
    let scheduled = scheduledWithdrawal;
    if (ssBridge && year >= ssBridge.startYearOffset) {
      const ssInflationFactor = Math.pow(1 + inflationPct / 100, year);
      scheduled = Math.max(0, scheduled - ssBridge.annualBenefitToday * ssInflationFactor);
    }
    if (!rmd) {
      return scheduled;
    }
    const rmdAmount = requiredMinimumDistribution(balance, rmd.currentAge + year);
    return Math.max(scheduled, rmdAmount);
  };

  if (targetYear === 0) {
    const balanceEnteringYear = balance;
    const step = applyDecumulationStep(balance, investmentReturnPct, effectiveWithdrawal(0));
    balance = step.balance;
    if (step.depleted) {
      depletionYear = 0;
    }
    balances[0] = Math.round(balance);
    withdrawals[0] = Math.round(step.withdrawal);
    effectiveWithdrawalRatePct[0] = balanceEnteringYear > 0 ? (step.withdrawal / balanceEnteringYear) * 100 : 0;
    scheduledWithdrawal *= 1 + inflationPct / 100;
  }

  for (let year = Math.max(targetYear, 1); year <= finalYear; year++) {
    const balanceEnteringYear = balance;
    const step = applyDecumulationStep(balance, investmentReturnPct, effectiveWithdrawal(year));
    balance = step.balance;
    if (step.depleted && depletionYear === null) {
      depletionYear = year;
    }
    balances.push(Math.round(balance));
    withdrawals.push(Math.round(step.withdrawal));
    effectiveWithdrawalRatePct.push(balanceEnteringYear > 0 ? (step.withdrawal / balanceEnteringYear) * 100 : 0);
    yearLabels.push(`Y${year}`);
    scheduledWithdrawal *= 1 + inflationPct / 100;
  }

  return { yearLabels, balances, withdrawals, effectiveWithdrawalRatePct, retirementYearIndex: targetYear, depletionYear };
}

export interface HouseholdRetirementIncome {
  year: number;
  rothWithdrawal: number;
  traditionalWithdrawal: number;
  ssGross: number;
  /** Pension, annuity, or other fully-taxable ordinary income not tied to any of the three
   *  accounts - starts at pensionStartAge regardless of retirementYearIndex (real pensions aren't
   *  necessarily gated on "have you retired"), grows with inflation like Social Security, and never
   *  depletes. */
  pensionGross: number;
  /** Withdrawal from the after-tax (taxable brokerage) account - only the taxable-gain slice of
   *  this is actually taxed, see tax.ts's afterTaxGainPct. */
  afterTaxWithdrawal: number;
  tax: TaxEstimate;
  netAnnual: number;
  netMonthlyNominal: number;
  netMonthlyReal: number;
}

export interface HouseholdIncomeProjectionInputs {
  rothProjection: RetirementProjection;
  traditionalProjection: RetirementProjection;
  afterTaxProjection: RetirementProjection;
  /** Share of each after-tax withdrawal that's taxable gain rather than a tax-free return of cost
   *  basis - see tax.ts's RetirementTaxInputs.afterTaxGainPct. */
  afterTaxGainPct: number;
  pensionMonthlyToday: number;
  pensionStartAge: number;
  /** Estimated monthly benefit at SS_FULL_RETIREMENT_AGE (what SSA's own statements quote) - the
   *  actual gross benefit used is this, permanently scaled up or down by socialSecurityAdjustmentFactor
   *  for however early/late ssStartAge is relative to that. */
  ssMonthlyBenefitToday: number;
  /** Age Social Security claiming begins - independent of retirementYearIndex, same as
   *  pensionStartAge (real Social Security isn't gated on "have you stopped withdrawing yet"
   *  either). Clamped into [SS_MIN_CLAIMING_AGE, SS_MAX_CLAIMING_AGE] before use - the
   *  RETIREMENT_SOCIAL_SECURITY_START_AGE_FIELD slider already enforces that range, this is just a
   *  defensive backstop. */
  ssStartAge: number;
  currentAge: number;
  filingStatus: FilingStatus;
  inflationPct: number;
}

/** Combines all three pots (plus Social Security and pension income) into one "total estimated
 *  income" figure, year by year across the whole projection - Roth withdrawals are tax-free,
 *  Traditional withdrawals and pension income are fully ordinary, the after-tax withdrawal's gain
 *  slice is taxed at the flat LTCG rate, and (a taxable share of) Social Security is ordinary too -
 *  so this is the one place that actually calls tax.ts. Uses each projection's actual
 *  (depletion-capped) withdrawals rather than re-deriving them, so income correctly drops once a pot
 *  runs dry instead of assuming the scheduled amount forever. Social Security starts at the
 *  user-chosen ssStartAge - independent of retirement, same as pensionStartAge - and never depletes,
 *  unlike the three accounts; its gross amount is ssMonthlyBenefitToday scaled by
 *  socialSecurityAdjustmentFactor(ssStartAge), for the real early-claim reduction / delayed-credit
 *  effect. Traditional withdrawals taken before TRADITIONAL_EARLY_WITHDRAWAL_AGE flag the real 10%
 *  early-withdrawal penalty (see tax.ts) - RMDs themselves are already baked into the Traditional
 *  projection's own withdrawals (see projectRetirementBalance's rmd option), not handled here. */
export function projectHouseholdRetirementIncome({
  rothProjection,
  traditionalProjection,
  afterTaxProjection,
  afterTaxGainPct,
  pensionMonthlyToday,
  pensionStartAge,
  ssMonthlyBenefitToday,
  ssStartAge,
  currentAge,
  filingStatus,
  inflationPct,
}: HouseholdIncomeProjectionInputs): HouseholdRetirementIncome[] {
  const pensionStartYearOffset = Math.max(0, pensionStartAge - currentAge);
  const ssStartYearOffset = Math.max(0, clampSocialSecurityStartAge(ssStartAge) - currentAge);
  const ssAdjustedMonthlyBenefitToday = ssMonthlyBenefitToday * socialSecurityAdjustmentFactor(ssStartAge);
  return rothProjection.yearLabels.map((_, year) => {
    const inflationFactor = Math.pow(1 + inflationPct / 100, year);
    const rothWithdrawal = rothProjection.withdrawals[year] ?? 0;
    const traditionalWithdrawal = traditionalProjection.withdrawals[year] ?? 0;
    const afterTaxWithdrawal = afterTaxProjection.withdrawals[year] ?? 0;
    const ssGross = year >= ssStartYearOffset ? ssAdjustedMonthlyBenefitToday * 12 * inflationFactor : 0;
    const pensionGross = year >= pensionStartYearOffset ? pensionMonthlyToday * 12 * inflationFactor : 0;
    const isEarlyTraditionalWithdrawal = traditionalWithdrawal > 0 && currentAge + year < TRADITIONAL_EARLY_WITHDRAWAL_AGE;

    const tax = estimateRetirementTax({
      traditionalWithdrawalAnnual: traditionalWithdrawal,
      pensionAnnual: pensionGross,
      ssBenefitAnnual: ssGross,
      afterTaxWithdrawalAnnual: afterTaxWithdrawal,
      afterTaxGainPct,
      isEarlyTraditionalWithdrawal,
      filingStatus,
      inflationFactor,
    });

    const netAnnual = rothWithdrawal + traditionalWithdrawal + ssGross + pensionGross + afterTaxWithdrawal - tax.tax;
    const netMonthlyNominal = netAnnual / 12;
    const netMonthlyReal = netMonthlyNominal / inflationFactor;

    return {
      year,
      rothWithdrawal,
      traditionalWithdrawal,
      ssGross,
      pensionGross,
      afterTaxWithdrawal,
      tax,
      netAnnual,
      netMonthlyNominal,
      netMonthlyReal,
    };
  });
}

export interface NamedRetirementPot {
  name: string;
  projection: RetirementProjection;
}

/** Same shape/purpose as model.ts's buildVerdict, reusing the same VerdictBanner component - a
 *  prominent, at-a-glance answer to "does this retirement plan actually work". Takes any number of
 *  independent pots (Roth/Traditional/after-tax today) rather than hard-coding two, since "ran out"
 *  only really means something once *every* pot is gone - as long as one pot still has money, the
 *  household still has some income coming in. Speaks in ages (via currentAge), matching the rest of
 *  the retirement page rather than the projections' internal year-offset indices. */
export function buildRetirementVerdict(pots: NamedRetirementPot[], currentAge: number): Verdict {
  const depleted = pots.filter((pot) => pot.projection.depletionYear !== null);
  const surviving = pots.filter((pot) => pot.projection.depletionYear === null);

  if (depleted.length === 0) {
    return {
      tone: 'success',
      headline: 'Lasts the distance.',
      detail: `All of your retirement savings are projected to last all the way to age ${MAX_PROJECTION_AGE}.`,
    };
  }

  const depletionAge = (pot: NamedRetirementPot) => currentAge + (pot.projection.depletionYear as number);
  const namesOf = (list: NamedRetirementPot[]) => list.map((pot) => pot.name).join(' and ');

  if (surviving.length === 0) {
    const lastAge = Math.max(...depleted.map(depletionAge));
    const perPot = depleted.map((pot) => `${pot.name} at age ${depletionAge(pot)}`).join(', ');
    return {
      tone: 'danger',
      headline: `All accounts run out by age ${lastAge}.`,
      detail: `${perPot} - by age ${lastAge} you'd have no more retirement savings income.`,
    };
  }

  const verb = depleted.length === 1 ? 'runs' : 'run';
  const oldestDepletionAge = Math.max(...depleted.map(depletionAge));
  return {
    tone: 'warning',
    headline: `${namesOf(depleted)} ${verb} out by age ${oldestDepletionAge}.`,
    detail: `${namesOf(depleted)} ${depleted.length === 1 ? 'is' : 'are'} projected to run dry, but ${namesOf(surviving)} ${surviving.length === 1 ? 'continues' : 'continue'}.`,
  };
}

/** A clear, explicit callout for whenever the projection includes a year with the real 10% early-
 *  withdrawal penalty (Traditional withdrawals before TRADITIONAL_EARLY_WITHDRAWAL_AGE) - this is
 *  extra money leaving the household that isn't obvious from the balance/withdrawal numbers alone,
 *  so it gets its own banner (see RetirementPage.tsx) rather than being buried in the tax breakdown
 *  table. Returns null when no such year exists, so the caller can skip rendering it entirely. */
export function buildEarlyWithdrawalWarning(incomeSeries: HouseholdRetirementIncome[], currentAge: number): Verdict | null {
  const penalizedYears = incomeSeries.filter((entry) => entry.tax.earlyWithdrawalPenalty > 0).map((entry) => entry.year);
  if (penalizedYears.length === 0) {
    return null;
  }

  const firstAge = currentAge + Math.min(...penalizedYears);
  const lastAge = currentAge + Math.max(...penalizedYears);
  const ageRange = firstAge === lastAge ? `age ${firstAge}` : `ages ${firstAge}–${lastAge}`;

  return {
    tone: 'warning',
    headline: `10% early-withdrawal penalty applies at ${ageRange}.`,
    detail: `Traditional withdrawals taken before age ${TRADITIONAL_EARLY_WITHDRAWAL_AGE} (the real IRS early-withdrawal age, rounded from 59½) incur an extra 10% penalty on top of ordinary income tax - already included in the tax totals below.`,
  };
}
