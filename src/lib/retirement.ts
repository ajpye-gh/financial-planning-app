export interface RetirementProjection {
  yearLabels: string[];
  balances: number[];
}

export interface RetirementIncomeEstimate {
  /** Monthly income the projected balance could sustainably support, in the dollars of the target
   *  year itself (nominal - not deflated). */
  monthlyIncomeNominal: number;
  /** The same income, deflated back to today's purchasing power - what it would actually feel like
   *  to spend, since a dollar in year 30 buys less than a dollar today. */
  monthlyIncomeReal: number;
}

/** Applies a fixed safe-withdrawal-rate rule (e.g. the common "4% rule") to a final balance to
 *  estimate a sustainable annual/monthly income - not a full drawdown simulation (sequence-of-
 *  returns risk, running the balance to zero over a fixed horizon, etc.), just the standard rule-of-
 *  thumb translation from "balance" to "income" used for a quick estimate. */
export function estimateRetirementIncome(finalBalance: number, withdrawalRatePct: number, inflationPct: number, targetYear: number): RetirementIncomeEstimate {
  const monthlyIncomeNominal = (finalBalance * (withdrawalRatePct / 100)) / 12;
  const inflationFactor = Math.pow(1 + inflationPct / 100, targetYear);
  const monthlyIncomeReal = monthlyIncomeNominal / inflationFactor;
  return { monthlyIncomeNominal, monthlyIncomeReal };
}

/** Same compound-growth formula as model.ts's advanceGoalBalances: balance grows at the investment
 *  return, plus a fixed annual contribution, one year at a time out to the target year. Kept as its
 *  own module rather than folded into model.ts since it's not part of the goals/cashflow engine -
 *  no ModelInputs or goals dependency. */
export function projectRetirementBalance(
  startingBalance: number,
  monthlyContribution: number,
  investmentReturnPct: number,
  targetYear: number,
): RetirementProjection {
  const balances = [Math.round(startingBalance)];
  const yearLabels = ['Y0'];
  let balance = startingBalance;
  for (let year = 1; year <= targetYear; year++) {
    balance = balance * (1 + investmentReturnPct / 100) + monthlyContribution * 12;
    balances.push(Math.round(balance));
    yearLabels.push(`Y${year}`);
  }
  return { yearLabels, balances };
}
