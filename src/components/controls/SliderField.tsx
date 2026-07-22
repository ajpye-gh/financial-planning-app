import { Tooltip } from '../Tooltip';
import { formatSliderValue } from '../../lib/format';
import type { SliderRange } from '../../lib/baseData';
import type { BaseFieldId, BaseFieldMeta } from '../../lib/baseFields';

interface SliderFieldProps {
  meta: BaseFieldMeta;
  range: SliderRange;
  value: number;
  onChange: (id: BaseFieldId, value: number) => void;
}

export function SliderField({ meta, range, value, onChange }: Readonly<SliderFieldProps>) {
  return (
    <div className="slider-field">
      <label className="slider-field__label" htmlFor={meta.id}>
        <Tooltip tip={meta.tooltip}>{meta.label}</Tooltip>
      </label>
      <div className="slider-field__control">
        <input
          id={meta.id}
          className="slider-field__input"
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(event) => onChange(meta.id, Number(event.target.value))}
        />
        <span className="slider-field__value">{formatSliderValue(value, meta.format)}</span>
      </div>
    </div>
  );
}
