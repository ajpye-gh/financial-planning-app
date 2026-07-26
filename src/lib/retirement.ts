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
 *  the first year with a withdrawal (and the first year retirement income tax applies) - matching
 *  Social Security, which already starts at retirementYearIndex in projectHouseholdRetirementIncome.
 *  This holds even when targetYear === 0 (already retired today): Y0 immediately reflects that
 *  first withdrawal rather than showing the raw input untouched for a year, so "the balance today"
 *  and "the balance at retirement" mean the same thing once you're already retired. */
export function projectRetirementBalance(
  startingBalance: number,
  monthlyContribution: number,
  investmentReturnPct: number,
  targetYear: number,
  finalYear: number,
  withdrawalRatePct: number,
  inflationPct: number,
): RetirementProjection {
  const balances = [Math.round(startingBalance)];
  const withdrawals = [0];
  const yearLabels = ['Y0'];
  let balance = startingBalance;

  for (let year = 1; year < targetYear; year++) {
    balance = balance * (1 + investmentReturnPct / 100) + monthlyContribution * 12;
    balances.push(Math.round(balance));
    withdrawals.push(0);
    yearLabels.push(`Y${year}`);
  }

  let scheduledWithdrawal = balance * (withdrawalRatePct / 100);
  let depletionYear: number | null = null;

  if (targetYear === 0) {
    const step = applyDecumulationStep(balance, investmentReturnPct, scheduledWithdrawal);
    balance = step.balance;
    if (step.depleted) {
      depletionYear = 0;
    }
    balances[0] = Math.round(balance);
    withdrawals[0] = Math.round(step.withdrawal);
    scheduledWithdrawal *= 1 + inflationPct / 100;
  }

  for (let year = Math.max(targetYear, 1); year <= finalYear; year++) {
    const step = applyDecumulationStep(balance, investmentReturnPct, scheduledWithdrawal);
    balance = step.balance;
    if (step.depleted && depletionYear === null) {
      depletionYear = year;
    }
    balances.push(Math.round(balance));
    withdrawals.push(Math.round(step.withdrawal));
    yearLabels.push(`Y${year}`);
    scheduledWithdrawal *= 1 + inflationPct / 100;
  }

  return { yearLabels, balances, withdrawals, retirementYearIndex: targetYear, depletionYear };
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
  ssMonthlyBenefitToday: number;
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
 *  runs dry instead of assuming the scheduled amount forever. Social Security is assumed to start
 *  the year you retire (index >= retirementYearIndex) and never depletes, unlike the three accounts;
 *  pension income starts at its own independent pensionStartAge instead. */
export function projectHouseholdRetirementIncome({
  rothProjection,
  traditionalProjection,
  afterTaxProjection,
  afterTaxGainPct,
  pensionMonthlyToday,
  pensionStartAge,
  ssMonthlyBenefitToday,
  currentAge,
  filingStatus,
  inflationPct,
}: HouseholdIncomeProjectionInputs): HouseholdRetirementIncome[] {
  const { retirementYearIndex } = rothProjection;
  const pensionStartYearOffset = Math.max(0, pensionStartAge - currentAge);
  return rothProjection.yearLabels.map((_, year) => {
    const inflationFactor = Math.pow(1 + inflationPct / 100, year);
    const rothWithdrawal = rothProjection.withdrawals[year] ?? 0;
    const traditionalWithdrawal = traditionalProjection.withdrawals[year] ?? 0;
    const afterTaxWithdrawal = afterTaxProjection.withdrawals[year] ?? 0;
    const ssGross = year >= retirementYearIndex ? ssMonthlyBenefitToday * 12 * inflationFactor : 0;
    const pensionGross = year >= pensionStartYearOffset ? pensionMonthlyToday * 12 * inflationFactor : 0;

    const tax = estimateRetirementTax({
      traditionalWithdrawalAnnual: traditionalWithdrawal,
      pensionAnnual: pensionGross,
      ssBenefitAnnual: ssGross,
      afterTaxWithdrawalAnnual: afterTaxWithdrawal,
      afterTaxGainPct,
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
