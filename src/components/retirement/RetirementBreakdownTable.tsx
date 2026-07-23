import { Row } from '../results/BreakdownTable';
import { formatCurrency } from '../../lib/format';
import type { HouseholdRetirementIncome } from '../../lib/retirement';

interface RetirementBreakdownTableProps {
  age: number;
  rothBalance: number;
  traditionalBalance: number;
  income: HouseholdRetirementIncome;
}

/** Same shape/styling as the primary page's BreakdownTable (reuses its exported Row) - the old
 *  "estimated income" tooltip had gotten too dense for a hover bubble, so this replaces it with a
 *  proper line-item breakdown at the inspected age. */
export function RetirementBreakdownTable({ age, rothBalance, traditionalBalance, income }: Readonly<RetirementBreakdownTableProps>) {
  const grossIncome = income.rothWithdrawal + income.traditionalWithdrawal + income.ssGross;

  return (
    <div className="breakdown-table-wrap">
      <div className="breakdown-table__title">Age {age} detail</div>
      <table className="breakdown-table">
        <tbody>
          <Row label="Roth balance" value={formatCurrency(rothBalance)} muted />
          <Row label="Traditional balance" value={formatCurrency(traditionalBalance)} muted />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          <Row label="Roth withdrawal" value={`${formatCurrency(income.rothWithdrawal)}/yr`} muted />
          <Row label="Traditional withdrawal, gross" value={`${formatCurrency(income.traditionalWithdrawal)}/yr`} muted />
          <Row label="Social Security, gross" value={`${formatCurrency(income.ssGross)}/yr`} muted />
          <Row label="Gross income" value={`${formatCurrency(grossIncome)}/yr`} />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          <Row label="— of which taxable Social Security" value={formatCurrency(income.tax.taxableSS)} muted />
          <Row label="Standard deduction" value={`-${formatCurrency(income.tax.standardDeduction)}`} muted />
          <Row label="Taxable income" value={formatCurrency(income.tax.taxableOrdinaryIncome)} muted />
          <Row label="Federal tax" value={`${formatCurrency(income.tax.tax)}/yr (${income.tax.effectiveRatePct.toFixed(1)}%)`} />
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
