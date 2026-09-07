import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Tooltip } from '../Tooltip';

export interface SliderBounds {
  min: number;
  max: number;
  step: number;
}

interface SliderProps {
  id: string;
  /** Visible label rendered above the track (wrapped in a `<label htmlFor>` tied to the range
   *  input). Omit for compact rows that already show context elsewhere - `ariaLabel` is then used
   *  to give the input an accessible name instead. */
  label?: ReactNode;
  tooltip?: string;
  /** Accessible name for the range input when no visible `label` is rendered, and a prefix for the
   *  inline min/max/value edit inputs' own aria-labels either way. */
  ariaLabel?: string;
  range: SliderBounds;
  value: number;
  onChange: (value: number) => void;
  /** Pre-formatted display text for the current value (e.g. "$1,200/mo"). */
  valueLabel: string;
  /** Formats the min/max bound numbers for display. Defaults to a plain integer/2-decimal string. */
  formatBound?: (value: number) => string;
}

function defaultFormatBound(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Reusable slider primitive backing every range input in the app. Beyond a plain drag-to-change
 *  range input, it supports double-clicking the min/max bound text to edit the *effective* range
 *  for this slider instance (a local override layered on top of the `range` prop - it never
 *  mutates the caller's range), and double-clicking the value display to type an exact value
 *  instead of dragging to find it. */
export function Slider({ id, label, tooltip, ariaLabel, range, value, onChange, valueLabel, formatBound = defaultFormatBound }: Readonly<SliderProps>) {
  const [minOverride, setMinOverride] = useState<number | null>(null);
  const [maxOverride, setMaxOverride] = useState<number | null>(null);
  const [editingBound, setEditingBound] = useState<'min' | 'max' | null>(null);
  const [boundDraft, setBoundDraft] = useState('');
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [valueDraft, setValueDraft] = useState('');

  const effectiveMin = minOverride ?? range.min;
  const effectiveMax = maxOverride ?? range.max;
  const accessibleLabel = ariaLabel ?? (typeof label === 'string' ? label : undefined);

  const startEditBound = (bound: 'min' | 'max') => {
    setBoundDraft(String(bound === 'min' ? effectiveMin : effectiveMax));
    setEditingBound(bound);
  };

  const cancelEditBound = () => setEditingBound(null);

  const commitBound = () => {
    if (!editingBound) {
      return;
    }
    const parsed = Number(boundDraft);
    const isMin = editingBound === 'min';
    const valid = Number.isFinite(parsed) && (isMin ? parsed < effectiveMax : parsed > effectiveMin);
    if (!valid) {
      cancelEditBound();
      return;
    }
    const newMin = isMin ? parsed : effectiveMin;
    const newMax = isMin ? effectiveMax : parsed;
    if (isMin) {
      setMinOverride(parsed);
    } else {
      setMaxOverride(parsed);
    }
    const clamped = clamp(value, newMin, newMax);
    if (clamped !== value) {
      onChange(clamped);
    }
    setEditingBound(null);
  };

  const handleBoundKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitBound();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditBound();
    }
  };

  const startEditValue = () => {
    setValueDraft(String(value));
    setIsEditingValue(true);
  };

  const cancelEditValue = () => setIsEditingValue(false);

  const commitValue = () => {
    const parsed = Number(valueDraft);
    if (Number.isFinite(parsed)) {
      onChange(clamp(parsed, effectiveMin, effectiveMax));
    }
    setIsEditingValue(false);
  };

  const handleValueKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commitValue();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditValue();
    }
  };

  const activateOnKey = (action: () => void) => (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="slider-field">
      {label && (
        <label className="slider-field__label" htmlFor={id}>
          {tooltip ? <Tooltip tip={tooltip}>{label}</Tooltip> : label}
        </label>
      )}
      <div className="slider-field__control">
        {editingBound === 'min' ? (
          <input
            type="number"
            step="any"
            className="slider-field__bound-input"
            value={boundDraft}
            autoFocus
            aria-label={`${accessibleLabel ?? id} minimum`}
            onChange={(event) => setBoundDraft(event.target.value)}
            onBlur={commitBound}
            onKeyDown={handleBoundKeyDown}
          />
        ) : (
          <span
            className="slider-field__bound"
            role="button"
            tabIndex={0}
            title="Double-click to change the minimum"
            onDoubleClick={() => startEditBound('min')}
            onKeyDown={activateOnKey(() => startEditBound('min'))}
          >
            {formatBound(effectiveMin)}
          </span>
        )}
        <input
          id={id}
          className="slider-field__input"
          type="range"
          min={effectiveMin}
          max={effectiveMax}
          step={range.step}
          value={value}
          aria-label={label ? undefined : accessibleLabel}
          onChange={(event) => onChange(Number(event.target.value))}
          onDoubleClick={startEditValue}
        />
        {editingBound === 'max' ? (
          <input
            type="number"
            step="any"
            className="slider-field__bound-input"
            value={boundDraft}
            autoFocus
            aria-label={`${accessibleLabel ?? id} maximum`}
            onChange={(event) => setBoundDraft(event.target.value)}
            onBlur={commitBound}
            onKeyDown={handleBoundKeyDown}
          />
        ) : (
          <span
            className="slider-field__bound"
            role="button"
            tabIndex={0}
            title="Double-click to change the maximum"
            onDoubleClick={() => startEditBound('max')}
            onKeyDown={activateOnKey(() => startEditBound('max'))}
          >
            {formatBound(effectiveMax)}
          </span>
        )}
        {isEditingValue ? (
          <input
            type="number"
            step="any"
            className="slider-field__value-input"
            value={valueDraft}
            autoFocus
            aria-label={`${accessibleLabel ?? id} value`}
            onChange={(event) => setValueDraft(event.target.value)}
            onBlur={commitValue}
            onKeyDown={handleValueKeyDown}
          />
        ) : (
          <span
            className="slider-field__value"
            role="button"
            tabIndex={0}
            title="Double-click to enter a value"
            onDoubleClick={startEditValue}
            onKeyDown={activateOnKey(startEditValue)}
          >
            {valueLabel}
          </span>
        )}
      </div>
    </div>
  );
}
