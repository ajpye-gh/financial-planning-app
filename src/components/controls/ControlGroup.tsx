import { Fragment, useState, type ReactNode } from 'react';
import { SliderField } from './SliderField';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import type { BaseFieldGroup, BaseFieldId } from '../../lib/baseFields';

interface ControlGroupProps {
  group: BaseFieldGroup;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
  /** Lets a caller inject extra, non-slider content (e.g. a toggle) right before a specific field
   *  within this group. */
  renderBeforeField?: (fieldId: BaseFieldId) => ReactNode;
  /** Lets a caller inject extra, non-slider content (e.g. a dynamic list editor) right after a
   *  specific field within this group. */
  renderAfterField?: (fieldId: BaseFieldId) => ReactNode;
  /** Overrides a specific field's slider value display - e.g. to show a derived figure alongside it. */
  valueLabelForField?: (fieldId: BaseFieldId) => string | undefined;
  /** Disables a specific field's slider - e.g. Social Security's benefit slider while its toggle is
   *  off. See SliderField's own `disabled` prop for what that does. */
  disabledForField?: (fieldId: BaseFieldId) => boolean;
}

export function ControlGroup({
  group,
  ranges,
  values,
  onChange,
  renderBeforeField,
  renderAfterField,
  valueLabelForField,
  disabledForField,
}: Readonly<ControlGroupProps>) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="control-group">
      <button
        type="button"
        className="control-group__title"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        {group.title}
        <span className="control-group__chevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed &&
        group.fields.map((field) => (
          <Fragment key={field.id}>
            {renderBeforeField?.(field.id)}
            <SliderField
              meta={field}
              range={ranges[field.id]}
              value={values[field.id]}
              onChange={onChange}
              valueLabel={valueLabelForField?.(field.id)}
              disabled={disabledForField?.(field.id)}
            />
            {renderAfterField?.(field.id)}
          </Fragment>
        ))}
    </div>
  );
}
