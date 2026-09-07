import { formatSliderValue } from '../../lib/format';
import type { SliderRange } from '../../lib/baseData';
import type { BaseFieldId, BaseFieldMeta } from '../../lib/baseFields';
import { Slider } from './Slider';

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

/** Thin adapter over the reusable `Slider` primitive for the app's base/retirement fields, which
 *  are described by a `BaseFieldMeta` rather than plain id/label/tooltip props. */
export function SliderField({ meta, range, value, onChange, valueLabel, disabled }: Readonly<SliderFieldProps>) {
  return (
    <Slider
      id={meta.id}
      label={meta.label}
      tooltip={meta.tooltip}
      range={range}
      value={value}
      onChange={(next) => onChange(meta.id, next)}
      valueLabel={valueLabel ?? formatSliderValue(value, meta.format)}
      formatBound={(bound) => formatSliderValue(bound, meta.format)}
      disabled={disabled}
    />
  );
}
