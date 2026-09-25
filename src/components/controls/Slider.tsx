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
  tooltip?: ReactNode;
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
  /** Disables the input and dims the field - e.g. Social Security's benefit slider once the
   *  SocialSecurityToggle above it is switched off (see RetirementPage.tsx). The stored value is
   *  left untouched so re-enabling restores it; the caller is responsible for not feeding a
   *  disabled field's value into the model. Bound/value double-click editing is disabled too. */
  disabled?: boolean;
}

function defaultFormatBound(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function activateOnKey(action: () => void) {
  return (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
}

interface InlineEditableNumberProps {
  className: string;
  isEditing: boolean;
  draft: string;
  displayText: string;
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onStartEdit: () => void;
}

/** Toggles between a plain display span (double-click/Enter/Space to start editing) and a live
 *  number input (blur/Enter to commit, Escape to cancel) - the shared shape behind the slider's
 *  min bound, max bound, and value edit affordances. */
function InlineEditableNumber({
  className,
  isEditing,
  draft,
  displayText,
  ariaLabel,
  title,
  disabled,
  onDraftChange,
  onCommit,
  onKeyDown,
  onStartEdit,
}: Readonly<InlineEditableNumberProps>) {
  if (isEditing) {
    return (
      <input
        type="number"
        step="any"
        className={`${className}-input`}
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        onChange={(event) => onDraftChange(event.target.value)}
        onBlur={onCommit}
        onKeyDown={onKeyDown}
      />
    );
  }
  return (
    <span
      className={className}
      role="button"
      tabIndex={disabled ? -1 : 0}
      title={title}
      onDoubleClick={disabled ? undefined : onStartEdit}
      onKeyDown={disabled ? undefined : activateOnKey(onStartEdit)}
    >
      {displayText}
    </span>
  );
}

/** Reusable slider primitive backing every range input in the app. Beyond a plain drag-to-change
 *  range input, it supports double-clicking the min/max bound text to edit the *effective* range
 *  for this slider instance (a local override layered on top of the `range` prop - it never
 *  mutates the caller's range), and double-clicking the value display to type an exact value
 *  instead of dragging to find it. */
export function Slider({
  id,
  label,
  tooltip,
  ariaLabel,
  range,
  value,
  onChange,
  valueLabel,
  formatBound = defaultFormatBound,
  disabled,
}: Readonly<SliderProps>) {
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

  return (
    <div className={disabled ? 'slider-field slider-field--disabled' : 'slider-field'}>
      {label && (
        <label className="slider-field__label" htmlFor={id}>
          {tooltip ? <Tooltip tip={tooltip}>{label}</Tooltip> : label}
        </label>
      )}
      <div className="slider-field__control">
        <InlineEditableNumber
          className="slider-field__bound"
          isEditing={editingBound === 'min'}
          draft={boundDraft}
          displayText={formatBound(effectiveMin)}
          ariaLabel={`${accessibleLabel ?? id} minimum`}
          title="Double-click to change the minimum"
          disabled={disabled}
          onDraftChange={setBoundDraft}
          onCommit={commitBound}
          onKeyDown={handleBoundKeyDown}
          onStartEdit={() => startEditBound('min')}
        />
        <input
          id={id}
          className="slider-field__input"
          type="range"
          min={effectiveMin}
          max={effectiveMax}
          step={range.step}
          value={value}
          disabled={disabled}
          aria-label={label ? undefined : accessibleLabel}
          onChange={(event) => onChange(Number(event.target.value))}
          onDoubleClick={disabled ? undefined : startEditValue}
        />
        <InlineEditableNumber
          className="slider-field__bound"
          isEditing={editingBound === 'max'}
          draft={boundDraft}
          displayText={formatBound(effectiveMax)}
          ariaLabel={`${accessibleLabel ?? id} maximum`}
          title="Double-click to change the maximum"
          disabled={disabled}
          onDraftChange={setBoundDraft}
          onCommit={commitBound}
          onKeyDown={handleBoundKeyDown}
          onStartEdit={() => startEditBound('max')}
        />
        <InlineEditableNumber
          className="slider-field__value"
          isEditing={isEditingValue}
          draft={valueDraft}
          displayText={valueLabel}
          ariaLabel={`${accessibleLabel ?? id} value`}
          title="Double-click to enter a value"
          disabled={disabled}
          onDraftChange={setValueDraft}
          onCommit={commitValue}
          onKeyDown={handleValueKeyDown}
          onStartEdit={startEditValue}
        />
      </div>
    </div>
  );
}
