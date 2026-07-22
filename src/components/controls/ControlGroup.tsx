import { SliderField } from './SliderField';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import type { BaseFieldGroup, BaseFieldId } from '../../lib/baseFields';

interface ControlGroupProps {
  group: BaseFieldGroup;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
}

export function ControlGroup({ group, ranges, values, onChange }: Readonly<ControlGroupProps>) {
  return (
    <div className="control-group">
      <div className="control-group__title">{group.title}</div>
      {group.fields.map((field) => (
        <SliderField key={field.id} meta={field} range={ranges[field.id]} value={values[field.id]} onChange={onChange} />
      ))}
    </div>
  );
}
