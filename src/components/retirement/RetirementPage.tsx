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
  RETIREMENT_CURRENT_AGE_FIELD,
  RETIREMENT_INSPECT_AGE_FIELD,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD,
  RETIREMENT_ROTH_SAVINGS_FIELD,
  RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD,
  RETIREMENT_SOCIAL_SECURITY_FIELD,
  RETIREMENT_TARGET_AGE_FIELD,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD,
  type BaseFieldId,
  type BaseFieldGroup,
} from '../../lib/baseFields';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { filingStatus as getFilingStatus, type Answers } from '../../lib/questions';
import { buildRetirementVerdict, projectHouseholdRetirementIncome, projectRetirementBalance } from '../../lib/retirement';

const AGE_GROUP: BaseFieldGroup = {
  title: 'Age',
  fields: [RETIREMENT_CURRENT_AGE_FIELD, RETIREMENT_TARGET_AGE_FIELD],
};

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
  const currentAge = baseInputs.retirementCurrentAge;
  // Everything below still works in terms of "years from today," same as before ages existed -
  // this is just the translation layer between that and the age the user actually thinks in.
  // Target age at or before current age means "already retired," same as the old targetYear=0
  // case - drawdown starts immediately.
  const targetYearOffset = Math.max(0, baseInputs.retirementTargetAge - currentAge);

  const rothProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementRothSavingsTodayK * 1000,
        baseInputs.retirementRothContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
        baseInputs.retirementRothWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementRothSavingsTodayK,
      baseInputs.retirementRothContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
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
        targetYearOffset,
        baseInputs.retirementTraditionalWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementTraditionalSavingsTodayK,
      baseInputs.retirementTraditionalContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
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

  // The inspect-age slider uses a static range (its practical span depends on the current
  // Current/Target age, which sliders here can't express), so clamp the lookup to whatever the
  // projection - age currentAge through currentAge + targetYearOffset + POST_RETIREMENT_YEARS -
  // actually covers. Same clamping pattern App.tsx already uses for a goal's runningTotal at its
  // own endYear.
  const lastIndex = incomeSeries.length - 1;
  const inspectIndex = Math.min(Math.max(baseInputs.retirementInspectAge - currentAge, 0), lastIndex);
  const inspectedAge = currentAge + inspectIndex;
  const inspectedIncome = incomeSeries[inspectIndex];
  const rothBalanceAtInspectYear = rothProjection.balances[inspectIndex] ?? 0;
  const traditionalBalanceAtInspectYear = traditionalProjection.balances[inspectIndex] ?? 0;

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: 'Total balance, inspect age',
      value: formatCurrencyCompact(rothBalanceAtInspectYear + traditionalBalanceAtInspectYear),
    },
    {
      id: 'retirement-income',
      label: 'Estimated income, inspect age',
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
          <ControlGroup group={AGE_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
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
        <VerdictBanner verdict={verdict} />
        <RetirementChart
          rothProjection={rothProjection}
          traditionalProjection={traditionalProjection}
          taxSeries={taxSeries}
          currentAge={currentAge}
        />
        <div className="inspect-year-control">
          <SliderField
            meta={RETIREMENT_INSPECT_AGE_FIELD}
            range={ranges.retirementInspectAge}
            value={baseInputs.retirementInspectAge}
            onChange={onChange}
          />
        </div>
        <MetricCards metrics={metrics} />
        <RetirementBreakdownTable
          age={inspectedAge}
          rothBalance={rothBalanceAtInspectYear}
          traditionalBalance={traditionalBalanceAtInspectYear}
          income={inspectedIncome}
        />
      </div>
    </div>
  );
}
