import { ControlGroup } from './ControlGroup';
import { HousingToggle } from './HousingToggle';
import { SalaryRaiseBreakpoints } from './SalaryRaiseBreakpoints';
import { visibleBaseFieldGroups, type BaseFieldId } from '../../lib/baseFields';
import { formatCurrency, formatSliderValue } from '../../lib/format';
import { ownsHome, type Answers } from '../../lib/questions';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import type { SalaryRaiseBreakpoint } from '../../lib/salaryRaises';

interface ControlsPanelProps {
  answers: Answers;
  onAnswer: (id: string, value: boolean | string) => void;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
  salaryRaises: SalaryRaiseBreakpoint[];
  onAddSalaryRaise: () => void;
  onRemoveSalaryRaise: (id: string) => void;
  onUpdateSalaryRaise: (id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => void;
}

export function ControlsPanel({
  answers,
  onAnswer,
  ranges,
  values,
  onChange,
  salaryRaises,
  onAddSalaryRaise,
  onRemoveSalaryRaise,
  onUpdateSalaryRaise,
}: Readonly<ControlsPanelProps>) {
  return (
    <div className="controls-panel">
      <HousingToggle ownsHome={ownsHome(answers)} onChange={(owns) => onAnswer('housing', owns ? 'own' : 'rent')} />
      {visibleBaseFieldGroups(answers).map((group) => (
        <ControlGroup
          key={group.title}
          group={group}
          ranges={ranges}
          values={values}
          onChange={onChange}
          renderAfterField={
            group.title === 'Income'
              ? (fieldId) =>
                  fieldId === 'salaryY0K' ? (
                    <SalaryRaiseBreakpoints
                      breakpoints={salaryRaises}
                      onAdd={onAddSalaryRaise}
                      onRemove={onRemoveSalaryRaise}
                      onUpdate={onUpdateSalaryRaise}
                    />
                  ) : null
              : undefined
          }
          valueLabelForField={
            group.title === 'Income'
              ? (fieldId) => {
                  if (fieldId !== 'netKeepRatePct') {
                    return undefined;
                  }
                  const derivedMonthlyNet = (values.salaryY0K * 1000 * values.netKeepRatePct) / 100 / 12;
                  return `${formatSliderValue(values.netKeepRatePct, '%')} (${formatCurrency(derivedMonthlyNet)}/mo)`;
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
