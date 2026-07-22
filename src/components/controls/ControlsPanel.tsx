import { ControlGroup } from './ControlGroup';
import { SalaryRaiseBreakpoints } from './SalaryRaiseBreakpoints';
import { visibleBaseFieldGroups, type BaseFieldId } from '../../lib/baseFields';
import type { Answers } from '../../lib/questions';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import type { SalaryRaiseBreakpoint } from '../../lib/salaryRaises';

interface ControlsPanelProps {
  answers: Answers;
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
        />
      ))}
    </div>
  );
}
