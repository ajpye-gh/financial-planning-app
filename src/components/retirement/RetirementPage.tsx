import { useMemo } from 'react';
import { SliderField } from '../controls/SliderField';
import { MetricCards, type Metric } from '../results/MetricCards';
import { RetirementChart } from './RetirementChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  RETIREMENT_CONTRIBUTION_FIELD,
  RETIREMENT_SAVINGS_FIELD,
  RETIREMENT_TARGET_YEAR_FIELD,
  type BaseFieldId,
} from '../../lib/baseFields';
import { formatCurrencyCompact } from '../../lib/format';
import { projectRetirementBalance } from '../../lib/retirement';

interface RetirementPageProps {
  baseInputs: BaseInputs;
  ranges: BaseRanges;
  onChange: (id: BaseFieldId, value: number) => void;
}

/** Same shape as the primary page (App.tsx): sidebar on the left for inputs, chart on the right for
 *  results. Investment return (and any other assumption) is read straight from `baseInputs`, shared
 *  with the primary page - carried over automatically, nothing to duplicate here. */
export function RetirementPage({ baseInputs, ranges, onChange }: Readonly<RetirementPageProps>) {
  const projection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementSavingsTodayK * 1000,
        baseInputs.retirementContributionMo,
        baseInputs.investmentReturnPct,
        baseInputs.retirementTargetYear,
      ),
    [baseInputs.retirementSavingsTodayK, baseInputs.retirementContributionMo, baseInputs.investmentReturnPct, baseInputs.retirementTargetYear],
  );

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: `Projected balance, year ${baseInputs.retirementTargetYear}`,
      value: formatCurrencyCompact(projection.balances.at(-1) ?? 0),
    },
  ];

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <SliderField
            meta={RETIREMENT_SAVINGS_FIELD}
            range={ranges.retirementSavingsTodayK}
            value={baseInputs.retirementSavingsTodayK}
            onChange={onChange}
          />
          <SliderField
            meta={RETIREMENT_CONTRIBUTION_FIELD}
            range={ranges.retirementContributionMo}
            value={baseInputs.retirementContributionMo}
            onChange={onChange}
          />
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
        <RetirementChart projection={projection} />
        <MetricCards metrics={metrics} />
      </div>
    </div>
  );
}
