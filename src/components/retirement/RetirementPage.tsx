import { useMemo } from 'react';
import { ControlGroup } from '../controls/ControlGroup';
import { SliderField } from '../controls/SliderField';
import { MetricCards, type Metric } from '../results/MetricCards';
import { VerdictBanner } from '../results/VerdictBanner';
import { FilingStatusToggle } from './FilingStatusToggle';
import { RetirementBreakdownTable } from './RetirementBreakdownTable';
import { RetirementChart } from './RetirementChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  BASE_FIELD_GROUPS,
  RETIREMENT_INSPECT_YEAR_FIELD,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD,
  RETIREMENT_ROTH_SAVINGS_FIELD,
  RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD,
  RETIREMENT_SOCIAL_SECURITY_FIELD,
  RETIREMENT_TARGET_YEAR_FIELD,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD,
  type BaseFieldId,
  type BaseFieldGroup,
} from '../../lib/baseFields';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { filingStatus as getFilingStatus, type Answers } from '../../lib/questions';
import { buildRetirementVerdict, projectHouseholdRetirementIncome, projectRetirementBalance } from '../../lib/retirement';

const ROTH_GROUP: BaseFieldGroup = {
  title: 'Roth',
  fields: [RETIREMENT_ROTH_SAVINGS_FIELD, RETIREMENT_ROTH_CONTRIBUTION_FIELD, RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD],
};

const TRADITIONAL_GROUP: BaseFieldGroup = {
  title: 'Traditional',
  fields: [RETIREMENT_TRADITIONAL_SAVINGS_FIELD, RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD, RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD],
};

const INCOME_GROUP: BaseFieldGroup = {
  title: 'Income in retirement',
  fields: [RETIREMENT_SOCIAL_SECURITY_FIELD],
};

// Same "Assumptions" group (inflation, investment return) the primary page's sidebar renders -
// shown here too so it's editable in place, not just silently used by the projection. It's the
// same shared baseInputs either way, so a change here is a change on the primary page too.
const ASSUMPTIONS_GROUP = BASE_FIELD_GROUPS.find((group) => group.title === 'Assumptions');

interface RetirementPageProps {
  baseInputs: BaseInputs;
  ranges: BaseRanges;
  onChange: (id: BaseFieldId, value: number) => void;
  answers: Answers;
  onAnswer: (id: string, value: boolean | string) => void;
}

/** Same shape as the primary page (App.tsx): sidebar on the left for inputs, chart on the right for
 *  results. */
export function RetirementPage({ baseInputs, ranges, onChange, answers, onAnswer }: Readonly<RetirementPageProps>) {
  const rothProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementRothSavingsTodayK * 1000,
        baseInputs.retirementRothContributionMo,
        baseInputs.investmentReturnPct,
        baseInputs.retirementTargetYear,
        baseInputs.retirementRothWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementRothSavingsTodayK,
      baseInputs.retirementRothContributionMo,
      baseInputs.investmentReturnPct,
      baseInputs.retirementTargetYear,
      baseInputs.retirementRothWithdrawalRatePct,
      baseInputs.inflationPct,
    ],
  );

  const traditionalProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementTraditionalSavingsTodayK * 1000,
        baseInputs.retirementTraditionalContributionMo,
        baseInputs.investmentReturnPct,
        baseInputs.retirementTargetYear,
        baseInputs.retirementTraditionalWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementTraditionalSavingsTodayK,
      baseInputs.retirementTraditionalContributionMo,
      baseInputs.investmentReturnPct,
      baseInputs.retirementTargetYear,
      baseInputs.retirementTraditionalWithdrawalRatePct,
      baseInputs.inflationPct,
    ],
  );

  const status = getFilingStatus(answers);

  const incomeSeries = useMemo(
    () =>
      projectHouseholdRetirementIncome(
        rothProjection,
        traditionalProjection,
        baseInputs.retirementSocialSecurityMo,
        status,
        baseInputs.inflationPct,
      ),
    [rothProjection, traditionalProjection, baseInputs.retirementSocialSecurityMo, status, baseInputs.inflationPct],
  );
  const taxSeries = useMemo(() => incomeSeries.map((entry) => entry.tax.tax), [incomeSeries]);

  // The inspect-year slider uses a static range (its practical span depends on the current Target
  // year, which sliders here can't express), so clamp the lookup to whatever the projection - Y0
  // through Target year + POST_RETIREMENT_YEARS - actually covers. Same clamping pattern App.tsx
  // already uses for a goal's runningTotal at its own endYear.
  const lastIndex = incomeSeries.length - 1;
  const inspectIndex = Math.min(Math.max(baseInputs.retirementInspectYear, 0), lastIndex);
  const inspectedIncome = incomeSeries[inspectIndex];
  const rothBalanceAtInspectYear = rothProjection.balances[inspectIndex] ?? 0;
  const traditionalBalanceAtInspectYear = traditionalProjection.balances[inspectIndex] ?? 0;

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: 'Total balance, inspect yr',
      value: formatCurrencyCompact(rothBalanceAtInspectYear + traditionalBalanceAtInspectYear),
    },
    {
      id: 'retirement-income',
      label: 'Estimated income, inspect yr',
      value: `${formatCurrency(inspectedIncome.netMonthlyNominal)}/mo`,
    },
    {
      id: 'retirement-income-real',
      label: "— in today's dollars",
      value: `${formatCurrency(inspectedIncome.netMonthlyReal)}/mo`,
    },
  ];

  const verdict = buildRetirementVerdict(rothProjection, traditionalProjection);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <ControlGroup group={ROTH_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={TRADITIONAL_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup
            group={INCOME_GROUP}
            ranges={ranges}
            values={baseInputs}
            onChange={onChange}
            renderBeforeField={(fieldId) =>
              fieldId === 'retirementSocialSecurityMo' ? (
                <FilingStatusToggle filingStatus={status} onChange={(next) => onAnswer('filingStatus', next)} />
              ) : null
            }
          />
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
        <RetirementChart rothProjection={rothProjection} traditionalProjection={traditionalProjection} taxSeries={taxSeries} />
        <div className="inspect-year-control">
          <SliderField
            meta={RETIREMENT_INSPECT_YEAR_FIELD}
            range={ranges.retirementInspectYear}
            value={baseInputs.retirementInspectYear}
            onChange={onChange}
          />
        </div>
        <MetricCards metrics={metrics} />
        <RetirementBreakdownTable
          year={inspectIndex}
          rothBalance={rothBalanceAtInspectYear}
          traditionalBalance={traditionalBalanceAtInspectYear}
          income={inspectedIncome}
        />
      </div>
    </div>
  );
}
