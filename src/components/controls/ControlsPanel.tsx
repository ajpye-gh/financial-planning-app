import { ControlGroup } from './ControlGroup';
import { visibleBaseFieldGroups, type BaseFieldId } from '../../lib/baseFields';
import type { Answers } from '../../lib/questions';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';

interface ControlsPanelProps {
  answers: Answers;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
}

export function ControlsPanel({ answers, ranges, values, onChange }: Readonly<ControlsPanelProps>) {
  return (
    <div className="controls-panel">
      {visibleBaseFieldGroups(answers).map((group) => (
        <ControlGroup key={group.title} group={group} ranges={ranges} values={values} onChange={onChange} />
      ))}
    </div>
  );
}
