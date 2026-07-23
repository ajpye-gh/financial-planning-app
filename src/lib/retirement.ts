import { estimateRetirementTax, type FilingStatus, type TaxEstimate } from './tax';
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

export interface HouseholdRetirementIncome {
  rothAnnual: number;
  traditionalAnnualGross: number;
  ssAnnualGross: number;
  tax: TaxEstimate;
  netMonthlyNominal: number;
  netMonthlyReal: number;
}

/** Combines both pots (plus Social Security) into one "total estimated income" figure - Roth
 *  withdrawals are tax-free, Traditional withdrawals and (a taxable share of) Social Security are
 *  not, so this is the one place that actually calls tax.ts. A point-in-time estimate at the target
 *  year, same scope as everything else on this page - not a year-by-year simulation. */
export function estimateHouseholdRetirementIncome(
  rothBalance: number,
  rothWithdrawalRatePct: number,
  traditionalBalance: number,
  traditionalWithdrawalRatePct: number,
  ssMonthlyBenefitToday: number,
  filingStatus: FilingStatus,
  inflationPct: number,
  targetYear: number,
): HouseholdRetirementIncome {
  const inflationFactor = Math.pow(1 + inflationPct / 100, targetYear);
  const rothAnnual = rothBalance * (rothWithdrawalRatePct / 100);
  const traditionalAnnualGross = traditionalBalance * (traditionalWithdrawalRatePct / 100);
  const ssAnnualGross = ssMonthlyBenefitToday * 12 * inflationFactor;

  const tax = estimateRetirementTax(traditionalAnnualGross, ssAnnualGross, filingStatus, inflationFactor);

  const netAnnual = rothAnnual + traditionalAnnualGross + ssAnnualGross - tax.tax;
  const netMonthlyNominal = netAnnual / 12;
  const netMonthlyReal = netMonthlyNominal / inflationFactor;

  return { rothAnnual, traditionalAnnualGross, ssAnnualGross, tax, netMonthlyNominal, netMonthlyReal };
}

/** Same shape/purpose as model.ts's buildVerdict, reusing the same VerdictBanner component - a
 *  prominent, at-a-glance answer to "does this retirement plan actually work". Four states since
 *  there are now two independent pots: either could outlast the other, so "ran out" only really
 *  means something once *both* are gone - as long as either pot still has money, the household still
 *  has some income coming in. */
export function buildRetirementVerdict(rothProjection: RetirementProjection, traditionalProjection: RetirementProjection): Verdict {
  const rothDepletionYear = rothProjection.depletionYear;
  const traditionalDepletionYear = traditionalProjection.depletionYear;

  if (rothDepletionYear === null && traditionalDepletionYear === null) {
    return {
      tone: 'success',
      headline: 'Lasts the distance.',
      detail: `Both your Roth and Traditional savings are projected to last at least ${POST_RETIREMENT_YEARS} years into retirement.`,
    };
  }

  if (rothDepletionYear !== null && traditionalDepletionYear !== null) {
    const lastYear = Math.max(rothDepletionYear, traditionalDepletionYear);
    return {
      tone: 'danger',
      headline: `Both accounts run out by year ${lastYear}.`,
      detail: `Roth is projected to deplete in year ${rothDepletionYear}, Traditional in year ${traditionalDepletionYear} - by year ${lastYear} you'd have no more retirement savings income.`,
    };
  }

  if (rothDepletionYear !== null) {
    const yearsIntoRetirement = rothDepletionYear - rothProjection.retirementYearIndex;
    return {
      tone: 'warning',
      headline: `Roth runs out in year ${rothDepletionYear}.`,
      detail: `Your Roth savings are projected to be depleted ${yearsIntoRetirement} years into retirement, but Traditional savings continue.`,
    };
  }

  const yearsIntoRetirement = (traditionalDepletionYear as number) - traditionalProjection.retirementYearIndex;
  return {
    tone: 'warning',
    headline: `Traditional runs out in year ${traditionalDepletionYear}.`,
    detail: `Your Traditional savings are projected to be depleted ${yearsIntoRetirement} years into retirement, but Roth savings continue.`,
  };
}
