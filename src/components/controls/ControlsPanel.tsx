import type { ReactNode } from 'react';
import { ChildBreakpoints, type ChildBreakpointsProps } from './ChildBreakpoints';
import { ControlGroup } from './ControlGroup';
import { HousingToggle } from './HousingToggle';
import { SalaryRaiseBreakpoints, type SalaryRaiseBreakpointsProps } from './SalaryRaiseBreakpoints';
import { visibleBaseFieldGroups, type BaseFieldId } from '../../lib/baseFields';
import { formatCurrency, formatSliderValue } from '../../lib/format';
import { ownsHome, type Answers } from '../../lib/questions';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';

interface IncomeGroupConfig {
  title: string;
  salaryFieldId: BaseFieldId;
  keepRateFieldId: BaseFieldId;
  controls: SalaryRaiseBreakpointsProps;
}

interface ControlsPanelProps {
  answers: Answers;
  onAnswer: (id: string, value: boolean | string) => void;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
  primaryIncomeControls: SalaryRaiseBreakpointsProps;
  partnerIncomeControls: SalaryRaiseBreakpointsProps;
  childrenControls: ChildBreakpointsProps;
}

export function ControlsPanel({
  answers,
  onAnswer,
  ranges,
  values,
  onChange,
  primaryIncomeControls,
  partnerIncomeControls,
  childrenControls,
}: Readonly<ControlsPanelProps>) {
  const incomeGroups: IncomeGroupConfig[] = [
    { title: 'Income', salaryFieldId: 'salaryY0K', keepRateFieldId: 'netKeepRatePct', controls: primaryIncomeControls },
    {
      title: 'Partner income',
      salaryFieldId: 'partnerSalaryY0K',
      keepRateFieldId: 'partnerNetKeepRatePct',
      controls: partnerIncomeControls,
    },
  ];

  return (
    <div className="controls-panel">
      {visibleBaseFieldGroups(answers).map((group) => {
        const incomeGroup = incomeGroups.find((candidate) => candidate.title === group.title);
        const isExpenses = group.title === 'Expenses';

        let renderAfterField: ((fieldId: BaseFieldId) => ReactNode) | undefined;
        if (incomeGroup) {
          renderAfterField = (fieldId) => (fieldId === incomeGroup.salaryFieldId ? <SalaryRaiseBreakpoints {...incomeGroup.controls} /> : null);
        } else if (isExpenses) {
          renderAfterField = (fieldId) => (fieldId === 'costPerKidMo' ? <ChildBreakpoints {...childrenControls} /> : null);
        }

        return (
          <ControlGroup
            key={group.title}
            group={group}
            ranges={ranges}
            values={values}
            onChange={onChange}
            renderBeforeField={
              isExpenses
                ? (fieldId) =>
                    fieldId === 'housingPaymentMo' ? (
                      <HousingToggle ownsHome={ownsHome(answers)} onChange={(owns) => onAnswer('housing', owns ? 'own' : 'rent')} />
                    ) : null
                : undefined
            }
            renderAfterField={renderAfterField}
            valueLabelForField={
              incomeGroup
                ? (fieldId) => {
                    if (fieldId !== incomeGroup.keepRateFieldId) {
                      return undefined;
                    }
                    const derivedMonthlyNet = (values[incomeGroup.salaryFieldId] * 1000 * values[incomeGroup.keepRateFieldId]) / 100 / 12;
                    return `${formatSliderValue(values[incomeGroup.keepRateFieldId], '%')} (${formatCurrency(derivedMonthlyNet)}/mo)`;
                  }
                : undefined
            }
          />
        );
      })}
    </div>
  );
}
