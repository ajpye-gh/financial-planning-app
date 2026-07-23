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
  | 'partnerSalaryY0K'
  | 'partnerSalaryGrowthAfterY10Pct'
  | 'partnerNetKeepRatePct'
  | 'costPerKidMo'
  | 'inflationPct'
  | 'investmentReturnPct'
  | 'inspectYear'
  | 'retirementSavingsTodayK'
  | 'retirementContributionMo'
  | 'retirementTargetYear';

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
 *  Assumptions group instead of being duplicated here. */
export const RETIREMENT_SAVINGS_FIELD: BaseFieldMeta = {
  id: 'retirementSavingsTodayK',
  label: 'Current retirement savings',
  format: 'k',
  tooltip: 'Your current retirement account balance(s) today.',
};

export const RETIREMENT_CONTRIBUTION_FIELD: BaseFieldMeta = {
  id: 'retirementContributionMo',
  label: 'Monthly contribution',
  format: '$',
  tooltip: 'How much you contribute to retirement accounts each month.',
};

export const RETIREMENT_TARGET_YEAR_FIELD: BaseFieldMeta = {
  id: 'retirementTargetYear',
  label: 'Target year',
  format: 'yr',
  tooltip: 'Year you plan to retire by, counted from today (Y0).',
};

export const ALL_BASE_FIELD_IDS: BaseFieldId[] = [
  ...BASE_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.id)),
  INSPECT_YEAR_FIELD.id,
  RETIREMENT_SAVINGS_FIELD.id,
  RETIREMENT_CONTRIBUTION_FIELD.id,
  RETIREMENT_TARGET_YEAR_FIELD.id,
];

/** Groups filtered down to their currently-visible fields; groups left with no visible fields are dropped entirely. */
export function visibleBaseFieldGroups(answers: Answers): BaseFieldGroup[] {
  return BASE_FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => !field.visibleIf || field.visibleIf(answers)),
  })).filter((group) => group.fields.length > 0);
}
