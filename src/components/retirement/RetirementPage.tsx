import { useMemo, useState } from 'react';
import { ControlGroup } from '../controls/ControlGroup';
import { SliderField } from '../controls/SliderField';
import { MobileSubTabs } from '../MobileSubTabs';
import { CollapsibleChart } from '../results/CollapsibleChart';
import { MetricCards, type Metric } from '../results/MetricCards';
import { VerdictBanner } from '../results/VerdictBanner';
import { FilingStatusToggle } from './FilingStatusToggle';
import { SocialSecurityToggle } from './SocialSecurityToggle';
import { WithdrawalBridgeToggle } from './WithdrawalBridgeToggle';
import { RetirementBreakdownTable } from './RetirementBreakdownTable';
import { RetirementChart } from './RetirementChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  BASE_FIELD_GROUPS,
  RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD,
  RETIREMENT_AFTER_TAX_GAIN_FIELD,
  RETIREMENT_AFTER_TAX_SAVINGS_FIELD,
  RETIREMENT_AFTER_TAX_WITHDRAWAL_FIELD,
  RETIREMENT_CURRENT_AGE_FIELD,
  RETIREMENT_INSPECT_AGE_FIELD,
  RETIREMENT_PENSION_FIELD,
  RETIREMENT_PENSION_START_AGE_FIELD,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD,
  RETIREMENT_ROTH_SAVINGS_FIELD,
  RETIREMENT_ROTH_WITHDRAWAL_FIELD,
  RETIREMENT_SOCIAL_SECURITY_FIELD,
  RETIREMENT_SOCIAL_SECURITY_START_AGE_FIELD,
  RETIREMENT_TARGET_AGE_FIELD,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_FIELD,
  type BaseFieldId,
  type BaseFieldGroup,
} from '../../lib/baseFields';
import { formatCurrency, formatCurrencyCompact, formatSliderValue } from '../../lib/format';
import { filingStatus as getFilingStatus, socialSecurityEnabled, ssWithdrawalBridgeEnabled, type Answers } from '../../lib/questions';
import {
  buildEarlyWithdrawalWarning,
  buildRetirementVerdict,
  clampSocialSecurityStartAge,
  MAX_PROJECTION_AGE,
  projectedBalanceAtRetirement,
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
  fields: [RETIREMENT_ROTH_SAVINGS_FIELD, RETIREMENT_ROTH_CONTRIBUTION_FIELD, RETIREMENT_ROTH_WITHDRAWAL_FIELD],
};

const TRADITIONAL_GROUP: BaseFieldGroup = {
  title: 'Traditional',
  fields: [RETIREMENT_TRADITIONAL_SAVINGS_FIELD, RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD, RETIREMENT_TRADITIONAL_WITHDRAWAL_FIELD],
};

const AFTER_TAX_GROUP: BaseFieldGroup = {
  title: 'After-tax',
  fields: [
    RETIREMENT_AFTER_TAX_SAVINGS_FIELD,
    RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD,
    RETIREMENT_AFTER_TAX_WITHDRAWAL_FIELD,
    RETIREMENT_AFTER_TAX_GAIN_FIELD,
  ],
};

// Dollar amount is the primary, directly-editable slider value (see RETIREMENT_*_WITHDRAWAL_FIELD in
// baseFields.ts); the equivalent "4% rule"-style initial withdrawal rate is derived from it and
// shown alongside, in parentheses, as this field's valueLabel override - never as its own slider.
function withdrawalValueLabel(monthlyDollar: number, ratePct: number): string {
  return `${formatSliderValue(monthlyDollar, '$')} (${formatSliderValue(ratePct, '%')})`;
}

/** (monthlyDollar * 12) / balanceAtRetirement, as a percentage - the withdrawal rate that reproduces
 *  the chosen dollar target, fed into projectRetirementBalance exactly like the old rate-primary
 *  input was. $0 (rather than Infinity/NaN) when there's no balance to speak of - at that point the
 *  scheduled withdrawal is capped to $0 by applyDecumulationStep regardless of what rate is passed,
 *  so this is a display-safe placeholder, not a modeling choice. */
function impliedWithdrawalRatePct(monthlyDollar: number, balanceAtRetirement: number): number {
  return balanceAtRetirement > 0 ? ((monthlyDollar * 12) / balanceAtRetirement) * 100 : 0;
}

const INCOME_GROUP: BaseFieldGroup = {
  title: 'Income in retirement',
  fields: [RETIREMENT_SOCIAL_SECURITY_FIELD, RETIREMENT_SOCIAL_SECURITY_START_AGE_FIELD, RETIREMENT_PENSION_FIELD, RETIREMENT_PENSION_START_AGE_FIELD],
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

type MobileTab = 'inputs' | 'results';

/** Same shape as the primary page (App.tsx): sidebar on the left for inputs, chart on the right for
 *  results. */
export function RetirementPage({ baseInputs, ranges, onChange, answers, onAnswer }: Readonly<RetirementPageProps>) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('results');
  const currentAge = baseInputs.retirementCurrentAge;
  // Everything below still works in terms of "years from today," same as before ages existed -
  // this is just the translation layer between that and the age the user actually thinks in.
  // Target age at or before current age means "already retired," same as the old targetYear=0
  // case - drawdown starts immediately. Projections always run through MAX_PROJECTION_AGE
  // (currently 100), not a fixed number of years past retirement.
  const targetYearOffset = Math.max(0, baseInputs.retirementTargetAge - currentAge);
  const finalYearOffset = MAX_PROJECTION_AGE - currentAge;

  // The dollar sliders are the primary input now (see RETIREMENT_*_WITHDRAWAL_FIELD in
  // baseFields.ts), but projectRetirementBalance still takes a rate - so each pot's projected
  // balance at retirement (accumulation-phase-only, and thus independent of the withdrawal amount
  // itself - see projectedBalanceAtRetirement's own comment) is used to convert the chosen monthly
  // dollar target into the equivalent rate before calling it, unchanged, below.
  const rothBalanceAtRetirement = useMemo(
    () =>
      projectedBalanceAtRetirement(
        baseInputs.retirementRothSavingsTodayK * 1000,
        baseInputs.retirementRothContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
      ),
    [baseInputs.retirementRothSavingsTodayK, baseInputs.retirementRothContributionMo, baseInputs.investmentReturnPct, targetYearOffset],
  );
  const traditionalBalanceAtRetirement = useMemo(
    () =>
      projectedBalanceAtRetirement(
        baseInputs.retirementTraditionalSavingsTodayK * 1000,
        baseInputs.retirementTraditionalContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
      ),
    [baseInputs.retirementTraditionalSavingsTodayK, baseInputs.retirementTraditionalContributionMo, baseInputs.investmentReturnPct, targetYearOffset],
  );
  const afterTaxBalanceAtRetirement = useMemo(
    () =>
      projectedBalanceAtRetirement(
        baseInputs.retirementAfterTaxSavingsTodayK * 1000,
        baseInputs.retirementAfterTaxContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
      ),
    [baseInputs.retirementAfterTaxSavingsTodayK, baseInputs.retirementAfterTaxContributionMo, baseInputs.investmentReturnPct, targetYearOffset],
  );

  const rothWithdrawalRatePct = impliedWithdrawalRatePct(baseInputs.retirementRothWithdrawalMo, rothBalanceAtRetirement);
  const traditionalWithdrawalRatePct = impliedWithdrawalRatePct(baseInputs.retirementTraditionalWithdrawalMo, traditionalBalanceAtRetirement);
  const afterTaxWithdrawalRatePct = impliedWithdrawalRatePct(baseInputs.retirementAfterTaxWithdrawalMo, afterTaxBalanceAtRetirement);

  const status = getFilingStatus(answers);
  // A real on/off switch, not just "drag the slider to $0" - see SocialSecurityToggle.tsx and
  // socialSecurityEnabled's own comment. Off means Social Security contributes nothing to the
  // income projection at all, and its line is dropped entirely from the breakdown table below.
  const ssEnabled = socialSecurityEnabled(answers);
  const ssMonthlyBenefitToday = ssEnabled ? baseInputs.retirementSocialSecurityMo : 0;
  // Same clamp-then-offset math projectHouseholdRetirementIncome itself applies - duplicated here
  // (rather than reading it back off the income series) because the Traditional projection below
  // needs it before that series exists. Independent of targetYearOffset, same as pensionStartAge -
  // you can claim Social Security before, at, or well after the age you stop withdrawing.
  const ssStartYearOffset = Math.max(0, clampSocialSecurityStartAge(baseInputs.retirementSocialSecurityStartAge) - currentAge);
  // The bridge only means anything when there's an actual gap to bridge - retiring before Social
  // Security starts. Retiring at or after ssStartYearOffset means SS already begins on day one, so
  // there's nothing to cut back later.
  const ssBridgeEligible = ssEnabled && targetYearOffset < ssStartYearOffset;
  const ssBridgeEnabled = ssBridgeEligible && ssWithdrawalBridgeEnabled(answers);

  const rothProjection = useMemo(
    () =>
      projectRetirementBalance(
        baseInputs.retirementRothSavingsTodayK * 1000,
        baseInputs.retirementRothContributionMo,
        baseInputs.investmentReturnPct,
        targetYearOffset,
        finalYearOffset,
        rothWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementRothSavingsTodayK,
      baseInputs.retirementRothContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
      rothWithdrawalRatePct,
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
        traditionalWithdrawalRatePct,
        baseInputs.inflationPct,
        // RMDs only apply to Traditional (pre-tax) accounts - Roth and after-tax never get this.
        { currentAge },
        // Same restriction: the Social Security bridge only ever touches the Traditional pot.
        ssBridgeEnabled ? { startYearOffset: ssStartYearOffset, annualBenefitToday: ssMonthlyBenefitToday * 12 } : undefined,
      ),
    [
      baseInputs.retirementTraditionalSavingsTodayK,
      baseInputs.retirementTraditionalContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
      traditionalWithdrawalRatePct,
      baseInputs.inflationPct,
      currentAge,
      ssBridgeEnabled,
      ssStartYearOffset,
      ssMonthlyBenefitToday,
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
        afterTaxWithdrawalRatePct,
        baseInputs.inflationPct,
      ),
    [
      baseInputs.retirementAfterTaxSavingsTodayK,
      baseInputs.retirementAfterTaxContributionMo,
      baseInputs.investmentReturnPct,
      targetYearOffset,
      finalYearOffset,
      afterTaxWithdrawalRatePct,
      baseInputs.inflationPct,
    ],
  );

  const incomeSeries = useMemo(
    () =>
      projectHouseholdRetirementIncome({
        rothProjection,
        traditionalProjection,
        afterTaxProjection,
        afterTaxGainPct: baseInputs.retirementAfterTaxGainPct,
        pensionMonthlyToday: baseInputs.retirementPensionMo,
        pensionStartAge: baseInputs.retirementPensionStartAge,
        ssMonthlyBenefitToday,
        ssStartAge: baseInputs.retirementSocialSecurityStartAge,
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
      ssMonthlyBenefitToday,
      baseInputs.retirementSocialSecurityStartAge,
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
    <div className="app-shell" data-mobile-tab={mobileTab}>
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <ControlGroup group={AGE_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup
            group={ROTH_GROUP}
            ranges={ranges}
            values={baseInputs}
            onChange={onChange}
            valueLabelForField={(fieldId) =>
              fieldId === 'retirementRothWithdrawalMo' ? withdrawalValueLabel(baseInputs.retirementRothWithdrawalMo, rothWithdrawalRatePct) : undefined
            }
          />
          <ControlGroup
            group={TRADITIONAL_GROUP}
            ranges={ranges}
            values={baseInputs}
            onChange={onChange}
            valueLabelForField={(fieldId) =>
              fieldId === 'retirementTraditionalWithdrawalMo'
                ? withdrawalValueLabel(baseInputs.retirementTraditionalWithdrawalMo, traditionalWithdrawalRatePct)
                : undefined
            }
          />
          <ControlGroup
            group={AFTER_TAX_GROUP}
            ranges={ranges}
            values={baseInputs}
            onChange={onChange}
            valueLabelForField={(fieldId) =>
              fieldId === 'retirementAfterTaxWithdrawalMo'
                ? withdrawalValueLabel(baseInputs.retirementAfterTaxWithdrawalMo, afterTaxWithdrawalRatePct)
                : undefined
            }
          />
          <ControlGroup
            group={INCOME_GROUP}
            ranges={ranges}
            values={baseInputs}
            onChange={onChange}
            renderBeforeField={(fieldId) =>
              fieldId === 'retirementSocialSecurityMo' ? (
                <>
                  <FilingStatusToggle filingStatus={status} onChange={(next) => onAnswer('filingStatus', next)} />
                  <SocialSecurityToggle enabled={ssEnabled} onChange={(next) => onAnswer('socialSecurityEnabled', next)} />
                  {ssBridgeEligible && (
                    <WithdrawalBridgeToggle enabled={ssBridgeEnabled} onChange={(next) => onAnswer('ssWithdrawalBridgeEnabled', next)} />
                  )}
                </>
              ) : null
            }
            disabledForField={(fieldId) => (fieldId === 'retirementSocialSecurityMo' || fieldId === 'retirementSocialSecurityStartAge') && !ssEnabled}
          />
          {ASSUMPTIONS_GROUP && <ControlGroup group={ASSUMPTIONS_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />}
        </div>
      </aside>

      <div className="app-shell__main">
        <div className="app-shell__chart">
          <CollapsibleChart>
            <RetirementChart
              rothProjection={rothProjection}
              traditionalProjection={traditionalProjection}
              afterTaxProjection={afterTaxProjection}
              taxSeries={taxSeries}
              currentAge={currentAge}
            />
          </CollapsibleChart>
        </div>

        <MobileSubTabs
          options={[
            { id: 'inputs', label: 'Inputs' },
            { id: 'results', label: 'Results' },
          ]}
          active={mobileTab}
          onSelect={setMobileTab}
        />

        <div className="app-shell__results">
          <VerdictBanner verdict={verdict} />
          {earlyWithdrawalWarning && <VerdictBanner verdict={earlyWithdrawalWarning} />}
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
            ssEnabled={ssEnabled}
            income={inspectedIncome}
          />
        </div>
      </div>
    </div>
  );
}
