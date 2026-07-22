import { Fragment, useState, type ReactNode } from 'react';
import { SliderField } from './SliderField';
import type { BaseInputs, BaseRanges } from '../../lib/baseData';
import type { BaseFieldGroup, BaseFieldId } from '../../lib/baseFields';

interface ControlGroupProps {
  group: BaseFieldGroup;
  ranges: BaseRanges;
  values: BaseInputs;
  onChange: (id: BaseFieldId, value: number) => void;
  /** Lets a caller inject extra, non-slider content (e.g. a dynamic list editor) right after a
   *  specific field within this group. */
  renderAfterField?: (fieldId: BaseFieldId) => ReactNode;
}

export function ControlGroup({ group, ranges, values, onChange, renderAfterField }: Readonly<ControlGroupProps>) {
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
            <SliderField meta={field} range={ranges[field.id]} value={values[field.id]} onChange={onChange} />
            {renderAfterField?.(field.id)}
          </Fragment>
        ))}
    </div>
  );
}
