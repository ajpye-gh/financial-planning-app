import { ownsHome, type Answers } from './questions';
import type { SliderFormat } from './format';

export type BaseFieldId =
  | 'netIncomeMo'
  | 'expensesMo'
  | 'housingPaymentMo'
  | 'housingPrincipalInterestMo'
  | 'homeValueK'
  | 'mortgageBalanceK'
  | 'cashTodayK'
  | 'brokerageTodayK'
  | 'reserveTargetK'
  | 'salaryY0K'
  | 'salaryRaiseY1K'
  | 'salaryRaiseY4K'
  | 'salaryRaiseY6K'
  | 'salaryRaiseY10K'
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
      {
        id: 'netIncomeMo',
        label: 'Net income /mo',
        format: '$',
        tooltip: 'Household take-home per month today, after tax, benefits and retirement contributions.',
      },
      { id: 'salaryY0K', label: 'Salary, yr 0 (today)', format: 'k', tooltip: 'Your current gross base salary.' },
      {
        id: 'salaryRaiseY1K',
        label: 'Raise by yr 1',
        format: 'k',
        tooltip: "How much more gross salary you expect by year 1, above today's — not an absolute target, so raising \"today\" shifts this with it.",
      },
      {
        id: 'salaryRaiseY4K',
        label: 'Raise by yr 4',
        format: 'k',
        tooltip: "How much more gross salary you expect by year 4, above today's.",
      },
      {
        id: 'salaryRaiseY6K',
        label: 'Raise by yr 6',
        format: 'k',
        tooltip: "How much more gross salary you expect by year 6, above today's.",
      },
      {
        id: 'salaryRaiseY10K',
        label: 'Raise by yr 10',
        format: 'k',
        tooltip: "How much more gross salary you expect by year 10, above today's.",
      },
      {
        id: 'salaryGrowthAfterY10Pct',
        label: 'Growth after yr 10',
        format: '%',
        tooltip: 'Annual growth past year 10, once milestone-based projections run out.',
      },
      {
        id: 'netKeepRatePct',
        label: 'Net keep rate',
        format: '%',
        tooltip: 'Share of each additional gross dollar you keep after taxes and deductions. Marginal, not average.',
      },
      {
        id: 'partnerNetIncomeMo',
        label: "Partner's income /mo",
        format: '$',
        tooltip: "Your spouse or partner's monthly take-home contribution.",
        visibleIf: (a) => a.hasPartnerIncome === true,
      },
      {
        id: 'partnerIncomeStopsYear',
        label: 'Partner income stops in yr',
        format: 'yr',
        tooltip: 'Year that income ends (e.g. to stay home with kids). Set beyond your horizon for "never."',
        visibleIf: (a) => a.hasPartnerIncome === true,
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
        tooltip: 'Children beyond your current household, arriving roughly every 2.5 years.',
        visibleIf: (a) => a.hasKids === true,
      },
      {
        id: 'costPerKidMo',
        label: 'Cost per kid /mo',
        format: '$',
        tooltip: "Incremental monthly cost per additional child in today's dollars.",
        visibleIf: (a) => a.hasKids === true,
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
