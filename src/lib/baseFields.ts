import { ownsHome, type Answers } from './questions';
import type { SliderFormat } from './format';

export type BaseFieldId =
  | 'expensesMo'
  | 'housingPaymentMo'
  | 'homeValueK'
  | 'mortgageBalanceK'
  | 'currentMortgageRatePct'
  | 'mortgageTermYears'
  | 'mortgageInsuranceMo'
  | 'homeInsuranceMo'
  | 'propertyTaxMo'
  | 'mortgageExtraPrincipalMo'
  | 'cashTodayK'
  | 'brokerageTodayK'
  | 'salaryY0K'
  | 'salaryGrowthAfterY10Pct'
  | 'netKeepRatePct'
  | 'annualBonusK'
  | 'partnerSalaryY0K'
  | 'partnerSalaryGrowthAfterY10Pct'
  | 'partnerNetKeepRatePct'
  | 'partnerAnnualBonusK'
  | 'costPerKidMo'
  | 'inflationPct'
  | 'investmentReturnPct'
  | 'cashGrowthPct'
  | 'inspectYear'
  | 'retirementRothSavingsTodayK'
  | 'retirementRothContributionMo'
  | 'retirementRothWithdrawalMo'
  | 'retirementTraditionalSavingsTodayK'
  | 'retirementTraditionalContributionMo'
  | 'retirementTraditionalWithdrawalMo'
  | 'retirementAfterTaxSavingsTodayK'
  | 'retirementAfterTaxContributionMo'
  | 'retirementAfterTaxWithdrawalMo'
  | 'retirementAfterTaxGainPct'
  | 'retirementSocialSecurityMo'
  | 'retirementPensionMo'
  | 'retirementPensionStartAge'
  | 'retirementCurrentAge'
  | 'retirementTargetAge'
  | 'retirementInspectAge';

export interface BaseFieldMeta {
  id: BaseFieldId;
  label: string;
  format: SliderFormat;
  tooltip: string;
  /** Field is hidden unless this returns true. Always shown if omitted. */
  visibleIf?: (answers: Answers) => boolean;
}

export interface BaseFieldGroup {
  title: string;
  fields: BaseFieldMeta[];
}

/** Exported (not just inlined below) so the Mortgage page can reuse the exact same field - same
 *  balance either way, just relevant on both pages (roll-down of the existing loan vs. this page's
 *  sidebar summary). */
export const HOME_VALUE_FIELD: BaseFieldMeta = {
  id: 'homeValueK',
  label: 'Home value (current)',
  format: 'k',
  tooltip: 'Current market value of your home. Reflects your current home only, not a future purchase.',
  visibleIf: ownsHome,
};

export const MORTGAGE_BALANCE_FIELD: BaseFieldMeta = {
  id: 'mortgageBalanceK',
  label: 'Mortgage balance (current)',
  format: 'k',
  tooltip: 'Remaining principal owed on your current mortgage. Reflects your current home only, not a future purchase.',
  visibleIf: ownsHome,
};

export const MORTGAGE_RATE_FIELD: BaseFieldMeta = {
  id: 'currentMortgageRatePct',
  label: 'Mortgage rate (current)',
  format: '%',
  tooltip:
    "Your current mortgage's interest rate - drives both the Mortgage tab's amortization schedule and how much of it you'll have paid off (home equity) by the time you roll it into a future purchase.",
  visibleIf: ownsHome,
};

export const INFLATION_FIELD: BaseFieldMeta = {
  id: 'inflationPct',
  label: 'Inflation',
  format: '%',
  tooltip:
    'Applied to living costs, taxes, insurance/maintenance escrow, and home appreciation. Not applied to fixed mortgage principal & interest.',
};

export const CASH_GROWTH_FIELD: BaseFieldMeta = {
  id: 'cashGrowthPct',
  label: 'Cash growth',
  format: '%',
  tooltip:
    "Annual growth on your Emergency fund balance - kept low and separate from Investment return since emergency savings sit in cash/savings accounts, not the market.",
};

export const INVESTMENT_RETURN_FIELD: BaseFieldMeta = {
  id: 'investmentReturnPct',
  label: 'Investment return',
  format: '%',
  tooltip: 'Nominal annual return on invested assets and every accumulating goal.',
};

export const BASE_FIELD_GROUPS: BaseFieldGroup[] = [
  {
    title: 'Income',
    fields: [
      { id: 'salaryY0K', label: 'Salary, yr 0 (today)', format: 'k', tooltip: 'Your current gross base salary.' },
      {
        id: 'salaryGrowthAfterY10Pct',
        label: 'Growth after last raise',
        format: '%',
        tooltip: 'Annual growth applied after your final salary raise breakpoint.',
      },
      {
        id: 'netKeepRatePct',
        label: 'Net keep rate',
        format: '%',
        tooltip:
          "Share of your gross salary you keep after tax and benefits - applied to your whole salary, today and every future raise. Retirement contributions aren't included here; track them on the Retirement page instead. Your derived net income /mo is shown alongside; adjust the slider until it matches your real take-home pay.",
      },
      {
        id: 'annualBonusK',
        label: 'Annual bonus',
        format: 'k',
        tooltip:
          "Yearly bonus, in today's dollars, on top of salary. Taxed at the same net keep rate as your salary above. Stays flat over the horizon rather than growing automatically - like your salary, it only changes when you change it.",
      },
    ],
  },
  {
    title: 'Partner income',
    fields: [
      {
        id: 'partnerSalaryY0K',
        label: 'Salary, yr 0 (today)',
        format: 'k',
        tooltip: "Your spouse or partner's current gross base salary. Leave at $0 if this doesn't apply.",
      },
      {
        id: 'partnerSalaryGrowthAfterY10Pct',
        label: 'Growth after last raise',
        format: '%',
        tooltip: "Annual growth applied after their final salary raise breakpoint.",
      },
      {
        id: 'partnerNetKeepRatePct',
        label: 'Net keep rate',
        format: '%',
        tooltip:
          "Share of their gross salary they keep after tax and benefits - applied the same way as your own Net keep rate above.",
      },
      {
        id: 'partnerAnnualBonusK',
        label: 'Annual bonus',
        format: 'k',
        tooltip:
          "Their yearly bonus, in today's dollars, on top of salary. Taxed at the same net keep rate as their salary above. Stays flat over the horizon, same as your own bonus.",
      },
    ],
  },
  {
    title: 'Expenses',
    fields: [
      {
        id: 'expensesMo',
        label: 'Expenses /mo',
        format: '$',
        tooltip: 'Total monthly spending today, including your housing payment.',
      },
      {
        id: 'housingPaymentMo',
        label: 'Housing payment (current)',
        format: '$',
        tooltip:
          "Your current all-in monthly housing payment — rent, or mortgage payment plus escrow. If you own, the principal & interest slice is now computed from the Mortgage tab's rate/term/balance instead of set here; the remainder is escrow, which inflates. Automatically replaced by the estimated mortgage payment once a property-purchase goal completes.",
      },
      {
        id: 'costPerKidMo',
        label: 'Cost per child /mo',
        format: '$',
        tooltip:
          "Incremental monthly cost per child, in today's dollars. Add each child below with the year they arrive (or stay at 0 if they're already part of your household).",
      },
    ],
  },
  {
    title: 'Assets',
    fields: [
      HOME_VALUE_FIELD,
      MORTGAGE_BALANCE_FIELD,
      {
        id: 'brokerageTodayK',
        label: 'Brokerage today',
        format: 'k',
        tooltip: 'After-tax investments that could be sold — your unallocated savings pool.',
      },
      {
        id: 'cashTodayK',
        label: 'Cash today',
        format: 'k',
        tooltip: 'Current emergency savings.',
      },
    ],
  },
  {
    title: 'Assumptions',
    fields: [INFLATION_FIELD, CASH_GROWTH_FIELD, INVESTMENT_RETURN_FIELD],
  },
];

/** Rendered next to the results it controls (the breakdown table) rather than in the sidebar. */
export const INSPECT_YEAR_FIELD: BaseFieldMeta = {
  id: 'inspectYear',
  label: 'Inspect year',
  format: 'yr',
  tooltip: 'Which year the detail table below shows.',
};

/** Rendered on the Mortgage page's own sidebar, not the primary page's ControlsPanel - same
 *  reasoning as the retirement fields below, just a different page. Home value/balance/rate are
 *  reused as-is from the Assets group above (HOME_VALUE_FIELD etc.) rather than duplicated here. */
export const MORTGAGE_TERM_FIELD: BaseFieldMeta = {
  id: 'mortgageTermYears',
  label: 'Loan term',
  format: 'yr',
  tooltip:
    "Length of your mortgage, in years (e.g. 30 or 15). Combined with the balance and rate above, this determines your required principal & interest payment - it's no longer a number you set directly.",
  visibleIf: ownsHome,
};

export const MORTGAGE_INSURANCE_FIELD: BaseFieldMeta = {
  id: 'mortgageInsuranceMo',
  label: 'Mortgage insurance',
  format: '$',
  tooltip:
    "Monthly PMI/MIP, in today's dollars. Automatically drops off the payment once your projected home equity reaches 20% - lenders no longer require it past that point - so this only affects the payment before then.",
  visibleIf: ownsHome,
};

export const PROPERTY_TAX_FIELD: BaseFieldMeta = {
  id: 'propertyTaxMo',
  label: 'Property tax',
  format: '$',
  tooltip:
    "Monthly property tax, in today's dollars. Unlike PMI above, this never drops off - it's part of your payment for as long as you own the home.",
  visibleIf: ownsHome,
};

export const HOME_INSURANCE_FIELD: BaseFieldMeta = {
  id: 'homeInsuranceMo',
  label: 'Homeowners insurance',
  format: '$',
  tooltip:
    "Monthly hazard/homeowners insurance, in today's dollars - not to be confused with PMI above. Also never drops off.",
  visibleIf: ownsHome,
};

export const MORTGAGE_EXTRA_PRINCIPAL_FIELD: BaseFieldMeta = {
  id: 'mortgageExtraPrincipalMo',
  label: 'Extra principal /mo',
  format: '$',
  tooltip:
    'Optional additional amount applied straight to principal every month, on top of your required payment - shortens the loan and moves your payoff date earlier. Shown on the chart as a second line against the original schedule.',
  visibleIf: ownsHome,
};

/** Rendered on the Retirement page's own sidebar/chart, not the primary page's ControlsPanel -
 *  same reasoning as INSPECT_YEAR_FIELD above, just a different page. Investment return and other
 *  assumptions used in the retirement projection are read straight from BASE_FIELD_GROUPS's
 *  Assumptions group instead of being duplicated here. Split into Roth/Traditional pairs since the
 *  two are taxed differently (see tax.ts) and tracked as independent balances (see retirement.ts). */
// Shared across the Roth/Traditional/After-tax field trios below - each pot has its own field
// object (different id/tooltip), but the slider label itself is identical across all three.
const RETIREMENT_CONTRIBUTION_LABEL = 'Monthly contribution';
// Dollar amount is the primary, directly-editable figure (users relate to a monthly income target
// far more readily than a withdrawal rate) - the equivalent "4% rule"-style rate is still shown, but
// only as derived, secondary text next to the slider (see RetirementPage.tsx's valueLabelForField),
// never as its own control.
const RETIREMENT_WITHDRAWAL_LABEL = 'Initial monthly withdrawal';

export const RETIREMENT_ROTH_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementRothSavingsTodayK',
  label: 'Current Roth savings',
  format: 'k',
  tooltip: 'Your current Roth 401(k)/IRA balance(s) today. Withdrawals in retirement are tax-free.',
};

export const RETIREMENT_ROTH_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementRothContributionMo',
  label: RETIREMENT_CONTRIBUTION_LABEL,
  format: '$',
  tooltip: 'How much you contribute to Roth accounts each month.',
};

export const RETIREMENT_ROTH_WITHDRAWAL_FIELD: BaseFieldMeta = {
  id: 'retirementRothWithdrawalMo',
  label: RETIREMENT_WITHDRAWAL_LABEL,
  format: '$',
  tooltip:
    "The monthly income you plan to draw from Roth savings in your first year of retirement, in today's dollars. The equivalent share of your projected balance (the \"4% rule\" is the common default) is shown alongside it. After that first year, the dollar amount grows with inflation each year rather than being re-applied to your balance - so the withdrawal keeps climbing in nominal terms even at a fixed rate. A rule-of-thumb estimate, not a full drawdown simulation.",
};

export const RETIREMENT_TRADITIONAL_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalSavingsTodayK',
  label: 'Current Traditional savings',
  format: 'k',
  tooltip:
    'Your current Traditional 401(k)/IRA balance(s) today. Withdrawals in retirement are taxed as ordinary income - and if taken before age 60 (the real early-withdrawal age, rounded from 59½), also hit with a 10% IRS penalty. Required Minimum Distributions kick in at age 73 regardless of your withdrawal rate below - see the income breakdown table below the chart.',
};

export const RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalContributionMo',
  label: RETIREMENT_CONTRIBUTION_LABEL,
  format: '$',
  tooltip: 'How much you contribute to Traditional accounts each month.',
};

export const RETIREMENT_TRADITIONAL_WITHDRAWAL_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalWithdrawalMo',
  label: RETIREMENT_WITHDRAWAL_LABEL,
  format: '$',
  tooltip:
    "The monthly income you plan to draw from Traditional savings in your first year of retirement, in today's dollars. The equivalent share of your projected balance (the \"4% rule\" pattern) is shown alongside it. After that first year, the dollar amount grows with inflation each year rather than being re-applied to your balance - unless a Required Minimum Distribution (starting age 73) would force a bigger withdrawal than this produces, in which case the RMD wins. Taxed as ordinary income - see the income breakdown table below the chart.",
};

export const RETIREMENT_AFTER_TAX_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementAfterTaxSavingsTodayK',
  label: 'Current after-tax savings',
  format: 'k',
  tooltip: 'Your current taxable brokerage balance(s) today - already-taxed money, unlike Roth/Traditional retirement accounts.',
};

export const RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementAfterTaxContributionMo',
  label: RETIREMENT_CONTRIBUTION_LABEL,
  format: '$',
  tooltip: 'How much you contribute to after-tax (brokerage) accounts each month.',
};

export const RETIREMENT_AFTER_TAX_WITHDRAWAL_FIELD: BaseFieldMeta = {
  id: 'retirementAfterTaxWithdrawalMo',
  label: RETIREMENT_WITHDRAWAL_LABEL,
  format: '$',
  tooltip:
    "The monthly income you plan to draw from after-tax (brokerage) savings in your first year of retirement, in today's dollars. The equivalent share of your projected balance (the \"4% rule\" pattern) is shown alongside it. After that first year, the dollar amount grows with inflation each year rather than being re-applied to your balance.",
};

export const RETIREMENT_AFTER_TAX_GAIN_FIELD: BaseFieldMeta = {
  id: 'retirementAfterTaxGainPct',
  label: 'Taxable gain %',
  format: '%',
  tooltip:
    "Share of every after-tax withdrawal that's investment gain rather than a tax-free return of your original cost basis - e.g. 40% means $4 of every $10 withdrawn is taxable. That gain slice is taxed at a flat long-term capital gains rate, separate from your ordinary-income brackets.",
};

export const RETIREMENT_SOCIAL_SECURITY_FIELD: BaseFieldMeta = {
  id: 'retirementSocialSecurityMo',
  label: 'Social Security benefit',
  format: '$',
  tooltip:
    "Estimated monthly Social Security benefit, in today's dollars (grows with inflation like your other today's-dollar inputs). Never starts before age 62 (the real earliest claiming age), even if you retire earlier. Up to 85% of it can be taxable alongside your Traditional withdrawals - and since the IRS thresholds that decide how much is taxable are fixed in nominal dollars (frozen since 1984/1993, never inflation-indexed), a growing share becomes taxable purely from nominal income growth over time. See the income breakdown table below the chart. Use the toggle above to exclude Social Security from the plan entirely, rather than dragging this to $0.",
};

export const RETIREMENT_PENSION_FIELD: BaseFieldMeta = {
  id: 'retirementPensionMo',
  label: 'Pension/other income',
  format: '$',
  tooltip:
    "A pension, annuity, or other fully-taxable income source, in today's dollars (grows with inflation like Social Security). Starts at the age set below, independent of your retirement age. Taxed as ordinary income alongside Traditional withdrawals. Leave at $0 if this doesn't apply.",
};

export const RETIREMENT_PENSION_START_AGE_FIELD: BaseFieldMeta = {
  id: 'retirementPensionStartAge',
  label: 'Pension start age',
  format: 'n',
  tooltip: 'Age this income source begins - not necessarily the same as your retirement age.',
};

/** Rendered on the Retirement page's own sidebar - ages, rather than a raw year offset, are what
 *  the rest of the retirement fields (and the chart's x-axis) are expressed in terms of. */
export const RETIREMENT_CURRENT_AGE_FIELD: BaseFieldMeta = {
  id: 'retirementCurrentAge',
  label: 'Current age',
  format: 'n',
  tooltip: 'Your age today - used to translate the target/inspect ages and the chart below into actual ages instead of a plain year count.',
};

export const RETIREMENT_TARGET_AGE_FIELD: BaseFieldMeta = {
  id: 'retirementTargetAge',
  label: 'Target retirement age',
  format: 'n',
  tooltip: "Age you plan to retire at. If it's at or before your current age, the drawdown starts immediately (same as if you're already retired).",
};

/** Rendered next to the breakdown table it controls, same as INSPECT_YEAR_FIELD above - separate
 *  from Target age, since that's "when do you retire" (an input the whole projection depends on)
 *  while this is "which age's numbers am I looking at" (a view into the already-computed
 *  projection, which now always runs through MAX_PROJECTION_AGE in retirement.ts - this field's max
 *  below should match that constant). RetirementPage still clamps the effective lookup at read time,
 *  since this slider and Current age move independently of each other. */
export const RETIREMENT_INSPECT_AGE_FIELD: BaseFieldMeta = {
  id: 'retirementInspectAge',
  label: 'Inspect age',
  format: 'n',
  tooltip: "Which age the breakdown table below shows - income (and whether an account has run dry) changes year to year, especially once you're retired.",
};

export const ALL_BASE_FIELD_IDS: BaseFieldId[] = [
  ...BASE_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.id)),
  INSPECT_YEAR_FIELD.id,
  MORTGAGE_RATE_FIELD.id,
  MORTGAGE_TERM_FIELD.id,
  MORTGAGE_INSURANCE_FIELD.id,
  PROPERTY_TAX_FIELD.id,
  HOME_INSURANCE_FIELD.id,
  MORTGAGE_EXTRA_PRINCIPAL_FIELD.id,
  RETIREMENT_ROTH_SAVINGS_FIELD.id,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD.id,
  RETIREMENT_ROTH_WITHDRAWAL_FIELD.id,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD.id,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD.id,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_FIELD.id,
  RETIREMENT_AFTER_TAX_SAVINGS_FIELD.id,
  RETIREMENT_AFTER_TAX_CONTRIBUTION_FIELD.id,
  RETIREMENT_AFTER_TAX_WITHDRAWAL_FIELD.id,
  RETIREMENT_AFTER_TAX_GAIN_FIELD.id,
  RETIREMENT_SOCIAL_SECURITY_FIELD.id,
  RETIREMENT_PENSION_FIELD.id,
  RETIREMENT_PENSION_START_AGE_FIELD.id,
  RETIREMENT_CURRENT_AGE_FIELD.id,
  RETIREMENT_TARGET_AGE_FIELD.id,
  RETIREMENT_INSPECT_AGE_FIELD.id,
];

/** Groups filtered down to their currently-visible fields; groups left with no visible fields are dropped entirely. */
export function visibleBaseFieldGroups(answers: Answers): BaseFieldGroup[] {
  return BASE_FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => !field.visibleIf || field.visibleIf(answers)),
  })).filter((group) => group.fields.length > 0);
}
