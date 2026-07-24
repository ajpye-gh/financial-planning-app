import { estimateRetirementTax, type FilingStatus, type TaxEstimate } from './tax';
import type { Verdict } from './model';

export interface RetirementProjection {
  yearLabels: string[];
  balances: number[];
  /** Actual $ withdrawn each year - 0 before retirementYearIndex (accumulation, no withdrawals
   *  yet), the scheduled amount from retirementYearIndex onward while funds last, capped at
   *  whatever's actually left in the balance for the year it depletes, then 0 forever after
   *  (nothing left to withdraw). Exception: if retirementYearIndex is 0, the first withdrawal is at
   *  index 1 instead - index 0 always holds the untouched starting balance. */
  withdrawals: number[];
  /** Index into yearLabels/balances where retirement begins (== targetYear) - accumulation runs
   *  through the index before this one; this index and every one after it is a decumulation year
   *  (see the `withdrawals` doc above for the targetYear === 0 exception). */
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
 *  The one exception is targetYear === 0 (already retired as of today): Y0 always has to stay exactly
 *  the given starting balance with no growth or withdrawal applied yet, so the first withdrawal there
 *  still lands at Y1, same as it always has. */
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
  const firstDecumulationYear = Math.max(targetYear, 1);
  for (let year = firstDecumulationYear; year <= finalYear; year++) {
    const grown = balance * (1 + investmentReturnPct / 100);
    const actualWithdrawal = Math.min(scheduledWithdrawal, grown);
    balance = grown - actualWithdrawal;
    if (balance <= 0 && depletionYear === null) {
      balance = 0;
      depletionYear = year;
    }
    balances.push(Math.round(balance));
    withdrawals.push(Math.round(actualWithdrawal));
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
  tax: TaxEstimate;
  netAnnual: number;
  netMonthlyNominal: number;
  netMonthlyReal: number;
}

/** Combines both pots (plus Social Security) into one "total estimated income" figure, year by
 *  year across the whole projection - Roth withdrawals are tax-free, Traditional withdrawals and (a
 *  taxable share of) Social Security are not, so this is the one place that actually calls tax.ts.
 *  Uses each projection's actual (depletion-capped) withdrawals rather than re-deriving them, so
 *  income correctly drops once a pot runs dry instead of assuming the scheduled amount forever.
 *  Social Security is assumed to start the year you retire (index >= retirementYearIndex) and never
 *  depletes, unlike the two accounts. */
export function projectHouseholdRetirementIncome(
  rothProjection: RetirementProjection,
  traditionalProjection: RetirementProjection,
  ssMonthlyBenefitToday: number,
  filingStatus: FilingStatus,
  inflationPct: number,
): HouseholdRetirementIncome[] {
  const { retirementYearIndex } = rothProjection;
  return rothProjection.yearLabels.map((_, year) => {
    const inflationFactor = Math.pow(1 + inflationPct / 100, year);
    const rothWithdrawal = rothProjection.withdrawals[year] ?? 0;
    const traditionalWithdrawal = traditionalProjection.withdrawals[year] ?? 0;
    const ssGross = year >= retirementYearIndex ? ssMonthlyBenefitToday * 12 * inflationFactor : 0;

    const tax = estimateRetirementTax(traditionalWithdrawal, ssGross, filingStatus, inflationFactor);

    const netAnnual = rothWithdrawal + traditionalWithdrawal + ssGross - tax.tax;
    const netMonthlyNominal = netAnnual / 12;
    const netMonthlyReal = netMonthlyNominal / inflationFactor;

    return { year, rothWithdrawal, traditionalWithdrawal, ssGross, tax, netAnnual, netMonthlyNominal, netMonthlyReal };
  });
}

/** Same shape/purpose as model.ts's buildVerdict, reusing the same VerdictBanner component - a
 *  prominent, at-a-glance answer to "does this retirement plan actually work". Four states since
 *  there are now two independent pots: either could outlast the other, so "ran out" only really
 *  means something once *both* are gone - as long as either pot still has money, the household still
 *  has some income coming in. Speaks in ages (via currentAge), matching the rest of the retirement
 *  page rather than the projections' internal year-offset indices. */
export function buildRetirementVerdict(
  rothProjection: RetirementProjection,
  traditionalProjection: RetirementProjection,
  currentAge: number,
): Verdict {
  const rothDepletionYear = rothProjection.depletionYear;
  const traditionalDepletionYear = traditionalProjection.depletionYear;

  if (rothDepletionYear === null && traditionalDepletionYear === null) {
    return {
      tone: 'success',
      headline: 'Lasts the distance.',
      detail: `Both your Roth and Traditional savings are projected to last all the way to age ${MAX_PROJECTION_AGE}.`,
    };
  }

  if (rothDepletionYear !== null && traditionalDepletionYear !== null) {
    const lastAge = currentAge + Math.max(rothDepletionYear, traditionalDepletionYear);
    return {
      tone: 'danger',
      headline: `Both accounts run out by age ${lastAge}.`,
      detail: `Roth is projected to deplete at age ${currentAge + rothDepletionYear}, Traditional at age ${currentAge + traditionalDepletionYear} - by age ${lastAge} you'd have no more retirement savings income.`,
    };
  }

  if (rothDepletionYear !== null) {
    const depletionAge = currentAge + rothDepletionYear;
    const yearsIntoRetirement = rothDepletionYear - rothProjection.retirementYearIndex;
    return {
      tone: 'warning',
      headline: `Roth runs out at age ${depletionAge}.`,
      detail: `Your Roth savings are projected to be depleted ${yearsIntoRetirement} years into retirement (age ${depletionAge}), but Traditional savings continue.`,
    };
  }

  const depletionAge = currentAge + (traditionalDepletionYear as number);
  const yearsIntoRetirement = (traditionalDepletionYear as number) - traditionalProjection.retirementYearIndex;
  return {
    tone: 'warning',
    headline: `Traditional runs out at age ${depletionAge}.`,
    detail: `Your Traditional savings are projected to be depleted ${yearsIntoRetirement} years into retirement (age ${depletionAge}), but Roth savings continue.`,
  };
}
