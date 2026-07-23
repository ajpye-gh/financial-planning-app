import type { Verdict } from './model';

export interface RetirementProjection {
  yearLabels: string[];
  balances: number[];
  /** Index into yearLabels/balances where retirement begins (== targetYear) - the accumulation
   *  phase runs through this index; every index after it is a decumulation year. */
  retirementYearIndex: number;
  /** The first year balance hits $0 during decumulation, or null if it lasts the full projection
   *  window without running out. */
  depletionYear: number | null;
}

export interface RetirementIncomeEstimate {
  /** Monthly income the projected balance could sustainably support, in the dollars of the target
   *  year itself (nominal - not deflated). */
  monthlyIncomeNominal: number;
  /** The same income, deflated back to today's purchasing power - what it would actually feel like
   *  to spend, since a dollar in year 30 buys less than a dollar today. */
  monthlyIncomeReal: number;
}

/** Applies a fixed safe-withdrawal-rate rule (e.g. the common "4% rule") to a balance to estimate a
 *  sustainable annual/monthly income - the same initial-withdrawal figure projectRetirementBalance's
 *  decumulation phase below starts from, just converted to a monthly, point-in-time estimate rather
 *  than run forward year by year. */
export function estimateRetirementIncome(finalBalance: number, withdrawalRatePct: number, inflationPct: number, targetYear: number): RetirementIncomeEstimate {
  const monthlyIncomeNominal = (finalBalance * (withdrawalRatePct / 100)) / 12;
  const inflationFactor = Math.pow(1 + inflationPct / 100, targetYear);
  const monthlyIncomeReal = monthlyIncomeNominal / inflationFactor;
  return { monthlyIncomeNominal, monthlyIncomeReal };
}

/** How far past the target year to keep projecting the drawdown - long enough to give a real sense
 *  of whether the balance actually lasts, not just a snapshot at the retirement date itself. */
export const POST_RETIREMENT_YEARS = 25;

/** Projects the full retirement arc: accumulation (compound growth + a fixed monthly contribution,
 *  same formula as model.ts's advanceGoalBalances) through the target year, then decumulation for
 *  POST_RETIREMENT_YEARS more - the standard "4% rule" mechanics: the first year's withdrawal is
 *  `withdrawalRatePct` of the balance at retirement, and every year after that the withdrawal amount
 *  itself grows with inflation (to hold its purchasing power) regardless of how the portfolio
 *  performs, while the remaining balance keeps growing at the investment return net of that
 *  withdrawal. Balance floors at $0 - once depleted, it stays depleted. */
export function projectRetirementBalance(
  startingBalance: number,
  monthlyContribution: number,
  investmentReturnPct: number,
  targetYear: number,
  withdrawalRatePct: number,
  inflationPct: number,
): RetirementProjection {
  const balances = [Math.round(startingBalance)];
  const yearLabels = ['Y0'];
  let balance = startingBalance;

  for (let year = 1; year <= targetYear; year++) {
    balance = balance * (1 + investmentReturnPct / 100) + monthlyContribution * 12;
    balances.push(Math.round(balance));
    yearLabels.push(`Y${year}`);
  }

  let annualWithdrawal = balance * (withdrawalRatePct / 100);
  let depletionYear: number | null = null;
  const lastYear = targetYear + POST_RETIREMENT_YEARS;
  for (let year = targetYear + 1; year <= lastYear; year++) {
    balance = Math.max(0, balance * (1 + investmentReturnPct / 100) - annualWithdrawal);
    if (balance === 0 && depletionYear === null) {
      depletionYear = year;
    }
    balances.push(Math.round(balance));
    yearLabels.push(`Y${year}`);
    annualWithdrawal *= 1 + inflationPct / 100;
  }

  return { yearLabels, balances, retirementYearIndex: targetYear, depletionYear };
}

/** Same shape/purpose as model.ts's buildVerdict, reusing the same VerdictBanner component - a
 *  prominent, at-a-glance answer to "does this retirement plan actually work", not just another
 *  number buried in a metric card. */
export function buildRetirementVerdict(projection: RetirementProjection): Verdict {
  if (projection.depletionYear === null) {
    return {
      tone: 'success',
      headline: 'Lasts the distance.',
      detail: `Your savings are projected to last at least ${POST_RETIREMENT_YEARS} years into retirement.`,
    };
  }
  const yearsIntoRetirement = projection.depletionYear - projection.retirementYearIndex;
  return {
    tone: 'danger',
    headline: `Runs out in year ${projection.depletionYear}.`,
    detail: `Your savings are projected to be depleted ${yearsIntoRetirement} years into retirement.`,
  };
}
