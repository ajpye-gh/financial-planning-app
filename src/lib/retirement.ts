export interface RetirementProjection {
  yearLabels: string[];
  balances: number[];
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
