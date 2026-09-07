import { ownsHome, type Answers } from './questions';
import type { SliderFormat } from './format';

export type BaseFieldId =
  | 'expensesMo'
  | 'housingPaymentMo'
  | 'housingPrincipalInterestMo'
  | 'homeValueK'
  | 'mortgageBalanceK'
  | 'currentMortgageRatePct'
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
  | 'inspectYear'
  | 'retirementRothSavingsTodayK'
  | 'retirementRothContributionMo'
  | 'retirementRothWithdrawalRatePct'
  | 'retirementTraditionalSavingsTodayK'
  | 'retirementTraditionalContributionMo'
  | 'retirementTraditionalWithdrawalRatePct'
  | 'retirementSocialSecurityMo'
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
          'Your current all-in monthly housing payment — rent, or mortgage P&I plus escrow. Automatically replaced by the estimated mortgage payment once a property-purchase goal completes.',
      },
      {
        id: 'housingPrincipalInterestMo',
        label: '— of which P&I (current)',
        format: '$',
        tooltip: 'The principal and interest slice of your mortgage payment. Fixed forever; the remainder is escrow, which inflates.',
        visibleIf: ownsHome,
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
      {
        id: 'homeValueK',
        label: 'Home value (current)',
        format: 'k',
        tooltip: 'Current market value of your home. Reflects your current home only, not a future purchase.',
        visibleIf: ownsHome,
      },
      {
        id: 'mortgageBalanceK',
        label: 'Mortgage balance (current)',
        format: 'k',
        tooltip: 'Remaining principal owed on your current mortgage. Reflects your current home only, not a future purchase.',
        visibleIf: ownsHome,
      },
      {
        id: 'currentMortgageRatePct',
        label: 'Mortgage rate (current)',
        format: '%',
        tooltip:
          "Your current mortgage's interest rate - used to project how much of it you'll have paid off (and how much home equity you'll have) by the time you roll it into a future purchase.",
        visibleIf: ownsHome,
      },
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
    fields: [
      {
        id: 'inflationPct',
        label: 'Inflation',
        format: '%',
        tooltip: 'Applied to living costs, taxes, insurance and maintenance. Not applied to fixed mortgage P&I.',
      },
      {
        id: 'investmentReturnPct',
        label: 'Investment return',
        format: '%',
        tooltip: 'Nominal annual return on invested assets and every accumulating goal.',
      },
    ],
  },
];

/** Rendered next to the results it controls (the breakdown table) rather than in the sidebar. */
export const INSPECT_YEAR_FIELD: BaseFieldMeta = {
  id: 'inspectYear',
  label: 'Inspect year',
  format: 'yr',
  tooltip: 'Which year the detail table below shows.',
};

/** Rendered on the Retirement page's own sidebar/chart, not the primary page's ControlsPanel -
 *  same reasoning as INSPECT_YEAR_FIELD above, just a different page. Investment return and other
 *  assumptions used in the retirement projection are read straight from BASE_FIELD_GROUPS's
 *  Assumptions group instead of being duplicated here. Split into Roth/Traditional pairs since the
 *  two are taxed differently (see tax.ts) and tracked as independent balances (see retirement.ts). */
export const RETIREMENT_ROTH_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementRothSavingsTodayK',
  label: 'Current Roth savings',
  format: 'k',
  tooltip: 'Your current Roth 401(k)/IRA balance(s) today. Withdrawals in retirement are tax-free.',
};

export const RETIREMENT_ROTH_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementRothContributionMo',
  label: 'Monthly contribution',
  format: '$',
  tooltip: 'How much you contribute to Roth accounts each month.',
};

export const RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD: BaseFieldMeta = {
  id: 'retirementRothWithdrawalRatePct',
  label: 'Initial withdrawal rate',
  format: '%',
  tooltip:
    'Share of your projected Roth balance withdrawn in your first year of retirement (the "4% rule" is the common default). After that, the dollar amount grows with inflation each year rather than being re-applied to your balance - so the withdrawal keeps climbing in nominal terms even at a fixed rate. A rule-of-thumb estimate, not a full drawdown simulation.',
};

export const RETIREMENT_TRADITIONAL_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalSavingsTodayK',
  label: 'Current Traditional savings',
  format: 'k',
  tooltip: 'Your current Traditional 401(k)/IRA balance(s) today. Withdrawals in retirement are taxed as ordinary income.',
};

export const RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalContributionMo',
  label: 'Monthly contribution',
  format: '$',
  tooltip: 'How much you contribute to Traditional accounts each month.',
};

export const RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD: BaseFieldMeta = {
  id: 'retirementTraditionalWithdrawalRatePct',
  label: 'Initial withdrawal rate',
  format: '%',
  tooltip:
    'Share of your projected Traditional balance withdrawn in your first year of retirement (the "4% rule" pattern). After that, the dollar amount grows with inflation each year rather than being re-applied to your balance. Taxed as ordinary income - see the income breakdown table below the chart.',
};

export const RETIREMENT_SOCIAL_SECURITY_FIELD: BaseFieldMeta = {
  id: 'retirementSocialSecurityMo',
  label: 'Social Security benefit',
  format: '$',
  tooltip:
    "Estimated monthly Social Security benefit, in today's dollars (grows with inflation like your other today's-dollar inputs). Up to 85% of it can be taxable alongside your Traditional withdrawals - and since the IRS thresholds that decide how much is taxable are fixed in nominal dollars (frozen since 1984/1993, never inflation-indexed), a growing share becomes taxable purely from nominal income growth over time. See the income breakdown table below the chart.",
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
  RETIREMENT_ROTH_SAVINGS_FIELD.id,
  RETIREMENT_ROTH_CONTRIBUTION_FIELD.id,
  RETIREMENT_ROTH_WITHDRAWAL_RATE_FIELD.id,
  RETIREMENT_TRADITIONAL_SAVINGS_FIELD.id,
  RETIREMENT_TRADITIONAL_CONTRIBUTION_FIELD.id,
  RETIREMENT_TRADITIONAL_WITHDRAWAL_RATE_FIELD.id,
  RETIREMENT_SOCIAL_SECURITY_FIELD.id,
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
