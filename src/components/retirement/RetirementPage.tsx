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
  RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD,
  RETIREMENT_AFTER_TAX_GAIN_FIELD,
  RETIREMENT_AFTER_TAX_SAVINGS_FIELD,
  RETIREMENT_AFTER_TAX_WITHDRAWAL_RATE_FIELD,
  RETIREMENT_CURRENT_AGE_FIELD,
  RETIREMENT_INSPECT_AGE_FIELD,
  RETIREMENT_PENSION_FIELD,
  RETIREMENT_PENSION_START_AGE_FIELD,
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
import {
  buildEarlyWithdrawalWarning,
  buildRetirementVerdict,
  MAX_PROJECTION_AGE,
  projectHouseholdRetirementIncome,
  projectRetirementBalance,
  type NamedRetirementPot,
} from '../../lib/retirement';

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

const AFTER_TAX_GROUP: BaseFieldGroup = {
  title: 'After-tax',
  fields: [
    RETIREMENT_AFTER_TAX_SAVINGS_FIELD,
    RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD,
    RETIREMENT_AFTER_TAX_WITHDRAWAL_RATE_FIELD,
    RETIREMENT_AFTER_TAX_GAIN_FIELD,
  ],
};

const INCOME_GROUP: BaseFieldGroup = {
  title: 'Income in retirement',
  fields: [RETIREMENT_SOCIAL_SECURITY_FIELD, RETIREMENT_PENSION_FIELD, RETIREMENT_PENSION_START_AGE_FIELD],
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
  // case - drawdown starts immediately. Projections always run through MAX_PROJECTION_AGE
  // (currently 100), not a fixed number of years past retirement.
  const targetYearOffset = Math.max(0, baseInputs.retirementTargetAge - currentAge);
  const finalYearOffset = MAX_PROJECTION_AGE - currentAge;

  const rothProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementRothSavingsTodayK * 1000,
        baseInputs.retirementRothContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
        finalYearOffset,
        baseInputs.retirementRothWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementRothSavingsTodayK,
      baseInputs.retirementRothContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
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
        finalYearOffset,
        baseInputs.retirementTraditionalWithdrawalRatePct,
        baseInputs.inflationPct,
        // RMDs only apply to Traditional (pre-tax) accounts - Roth and after-tax never get this.
        { currentAge },
      ),
    [
      baseInputs.retirementTraditionalSavingsTodayK,
      baseInputs.retirementTraditionalContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
      baseInputs.retirementTraditionalWithdrawalRatePct,
      baseInputs.inflationPct,
      currentAge,
    ],
  );

  const afterTaxProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementAfterTaxSavingsTodayK * 1000,
        baseInputs.retirementAfterTaxContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
        finalYearOffset,
        baseInputs.retirementAfterTaxWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementAfterTaxSavingsTodayK,
      baseInputs.retirementAfterTaxContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
      baseInputs.retirementAfterTaxWithdrawalRatePct,
      baseInputs.inflationPct,
    ],
  );

  const status = getFilingStatus(answers);

  const incomeSeries = useMemo(
    () =>
      projectHouseholdRetirementIncome({
        rothProjection,
        traditionalProjection,
        afterTaxProjection,
        afterTaxGainPct: baseInputs.retirementAfterTaxGainPct,
        pensionMonthlyToday: baseInputs.retirementPensionMo,
        pensionStartAge: baseInputs.retirementPensionStartAge,
        ssMonthlyBenefitToday: baseInputs.retirementSocialSecurityMo,
        currentAge,
        filingStatus: status,
        inflationPct: baseInputs.inflationPct,
      }),
    [
      rothProjection,
      traditionalProjection,
      afterTaxProjection,
      baseInputs.retirementAfterTaxGainPct,
      baseInputs.retirementPensionMo,
      baseInputs.retirementPensionStartAge,
      baseInputs.retirementSocialSecurityMo,
      currentAge,
      status,
      baseInputs.inflationPct,
    ],
  );
  const taxSeries = useMemo(() => incomeSeries.map((entry) => entry.tax.tax), [incomeSeries]);
  // Nominal-dollar sum across the whole projection - pre-retirement years are already $0 (no
  // withdrawals or Social Security yet), so this only really accumulates from retirement onward.
  const totalTaxPaid = useMemo(() => taxSeries.reduce((sum, tax) => sum + tax, 0), [taxSeries]);

  // Can't inspect an age before you've reached it, so the slider's floor tracks Current age instead
  // of the static Defaults.json minimum. The two sliders still move independently though (raising
  // Current age doesn't retroactively drag Inspect age's stored value up with it), so the clamp
  // below remains necessary for whatever the projection actually covers - both the inspect-age
  // slider and the projection itself top out at MAX_PROJECTION_AGE. Same clamping pattern App.tsx
  // already uses for a goal's runningTotal at its own endYear.
  const inspectAgeRange = { ...ranges.retirementInspectAge, min: currentAge };
  const lastIndex = incomeSeries.length - 1;
  const inspectIndex = Math.min(Math.max(baseInputs.retirementInspectAge - currentAge, 0), lastIndex);
  const inspectedAge = currentAge + inspectIndex;
  const inspectedIncome = incomeSeries[inspectIndex];
  const rothBalanceAtInspectYear = rothProjection.balances[inspectIndex] ?? 0;
  const traditionalBalanceAtInspectYear = traditionalProjection.balances[inspectIndex] ?? 0;
  const afterTaxBalanceAtInspectYear = afterTaxProjection.balances[inspectIndex] ?? 0;
  const rothWithdrawalRateAtInspectYear = rothProjection.effectiveWithdrawalRatePct[inspectIndex] ?? 0;
  const traditionalWithdrawalRateAtInspectYear = traditionalProjection.effectiveWithdrawalRatePct[inspectIndex] ?? 0;
  const afterTaxWithdrawalRateAtInspectYear = afterTaxProjection.effectiveWithdrawalRatePct[inspectIndex] ?? 0;

  const metrics: Metric[] = [
    {
      id: 'retirement-balance',
      label: 'Total balance, inspect age',
      value: formatCurrencyCompact(rothBalanceAtInspectYear + traditionalBalanceAtInspectYear + afterTaxBalanceAtInspectYear),
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
    {
      id: 'retirement-total-tax',
      label: 'Total taxes paid',
      value: formatCurrencyCompact(totalTaxPaid),
    },
  ];

  const pots: NamedRetirementPot[] = [
    { name: 'Roth', projection: rothProjection },
    { name: 'Traditional', projection: traditionalProjection },
    { name: 'After-tax', projection: afterTaxProjection },
  ];
  const verdict = buildRetirementVerdict(pots, currentAge);
  const earlyWithdrawalWarning = buildEarlyWithdrawalWarning(incomeSeries, currentAge);

  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <ControlGroup group={AGE_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={ROTH_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={TRADITIONAL_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={AFTER_TAX_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
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
        {earlyWithdrawalWarning && <VerdictBanner verdict={earlyWithdrawalWarning} />}
        <RetirementChart
          rothProjection={rothProjection}
          traditionalProjection={traditionalProjection}
          afterTaxProjection={afterTaxProjection}
          taxSeries={taxSeries}
          currentAge={currentAge}
        />
        <div className="inspect-year-control">
          <SliderField
            meta={RETIREMENT_INSPECT_AGE_FIELD}
            range={inspectAgeRange}
            value={baseInputs.retirementInspectAge}
            onChange={onChange}
          />
        </div>
        <MetricCards metrics={metrics} />
        <RetirementBreakdownTable
          age={inspectedAge}
          rothBalance={rothBalanceAtInspectYear}
          traditionalBalance={traditionalBalanceAtInspectYear}
          afterTaxBalance={afterTaxBalanceAtInspectYear}
          rothWithdrawalRatePct={rothWithdrawalRateAtInspectYear}
          traditionalWithdrawalRatePct={traditionalWithdrawalRateAtInspectYear}
          afterTaxWithdrawalRatePct={afterTaxWithdrawalRateAtInspectYear}
          income={inspectedIncome}
        />
      </div>
    </div>
  );
}
