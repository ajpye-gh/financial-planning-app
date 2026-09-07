import { monthlyMortgagePayment } from './model';

/** The current/existing-home mortgage tab's inputs - distinct from the future-property-goal
 *  estimate in model.ts (estimateMortgage/MORTGAGE_TERM_YEARS), which is a separate code path for a
 *  purchase that hasn't happened yet. This is about the loan the user is actually paying down today. */
export interface MortgageScheduleInputs {
  /** Today's remaining principal - BaseInputs.mortgageBalanceK * 1000. */
  loanAmount: number;
  annualRatePct: number;
  termYears: number;
  /** Today's home value - BaseInputs.homeValueK * 1000. Combined with `appreciationPct`, projects
   *  home value forward the same way model.ts's projectHomeEquity does, purely to evaluate the 20%
   *  equity threshold below - this module never feeds a value back into that projection. */
  homeValue: number;
  /** Same assumption model.ts's projectHomeEquity uses for home appreciation - see its comment for
   *  why inflation is the stand-in rate. */
  appreciationPct: number;
  /** Monthly PMI/MIP in today's dollars. Dropped once projected equity crosses 20% - see
   *  buildAmortizationSchedule. */
  monthlyInsurance: number;
  /** Optional extra principal applied every month on top of the required P&I payment - shortens the
   *  loan. Defaults to 0 (no extra payment). */
  extraMonthlyPrincipal?: number;
}

export interface AmortizationYearPoint {
  /** 0 = today (opening balance only, no payments yet this year) - same Y0-baseline convention
   *  chartSeries/model.ts use elsewhere in this app. */
  year: number;
  openingBalance: number;
  closingBalance: number;
  principalPaid: number;
  interestPaid: number;
  insurancePaid: number;
}

export interface AmortizationSchedule {
  /** One point per year, 0 through however many years it takes to pay off (capped at `termYears` -
   *  a loan can finish early with extra payments, never late). */
  points: AmortizationYearPoint[];
  /** Total number of months from today until the balance reaches $0. */
  payoffMonths: number;
  /** The fixed, required principal+interest payment - level for the life of the loan, excludes
   *  insurance and any extra principal. */
  monthlyPaymentPI: number;
}

const EPSILON = 0.005;

/** Runs a standard monthly amortization forward from today's balance, applying any extra principal
 *  each month and dropping mortgage insurance once projected home equity crosses 20% (that and every
 *  subsequent month) - then buckets the month-by-month detail into one point per year, matching this
 *  app's existing chart granularity (see CashflowChart/RetirementChart, both indexed by year). The
 *  underlying simulation is monthly, same as a real mortgage compounds and same as
 *  monthlyMortgagePayment/remainingLoanBalance in model.ts already assume. */
export function buildAmortizationSchedule(inputs: MortgageScheduleInputs): AmortizationSchedule {
  const { loanAmount, annualRatePct, termYears, homeValue, appreciationPct, monthlyInsurance, extraMonthlyPrincipal = 0 } = inputs;
  const monthlyPaymentPI = monthlyMortgagePayment(loanAmount, annualRatePct, termYears);

  const points: AmortizationYearPoint[] = [
    { year: 0, openingBalance: loanAmount, closingBalance: loanAmount, principalPaid: 0, interestPaid: 0, insurancePaid: 0 },
  ];

  if (loanAmount <= 0 || monthlyPaymentPI <= 0) {
    return { points, payoffMonths: 0, monthlyPaymentPI: 0 };
  }

  const monthlyRate = annualRatePct / 100 / 12;
  const maxMonths = termYears * 12;

  let balance = loanAmount;
  let month = 0;
  let insuranceActive = monthlyInsurance > 0;
  let yearOpening = balance;
  let yearPrincipal = 0;
  let yearInterest = 0;
  let yearInsurance = 0;

  while (balance > EPSILON && month < maxMonths) {
    month += 1;
    const interest = balance * monthlyRate;
    let principal = monthlyPaymentPI - interest + extraMonthlyPrincipal;
    if (principal > balance) {
      principal = balance;
    }
    balance -= principal;

    // Equity as of this month's paydown - same appreciation assumption as model.ts's
    // projectHomeEquity, evaluated at this month's fractional year offset.
    const projectedHomeValue = homeValue * Math.pow(1 + appreciationPct / 100, month / 12);
    const equityPct = projectedHomeValue > 0 ? ((projectedHomeValue - balance) / projectedHomeValue) * 100 : 0;
    if (insuranceActive && equityPct >= 20) {
      insuranceActive = false;
    }
    const insurance = insuranceActive ? monthlyInsurance : 0;

    yearPrincipal += principal;
    yearInterest += interest;
    yearInsurance += insurance;

    if (month % 12 === 0 || balance <= EPSILON) {
      points.push({
        year: points.length,
        openingBalance: yearOpening,
        closingBalance: Math.max(0, balance),
        principalPaid: yearPrincipal,
        interestPaid: yearInterest,
        insurancePaid: yearInsurance,
      });
      yearOpening = balance;
      yearPrincipal = 0;
      yearInterest = 0;
      yearInsurance = 0;
    }
  }

  return { points, payoffMonths: month, monthlyPaymentPI };
}

/** Today's actual monthly outlay: the required P&I payment, plus insurance if today's projected
 *  equity is still under 20%, plus any voluntary extra principal. Cheaper than running the full
 *  schedule when only this month's figure is needed (e.g. the primary page's sidebar summary). */
export function currentMonthlyPayment(inputs: MortgageScheduleInputs): number {
  const monthlyPaymentPI = monthlyMortgagePayment(inputs.loanAmount, inputs.annualRatePct, inputs.termYears);
  if (monthlyPaymentPI <= 0) {
    return 0;
  }
  const equityPct = inputs.homeValue > 0 ? ((inputs.homeValue - inputs.loanAmount) / inputs.homeValue) * 100 : 0;
  const insurance = equityPct < 20 ? inputs.monthlyInsurance : 0;
  return monthlyPaymentPI + insurance + (inputs.extraMonthlyPrincipal ?? 0);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Turns a payoff month-count into a human calendar date, e.g. "Jan 2054" - `from` defaults to today
 *  but is overridable so this stays deterministic in tests. */
export function formatPayoffDate(monthsFromNow: number, from: Date = new Date()): string {
  if (monthsFromNow <= 0) {
    return 'Paid off';
  }
  const total = from.getMonth() + monthsFromNow;
  const year = from.getFullYear() + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}
