import { formatCurrency } from '../../lib/format';
import type { YearSnapshot } from '../../lib/model';
import type { Goal } from '../../lib/goals';

interface RowProps {
  label: string;
  value: string;
  muted?: boolean;
}

/** Exported for reuse by RetirementBreakdownTable.tsx - same row styling, different data. */
export function Row({ label, value, muted }: Readonly<RowProps>) {
  return (
    <tr className={muted ? 'breakdown-table__row breakdown-table__row--muted' : 'breakdown-table__row'}>
      <td>{label}</td>
      <td className="breakdown-table__value">{value}</td>
    </tr>
  );
}

interface BreakdownTableProps {
  snapshot: YearSnapshot;
  goals: Goal[];
}

export function BreakdownTable({ snapshot, goals }: Readonly<BreakdownTableProps>) {
  return (
    <div className="breakdown-table-wrap">
      <div className="breakdown-table__title">Year {snapshot.year} monthly detail</div>
      <table className="breakdown-table">
        <tbody>
          <Row label="Your salary, gross" value={`${formatCurrency(snapshot.grossSalary)}/yr`} muted />
          {snapshot.partnerGrossSalary > 0 && (
            <Row label="Partner's salary, gross" value={`${formatCurrency(snapshot.partnerGrossSalary)}/yr`} muted />
          )}
          <Row label="Net income" value={formatCurrency(snapshot.netIncome)} />
          <Row label="— in today's dollars" value={formatCurrency(snapshot.realIncome)} muted />
          <tr className="breakdown-table__divider">
            <td colSpan={2} />
          </tr>
          <Row label="Living costs, non-housing" value={formatCurrency(snapshot.livingCosts)} muted />
          <Row label="Children" value={formatCurrency(snapshot.kidsCost)} muted />
          <Row label="Housing" value={formatCurrency(snapshot.housingCost)} muted />
          {snapshot.purchaseCosts > 0 && (
            <Row label="Other purchase costs" value={formatCurrency(snapshot.purchaseCosts)} muted />
          )}
          <Row label="Total expenses" value={formatCurrency(snapshot.totalExpenses)} />
          {goals.length > 0 && (
            <>
              <tr className="breakdown-table__divider">
                <td colSpan={2} />
              </tr>
              {goals.map((goal) => (
                <Row
                  key={goal.id}
                  label={goal.name}
                  value={formatCurrency(snapshot.goalContributions[goal.id] ?? 0)}
                  muted
                />
              ))}
            </>
          )}
          <tr className="breakdown-table__total">
            <td>Free cash</td>
            <td
              className={
                snapshot.freeCash < 0
                  ? 'breakdown-table__value breakdown-table__value--danger'
                  : 'breakdown-table__value breakdown-table__value--success'
              }
            >
              {formatCurrency(snapshot.freeCash)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
