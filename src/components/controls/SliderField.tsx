import { Tooltip } from '../Tooltip';
import { formatSliderValue } from '../../lib/format';
import type { SliderRange } from '../../lib/baseData';
import type { BaseFieldId, BaseFieldMeta } from '../../lib/baseFields';

interface SliderFieldProps {
  meta: BaseFieldMeta;
  range: SliderRange;
  value: number;
  onChange: (id: BaseFieldId, value: number) => void;
  /** Overrides the default `formatSliderValue(value, meta.format)` display - e.g. to append a
   *  derived figure alongside the raw value. */
  valueLabel?: string;
  /** Disables the input and dims the field - e.g. Social Security's benefit slider once the
   *  SocialSecurityToggle above it is switched off (see RetirementPage.tsx). The stored value is
   *  left untouched so re-enabling restores it; the caller is responsible for not feeding a
   *  disabled field's value into the model. */
  disabled?: boolean;
}

export function SliderField({ meta, range, value, onChange, valueLabel, disabled }: Readonly<SliderFieldProps>) {
  return (
    <div className={disabled ? 'slider-field slider-field--disabled' : 'slider-field'}>
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
          disabled={disabled}
          onChange={(event) => onChange(meta.id, Number(event.target.value))}
        />
        <span className="slider-field__value">{valueLabel ?? formatSliderValue(value, meta.format)}</span>
      </div>
    </div>
  );
}
