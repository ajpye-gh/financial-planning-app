import { useMemo, useState } from 'react';
import { ControlGroup } from '../controls/ControlGroup';
import { SliderField } from '../controls/SliderField';
import { MobileSubTabs } from '../MobileSubTabs';
import { CollapsibleChart } from '../results/CollapsibleChart';
import { MetricCards, type Metric } from '../results/MetricCards';
import { Row } from '../results/BreakdownTable';
import { MortgageChart } from './MortgageChart';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import {
  HOME_INSURANCE_FIELD,
  HOME_VALUE_FIELD,
  INFLATION_FIELD,
  MORTGAGE_BALANCE_FIELD,
  MORTGAGE_EXTRA_PRINCIPAL_FIELD,
  MORTGAGE_INSPECT_YEAR_FIELD,
  MORTGAGE_INSURANCE_FIELD,
  MORTGAGE_RATE_FIELD,
  MORTGAGE_TERM_FIELD,
  PROPERTY_TAX_FIELD,
  type BaseFieldGroup,
  type BaseFieldId,
} from '../../lib/baseFields';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { ownsHome as getOwnsHome, type Answers } from '../../lib/questions';
import { buildAmortizationSchedule, currentMonthlyPayment, formatPayoffDate } from '../../lib/mortgage';

const MORTGAGE_DETAILS_GROUP: BaseFieldGroup = {
  title: 'Mortgage',
  fields: [HOME_VALUE_FIELD, MORTGAGE_BALANCE_FIELD, MORTGAGE_RATE_FIELD, MORTGAGE_TERM_FIELD],
};

const TAXES_INSURANCE_GROUP: BaseFieldGroup = {
  title: 'Taxes & insurance',
  fields: [PROPERTY_TAX_FIELD, HOME_INSURANCE_FIELD, MORTGAGE_INSURANCE_FIELD],
};

const EXTRA_PAYMENTS_GROUP: BaseFieldGroup = {
  title: 'Extra payments',
  fields: [MORTGAGE_EXTRA_PRINCIPAL_FIELD],
};

// Same "Assumptions" home-appreciation assumption the rest of the model uses (see model.ts's
// projectHomeEquity) - only Inflation is relevant here (it drives home-value appreciation and the
// 20%-equity insurance dropoff), unlike RetirementPage which also reuses Investment return.
const APPRECIATION_GROUP: BaseFieldGroup = {
  title: 'Assumptions',
  fields: [INFLATION_FIELD],
};

interface MortgagePageProps {
  baseInputs: BaseInputs;
  ranges: BaseRanges;
  onChange: (id: BaseFieldId, value: number) => void;
  answers: Answers;
}

type MobileTab = 'inputs' | 'results';

/** Right-pads a balance series with trailing $0s so two schedules of different lengths (the
 *  original payoff vs. a shorter one from extra payments) can share one chart x-axis - same idea as
 *  a goal balance freezing after its endYear elsewhere in this app, just frozen at $0 instead. */
function padToLength(values: number[], length: number): number[] {
  if (values.length >= length) {
    return values.slice(0, length);
  }
  return [...values, ...Array(length - values.length).fill(0)];
}

/** Same shape as the primary/Retirement pages: sidebar on the left for inputs, chart on the right
 *  for results. Covers the user's CURRENT/existing mortgage (homeValueK/mortgageBalanceK/
 *  currentMortgageRatePct) - separate from model.ts's estimateMortgage/MORTGAGE_TERM_YEARS, which is
 *  about a future property-goal purchase instead. */
export function MortgagePage({ baseInputs, ranges, onChange, answers }: Readonly<MortgagePageProps>) {
  const [mobileTab, setMobileTab] = useState<MobileTab>('results');
  const owns = getOwnsHome(answers);
  const loanAmount = baseInputs.mortgageBalanceK * 1000;
  const homeValue = baseInputs.homeValueK * 1000;

  const annualRatePct = baseInputs.currentMortgageRatePct;
  const termYears = baseInputs.mortgageTermYears;
  const appreciationPct = baseInputs.inflationPct;
  const monthlyInsurance = baseInputs.mortgageInsuranceMo;
  const monthlyHomeInsurance = baseInputs.homeInsuranceMo;
  const monthlyPropertyTax = baseInputs.propertyTaxMo;
  const extraMonthlyPrincipal = baseInputs.mortgageExtraPrincipalMo;
  const hasExtraPayment = extraMonthlyPrincipal > 0;

  const originalSchedule = useMemo(
    () => buildAmortizationSchedule({ loanAmount, annualRatePct, termYears, homeValue, appreciationPct, monthlyInsurance }),
    [loanAmount, annualRatePct, termYears, homeValue, appreciationPct, monthlyInsurance],
  );

  const withExtraSchedule = useMemo(
    () =>
      buildAmortizationSchedule({ loanAmount, annualRatePct, termYears, homeValue, appreciationPct, monthlyInsurance, extraMonthlyPrincipal }),
    [loanAmount, annualRatePct, termYears, homeValue, appreciationPct, monthlyInsurance, extraMonthlyPrincipal],
  );

  const chartLength = Math.max(originalSchedule.points.length, withExtraSchedule.points.length);
  const originalBalances = padToLength(
    originalSchedule.points.map((point) => point.closingBalance),
    chartLength,
  );
  const withExtraBalances = padToLength(
    withExtraSchedule.points.map((point) => point.closingBalance),
    chartLength,
  );
  const originalPayoffYear = originalSchedule.points.length - 1;
  const withExtraPayoffYear = withExtraSchedule.points.length - 1;

  const monthlyPayment = currentMonthlyPayment({
    loanAmount,
    annualRatePct,
    termYears,
    homeValue,
    appreciationPct,
    monthlyInsurance,
    monthlyHomeInsurance,
    monthlyPropertyTax,
    extraMonthlyPrincipal,
  });
  const totalInterestOriginal = originalSchedule.points.reduce((sum, point) => sum + point.interestPaid, 0);
  const totalInterestWithExtra = withExtraSchedule.points.reduce((sum, point) => sum + point.interestPaid, 0);
  const interestSaved = Math.max(0, totalInterestOriginal - totalInterestWithExtra);

  // Whichever schedule reflects what the user is actually paying (with extra principal is
  // identical to the original when extraMonthlyPrincipal is 0, so this is safe either way) - same
  // "which year's numbers am I looking at" pattern App.tsx/RetirementPage.tsx use for their own
  // inspect-year/age controls. Can't inspect past whichever schedule pays off first, so the slider's
  // ceiling tracks the longer of the two (chartLength) while the lookup itself clamps to whichever
  // schedule actually ran that long.
  const inspectRange = { ...ranges.mortgageInspectYear, max: Math.max(0, chartLength - 1) };
  const inspectYear = Math.min(Math.max(baseInputs.mortgageInspectYear, 0), inspectRange.max);
  const inspectSchedule = hasExtraPayment ? withExtraSchedule : originalSchedule;
  const inspectPoint = inspectSchedule.points[Math.min(inspectYear, inspectSchedule.points.length - 1)];
  // Same growth buildAmortizationSchedule applies internally at each year-end point (month = year *
  // 12, so appreciationPct^(month/12) reduces to appreciationPct^year here) - recomputed rather than
  // threaded out of the schedule so the breakdown table can show property tax/home insurance as
  // their own inflated line items instead of only the combined monthlyPaymentNominal total.
  const inspectGrowth = Math.pow(1 + appreciationPct / 100, inspectYear);
  const propertyTaxAtInspect = monthlyPropertyTax * inspectGrowth;
  const homeInsuranceAtInspect = monthlyHomeInsurance * inspectGrowth;
  let inspectInsuranceValue = 'None';
  if (inspectPoint.insuranceActive) {
    inspectInsuranceValue = `${formatCurrency(baseInputs.mortgageInsuranceMo)}/mo`;
  } else if (baseInputs.mortgageInsuranceMo > 0) {
    inspectInsuranceValue = 'Dropped off (20% equity reached)';
  }

  const metrics: Metric[] = [
    { id: 'mortgage-payment', label: 'Current monthly payment', value: `${formatCurrency(monthlyPayment)}/mo` },
    { id: 'mortgage-balance', label: 'Remaining principal', value: formatCurrencyCompact(loanAmount) },
    { id: 'mortgage-payoff', label: 'Payoff date', value: formatPayoffDate(originalSchedule.payoffMonths) },
    ...(hasExtraPayment
      ? [{ id: 'mortgage-payoff-extra', label: 'Payoff date, with extra', value: formatPayoffDate(withExtraSchedule.payoffMonths) }]
      : []),
    { id: 'mortgage-payment-inspect', label: 'Monthly payment, inspect yr', value: `${formatCurrency(inspectPoint.monthlyPaymentNominal)}/mo` },
  ];

  if (!owns) {
    return (
      <div className="app-shell">
        <div className="app-shell__main">
          <p className="mortgage-page__empty">
            You've told the Home tab you rent, not own — the mortgage calculator applies once you own a home. Switch
            the housing toggle on the Home tab to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell" data-mobile-tab={mobileTab}>
      <aside className="app-shell__sidebar">
        <div className="controls-panel">
          <ControlGroup group={MORTGAGE_DETAILS_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={TAXES_INSURANCE_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={EXTRA_PAYMENTS_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
          <ControlGroup group={APPRECIATION_GROUP} ranges={ranges} values={baseInputs} onChange={onChange} />
        </div>
      </aside>

      <div className="app-shell__main">
        <div className="app-shell__chart">
          <CollapsibleChart>
            <MortgageChart
              originalBalances={originalBalances}
              withExtraBalances={withExtraBalances}
              hasExtraPayment={hasExtraPayment}
              originalPayoffYear={originalPayoffYear}
              withExtraPayoffYear={withExtraPayoffYear}
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
          <div className="inspect-year-control">
            <SliderField meta={MORTGAGE_INSPECT_YEAR_FIELD} range={inspectRange} value={inspectYear} onChange={onChange} />
          </div>
          <MetricCards metrics={metrics} />
          <div className="breakdown-table-wrap">
            <div className="breakdown-table__title">Year {inspectYear} payment detail</div>
            <table className="breakdown-table">
              <tbody>
                <Row label="Remaining balance" value={formatCurrency(inspectPoint.closingBalance)} muted />
                <Row label="Principal & interest" value={`${formatCurrency(originalSchedule.monthlyPaymentPI)}/mo`} muted />
                <Row label="Mortgage insurance" value={inspectInsuranceValue} muted />
                <Row
                  label="Property tax, inflated"
                  value={monthlyPropertyTax > 0 ? `${formatCurrency(propertyTaxAtInspect)}/mo` : 'None'}
                  muted
                />
                <Row
                  label="Homeowners insurance, inflated"
                  value={monthlyHomeInsurance > 0 ? `${formatCurrency(homeInsuranceAtInspect)}/mo` : 'None'}
                  muted
                />
                {hasExtraPayment && (
                  <Row label="Extra principal" value={`${formatCurrency(baseInputs.mortgageExtraPrincipalMo)}/mo`} muted />
                )}
                <tr className="breakdown-table__divider">
                  <td colSpan={2} />
                </tr>
                <Row label="Total monthly payment, nominal" value={`${formatCurrency(inspectPoint.monthlyPaymentNominal)}/mo`} />
                <Row label="— vs. today's payment" value={`${formatCurrency(monthlyPayment)}/mo`} muted />
                <tr className="breakdown-table__divider">
                  <td colSpan={2} />
                </tr>
                <Row label="Total interest, original schedule" value={formatCurrency(totalInterestOriginal)} muted />
                {hasExtraPayment && (
                  <>
                    <Row label="Total interest, with extra payments" value={formatCurrency(totalInterestWithExtra)} muted />
                    <Row label="Interest saved" value={formatCurrency(interestSaved)} />
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
