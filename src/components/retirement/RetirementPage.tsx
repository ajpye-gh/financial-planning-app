import { useMemo } from 'react';
import { ControlGroup } from '../controls/ControlGroup';
import { SliderField } from '../controls/SliderField';
import { MetricCards, type Metric } from '../results/MetricCards';
import { VerdictBanner } from '../results/VerdictBanner';
import { RetirementChart } from './RetirementChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  BASE_FIELD_GROUPS,
  RETIREMENT_CONTRIBUTION_FIELD,
  RETIREMENT_SAVINGS_FIELD,
  RETIREMENT_TARGET_YEAR_FIELD,
  RETIREMENT_WITHDRAWAL_RATE_FIELD,
  type BaseFieldId,
  type BaseFieldGroup,
} from '../../lib/baseFields';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { buildRetirementVerdict, estimateRetirementIncome, projectRetirementBalance } from '../../lib/retirement';

const RETIREMENT_GROUP: BaseFieldGroup = {
  title: 'Retirement',
  fields: [RETIREMENT_SAVINGS_FIELD, RETIREMENT_CONTRIBUTION_FIELD, RETIREMENT_WITHDRAWAL_RATE_FIELD],
};

// Same "Assumptions" group (inflation, investment return) the primary page's sidebar renders -
// shown here too so it's editable in place, not just silently used by the projection. It's the
// same shared baseInputs either way, so a change here is a change on the primary page too.
const ASSUMPTIONS_GROUP = BASE_FIELD_GROUPS.find((group) => group.title === 'Assumptions');

interface RetirementPageProps {
  baseInputs: BaseInputs;
  ranges: BaseRanges;
  onChange: (id: BaseFieldId, value: number) => void;
}

/** Same shape as the primary page (App.tsx): sidebar on the left for inputs, chart on the right for
 *  results. */
export function RetirementPage({ baseInputs, ranges, onChange }: Readonly<RetirementPageProps>) {
  const projection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementSavingsTodayK * 1000,
        baseInputs.retirementContributionMo,
        baseInputs.investmentReturnPct,
        baseInputs.retirementTargetYear,
        baseInputs.retirementWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementSavingsTodayK,
      baseInputs.retirementContributionMo,
      baseInputs.investmentReturnPct,
      baseInputs.retirementTargetYear,
      baseInputs.retirementWithdrawalRatePct,
      baseInputs.inflationPct,
    ],
  );

  // The balance at retirement itself, not the end of the chart - the chart now runs
  // POST_RETIREMENT_YEARS past that point to show the drawdown.
  const balanceAtRetirement = projection.balances[projection.retirementYearIndex] ?? 0;

  const income = useMemo(
    () => estimateRetirementIncome(balanceAtRetirement, baseInputs.retirementWithdrawalRatePct, baseInputs.inflationPct, baseInputs.retirementTargetYear),
    [balanceAtRetirement, baseInputs.retirementWithdrawalRatePct, baseInputs.inflationPct, baseInputs.retirementTargetYear],
  );

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: `Projected balance, year ${baseInputs.retirementTargetYear}`,
      value: formatCurrencyCompact(balanceAtRetirement),
    },
    {
      id: 'retirement-income',
      label: `Estimated income, year ${baseInputs.retirementTargetYear}`,
      value: `${formatCurrency(income.monthlyIncomeNominal)}/mo`,
    },
    {
      id: 'retirement-income-real',
      label: "— in today's dollars",
      value: `${formatCurrency(income.monthlyIncomeReal)}/mo`,
    },
  ];

  const verdict = buildRetirementVerdict(projection);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <ControlGroup group={RETIREMENT_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          {ASSUMPTIONS_GROUP && <ControlGroup group={ASSUMPTIONS_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />}
        </div>
      </aside>

      <div className="app-shell__main">
        <div className="inspect-year-control">
          <SliderField
            meta={RETIREMENT_TARGET_YEAR_FIELD}
            range={ranges.retirementTargetYear}
            value={baseInputs.retirementTargetYear}
            onChange={onChange}
          />
        </div>
        <VerdictBanner verdict={verdict} />
        <RetirementChart projection={projection} />
        <MetricCards metrics={metrics} />
      </div>
    </div>
  );
}
