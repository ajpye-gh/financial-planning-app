export type FilingStatus = 'single' | 'marriedJoint';

interface TaxBracket {
  rate: number;
  /** Upper edge of this bracket's income range, or null for the top (unbounded) bracket. */
  upTo: number | null;
}

/** 2024 federal income tax brackets. Real brackets are inflation-indexed annually by the IRS, so
 *  these get scaled forward by the caller's inflationFactor for any year past today - see
 *  estimateFederalTax. Ordinary income only (ignores capital gains rates, AMT, NIIT, etc.). */
const FEDERAL_BRACKETS_2024: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { rate: 0.1, upTo: 11600 },
    { rate: 0.12, upTo: 47150 },
    { rate: 0.22, upTo: 100525 },
    { rate: 0.24, upTo: 191950 },
    { rate: 0.32, upTo: 243725 },
    { rate: 0.35, upTo: 609350 },
    { rate: 0.37, upTo: null },
  ],
  marriedJoint: [
    { rate: 0.1, upTo: 23200 },
    { rate: 0.12, upTo: 94300 },
    { rate: 0.22, upTo: 201050 },
    { rate: 0.24, upTo: 383900 },
    { rate: 0.32, upTo: 487450 },
    { rate: 0.35, upTo: 731200 },
    { rate: 0.37, upTo: null },
  ],
};

/** Also inflation-indexed annually in reality, same as the brackets above. */
const STANDARD_DEDUCTION_2024: Record<FilingStatus, number> = {
  single: 14600,
  marriedJoint: 29200,
};

/** Combined-income ("provisional income") thresholds that determine how much Social Security is
 *  taxable. Fixed in nominal dollars by law since 1983/1993 - deliberately, unlike the brackets and
 *  deduction above, NEVER inflation-adjusted (a well-known "stealth" tax expansion: more retirees'
 *  benefits become taxable every year purely from nominal income growth). So these do not scale with
 *  inflationFactor anywhere in this module. */
const SS_PROVISIONAL_INCOME_THRESHOLDS: Record<FilingStatus, { lower: number; upper: number }> = {
  single: { lower: 25000, upper: 34000 },
  marriedJoint: { lower: 32000, upper: 44000 },
};

/** The standard IRS worksheet approximation for how much of a Social Security benefit is taxable:
 *  0% below the lower provisional-income threshold, phasing in at 50% between the thresholds, then
 *  85% above the upper threshold (capped at 85% of the benefit itself either way). */
export function taxableSocialSecurity(ssBenefitAnnual: number, otherIncome: number, filingStatus: FilingStatus): number {
  const provisionalIncome = otherIncome + 0.5 * ssBenefitAnnual;
  const { lower, upper } = SS_PROVISIONAL_INCOME_THRESHOLDS[filingStatus];

  if (provisionalIncome <= lower) {
    return 0;
  }
  if (provisionalIncome <= upper) {
    return Math.min(0.5 * (provisionalIncome - lower), 0.5 * ssBenefitAnnual);
  }
  const taxableBelowUpper = Math.min(0.5 * (upper - lower), 0.5 * ssBenefitAnnual);
  return Math.min(0.85 * (provisionalIncome - upper) + taxableBelowUpper, 0.85 * ssBenefitAnnual);
}

/** Walks the (inflation-scaled) bracket table, taxing only the slice of income that falls in each
 *  bracket - the standard progressive-tax calculation. */
export function estimateFederalTax(taxableIncome: number, filingStatus: FilingStatus, inflationFactor: number): number {
  if (taxableIncome <= 0) {
    return 0;
  }
  const brackets = FEDERAL_BRACKETS_2024[filingStatus];
  let tax = 0;
  let previousCap = 0;
  for (const bracket of brackets) {
    const cap = bracket.upTo === null ? Infinity : bracket.upTo * inflationFactor;
    if (taxableIncome <= previousCap) {
      break;
    }
    tax += (Math.min(taxableIncome, cap) - previousCap) * bracket.rate;
    previousCap = cap;
  }
  return tax;
}

export interface TaxEstimate {
  taxableSS: number;
  standardDeduction: number;
  /** Traditional withdrawal + pension + taxable Social Security, minus the standard deduction,
   *  floored at 0. */
  taxableOrdinaryIncome: number;
  tax: number;
  /** tax / (traditional withdrawal + pension + gross Social Security) - 0 if there's no income to
   *  divide by. */
  effectiveRatePct: number;
}

export interface RetirementTaxInputs {
  traditionalWithdrawalAnnual: number;
  /** Pension, annuity, or other fully-taxable ordinary income - combined with the Traditional
   *  withdrawal for both bracket purposes and Social Security's provisional-income test. */
  pensionAnnual: number;
  ssBenefitAnnual: number;
  filingStatus: FilingStatus;
  inflationFactor: number;
}

/** Federal tax on a retiree's taxable income sources: Traditional withdrawals and pension income
 *  (both fully ordinary income) plus whatever share of Social Security is taxable. Not a full
 *  simulation - a point-in-time estimate for a single year's income, same scope as the rest of the
 *  retirement page's metrics. */
export function estimateRetirementTax({
  traditionalWithdrawalAnnual,
  pensionAnnual,
  ssBenefitAnnual,
  filingStatus,
  inflationFactor,
}: RetirementTaxInputs): TaxEstimate {
  const ordinaryIncomeBeforeSS = traditionalWithdrawalAnnual + pensionAnnual;
  const taxableSS = taxableSocialSecurity(ssBenefitAnnual, ordinaryIncomeBeforeSS, filingStatus);
  const standardDeduction = STANDARD_DEDUCTION_2024[filingStatus] * inflationFactor;
  const taxableOrdinaryIncome = Math.max(0, ordinaryIncomeBeforeSS + taxableSS - standardDeduction);
  const tax = estimateFederalTax(taxableOrdinaryIncome, filingStatus, inflationFactor);
  const grossIncome = ordinaryIncomeBeforeSS + ssBenefitAnnual;
  const effectiveRatePct = grossIncome > 0 ? (tax / grossIncome) * 100 : 0;
  return { taxableSS, standardDeduction, taxableOrdinaryIncome, tax, effectiveRatePct };
}
