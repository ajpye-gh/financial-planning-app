import { useMemo } from 'react';
import { ControlGroup } from '../controls/ControlGroup';
import { SliderField } from '../controls/SliderField';
import { MetricCards, type Metric } from '../results/MetricCards';
import { VerdictBanner } from '../results/VerdictBanner';
import { Tooltip } from '../Tooltip';
import { FilingStatusToggle } from './FilingStatusToggle';
import { RetirementChart } from './RetirementChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  BASE_FIELD_GROUPS,
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
import { buildRetirementVerdict, estimateHouseholdRetirementIncome, projectRetirementBalance } from '../../lib/retirement';

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

  // Balances at retirement itself, not the end of the chart - the chart runs POST_RETIREMENT_YEARS
  // past that point to show the drawdown.
  const rothBalanceAtRetirement = rothProjection.balances[rothProjection.retirementYearIndex] ?? 0;
  const traditionalBalanceAtRetirement = traditionalProjection.balances[traditionalProjection.retirementYearIndex] ?? 0;

  const status = getFilingStatus(answers);

  const income = useMemo(
    () =>
      estimateHouseholdRetirementIncome(
        rothBalanceAtRetirement,
        baseInputs.retirementRothWithdrawalRatePct,
        traditionalBalanceAtRetirement,
        baseInputs.retirementTraditionalWithdrawalRatePct,
        baseInputs.retirementSocialSecurityMo,
        status,
        baseInputs.inflationPct,
        baseInputs.retirementTargetYear,
      ),
    [
      rothBalanceAtRetirement,
      baseInputs.retirementRothWithdrawalRatePct,
      traditionalBalanceAtRetirement,
      baseInputs.retirementTraditionalWithdrawalRatePct,
      baseInputs.retirementSocialSecurityMo,
      status,
      baseInputs.inflationPct,
      baseInputs.retirementTargetYear,
    ],
  );

  const incomeTooltip = `Traditional withdrawal ${formatCurrency(income.traditionalAnnualGross)}/yr + Social Security ${formatCurrency(income.ssAnnualGross)}/yr (${formatCurrency(income.tax.taxableSS)} of it taxable) − ${formatCurrency(income.tax.standardDeduction)} standard deduction = ${formatCurrency(income.tax.taxableOrdinaryIncome)} taxable income, ${formatCurrency(income.tax.tax)}/yr federal tax (${income.tax.effectiveRatePct.toFixed(1)}% effective). Roth withdrawals are tax-free. Federal income tax only - no state tax, FICA, or RMDs.`;

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: `Total balance, year ${baseInputs.retirementTargetYear}`,
      value: formatCurrencyCompact(rothBalanceAtRetirement + traditionalBalanceAtRetirement),
    },
    {
      id: 'retirement-income',
      label: <Tooltip tip={incomeTooltip}>{`Estimated income, year ${baseInputs.retirementTargetYear}`}</Tooltip>,
      value: `${formatCurrency(income.netMonthlyNominal)}/mo`,
    },
    {
      id: 'retirement-income-real',
      label: "— in today's dollars",
      value: `${formatCurrency(income.netMonthlyReal)}/mo`,
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
        <RetirementChart rothProjection={rothProjection} traditionalProjection={traditionalProjection} />
        <MetricCards metrics={metrics} />
      </div>
    </div>
  );
}
