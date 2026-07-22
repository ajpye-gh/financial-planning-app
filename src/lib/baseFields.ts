import { ownsHome, type Answers } from './questions';
import type { SliderFormat } from './format';

export type BaseFieldId =
  | 'expensesMo'
  | 'housingPaymentMo'
  | 'housingPrincipalInterestMo'
  | 'homeValueK'
  | 'mortgageBalanceK'
  | 'cashTodayK'
  | 'brokerageTodayK'
  | 'reserveTargetK'
  | 'salaryY0K'
  | 'salaryGrowthAfterY10Pct'
  | 'netKeepRatePct'
  | 'partnerNetIncomeMo'
  | 'partnerIncomeStopsYear'
  | 'kidsAdded'
  | 'costPerKidMo'
  | 'inflationPct'
  | 'investmentReturnPct'
  | 'inspectYear';

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
          "Share of your gross salary you keep after tax and benefits - applied to your whole salary, today and every future raise. Retirement contributions aren't included here; add them as a Retirement savings goal instead. Your derived net income /mo is shown alongside; adjust the slider until it matches your real take-home pay.",
      },
      {
        id: 'partnerNetIncomeMo',
        label: "Partner's income /mo",
        format: '$',
        tooltip: "Your spouse or partner's monthly take-home contribution, added on top for the years they're working. Leave at $0 if this doesn't apply.",
      },
      {
        id: 'partnerIncomeStopsYear',
        label: 'Partner income stops in yr',
        format: 'yr',
        tooltip: 'Year that income ends (e.g. to stay home with kids). Set beyond your horizon for "never."',
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
        label: 'Housing payment',
        format: '$',
        tooltip: 'Your current all-in monthly housing payment — rent, or mortgage P&I plus escrow.',
      },
      {
        id: 'housingPrincipalInterestMo',
        label: '— of which P&I',
        format: '$',
        tooltip: 'The principal and interest slice of your mortgage payment. Fixed forever; the remainder is escrow, which inflates.',
        visibleIf: ownsHome,
      },
      {
        id: 'kidsAdded',
        label: 'Kids added',
        format: 'n',
        tooltip: "Children beyond your current household, arriving roughly every 2.5 years. Leave at 0 if this doesn't apply.",
      },
      {
        id: 'costPerKidMo',
        label: 'Cost per kid /mo',
        format: '$',
        tooltip: "Incremental monthly cost per additional child in today's dollars.",
      },
    ],
  },
  {
    title: 'Assets',
    fields: [
      {
        id: 'homeValueK',
        label: 'Home value',
        format: 'k',
        tooltip: 'Current market value of your home.',
        visibleIf: ownsHome,
      },
      {
        id: 'mortgageBalanceK',
        label: 'Mortgage balance',
        format: 'k',
        tooltip: 'Remaining principal owed on your current mortgage.',
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
        id: 'reserveTargetK',
        label: 'Reserve target',
        format: 'k',
        tooltip: 'Emergency fund goal. The model tops cash up to this before investing anything else.',
      },
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

export const ALL_BASE_FIELD_IDS: BaseFieldId[] = [
  ...BASE_FIELD_GROUPS.flatMap((group) => group.fields.map((field) => field.id)),
  INSPECT_YEAR_FIELD.id,
];

/** Groups filtered down to their currently-visible fields; groups left with no visible fields are dropped entirely. */
export function visibleBaseFieldGroups(answers: Answers): BaseFieldGroup[] {
  return BASE_FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => !field.visibleIf || field.visibleIf(answers)),
  })).filter((group) => group.fields.length > 0);
}
