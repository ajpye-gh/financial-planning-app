import { Row } from '../results/BreakdownTable';
import { formatCurrency, formatSliderValue } from '../../lib/format';
import type { HouseholdRetirementIncome } from '../../lib/retirement';

interface RetirementBreakdownTableProps {
  age: number;
  rothBalance: number;
  traditionalBalance: number;
  afterTaxBalance: number;
  /** This year's actual withdrawal as a % of the balance entering it, one per pot - see
   *  RetirementProjection.effectiveWithdrawalRatePct. Shown alongside each withdrawal figure since
   *  it drifts away from the "Initial withdrawal rate" input over time (the withdrawal itself grows
   *  with inflation every year after the first, while the balance follows investment performance
   *  instead), so this is what the rate actually was this year, not the fixed input. */
  rothWithdrawalRatePct: number;
  traditionalWithdrawalRatePct: number;
  afterTaxWithdrawalRatePct: number;
  /** Whether Social Security is included in this plan at all (see SocialSecurityToggle.tsx) - when
   *  false, its income is already $0 in `income`, and this additionally drops its row(s) from the
   *  table entirely rather than showing a $0 line for a source that was deliberately excluded. */
  ssEnabled: boolean;
  income: HouseholdRetirementIncome;
}

/** Same shape/styling as the primary page's BreakdownTable (reuses its exported Row) - the old
 *  "estimated income" tooltip had gotten too dense for a hover bubble, so this replaces it with a
 *  proper line-item breakdown at the inspected age. */
export function RetirementBreakdownTable({
  age,
  rothBalance,
  traditionalBalance,
  afterTaxBalance,
  rothWithdrawalRatePct,
  traditionalWithdrawalRatePct,
  afterTaxWithdrawalRatePct,
  ssEnabled,
  income,
}: Readonly<RetirementBreakdownTableProps>) {
  const grossIncome = income.rothWithdrawal + income.traditionalWithdrawal + income.ssGross + income.pensionGross + income.afterTaxWithdrawal;

  return (
    <div className="breakdown-table-wrap">
      <div className="breakdown-table__title">Age {age} detail</div>
      <table className="breakdown-table">
        <tbody>
          <Row label="Roth balance" value={formatCurrency(rothBalance)} muted />
          <Row label="Traditional balance" value={formatCurrency(traditionalBalance)} muted />
          <Row label="After-tax balance" value={formatCurrency(afterTaxBalance)} muted />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          <Row
            label="Roth withdrawal"
            value={`${formatCurrency(income.rothWithdrawal)}/yr (${formatSliderValue(rothWithdrawalRatePct, '%')})`}
            muted
          />
          <Row
            label="Traditional withdrawal, gross"
            value={`${formatCurrency(income.traditionalWithdrawal)}/yr (${formatSliderValue(traditionalWithdrawalRatePct, '%')})`}
            muted
          />
          <Row
            label="After-tax withdrawal, gross"
            value={`${formatCurrency(income.afterTaxWithdrawal)}/yr (${formatSliderValue(afterTaxWithdrawalRatePct, '%')})`}
            muted
          />
          {ssEnabled && <Row label="Social Security, gross" value={`${formatCurrency(income.ssGross)}/yr`} muted />}
          <Row label="Pension/other income, gross" value={`${formatCurrency(income.pensionGross)}/yr`} muted />
          <Row label="Gross income" value={`${formatCurrency(grossIncome)}/yr`} />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          {ssEnabled && <Row label="— of which taxable Social Security" value={formatCurrency(income.tax.taxableSS)} muted />}
          <Row label="Standard deduction" value={`-${formatCurrency(income.tax.standardDeduction)}`} muted />
          <Row label="Taxable income" value={formatCurrency(income.tax.taxableOrdinaryIncome)} muted />
          <Row label="— of which after-tax withdrawal gain" value={formatCurrency(income.tax.taxableGain)} muted />
          <Row label="Capital gains tax" value={formatCurrency(income.tax.capitalGainsTax)} muted />
          {income.tax.earlyWithdrawalPenalty > 0 && (
            <Row label="Early-withdrawal penalty (10%)" value={formatCurrency(income.tax.earlyWithdrawalPenalty)} muted />
          )}
          <Row label="Federal tax, total" value={`${formatCurrency(income.tax.tax)}/yr (${income.tax.effectiveRatePct.toFixed(1)}%)`} />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          <tr className="breakdown-table__total">
            <td>Net income</td>
            <td
              className={
                income.netAnnual < 0 ? 'breakdown-table__value breakdown-table__value--danger' : 'breakdown-table__value breakdown-table__value--success'
              }
            >
              {formatCurrency(income.netAnnual)}/yr
            </td>
          </tr>
          <Row label="— in today's dollars" value={`${formatCurrency(income.netMonthlyReal * 12)}/yr`} muted />
        </tbody>
      </table>
    </div>
  );
}
