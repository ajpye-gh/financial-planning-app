import defaultsJson from '../data/Defaults.json';
import { ALL_BASE_FIELD_IDS, type BaseFieldId } from './baseFields';

export interface SliderRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export type BaseRanges = Record<BaseFieldId, SliderRange>;
export type BaseInputs = Record<BaseFieldId, number>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRange(value: unknown): value is SliderRange {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const range = value as Record<string, unknown>;
  return (
    isFiniteNumber(range.min) &&
    isFiniteNumber(range.max) &&
    isFiniteNumber(range.step) &&
    isFiniteNumber(range.default) &&
    range.min <= range.max &&
    range.step > 0 &&
    range.default >= range.min &&
    range.default <= range.max
  );
}

/** Validates that `data` covers every known base field with a sane min/max/step/default. Throws with the first problem found. */
export function parseBaseRanges(data: unknown): BaseRanges {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Base field data must be a JSON object.');
  }
  const record = data as Record<string, unknown>;
  const ranges = {} as BaseRanges;
  for (const id of ALL_BASE_FIELD_IDS) {
    const range = record[id];
    if (!isValidRange(range)) {
      throw new Error(`Base field data is missing or has an invalid "${id}" entry.`);
    }
    ranges[id] = range;
  }
  return ranges;
}

export function baseDefaults(ranges: BaseRanges): BaseInputs {
  const inputs = {} as BaseInputs;
  for (const id of ALL_BASE_FIELD_IDS) {
    inputs[id] = ranges[id].default;
  }
  return inputs;
}

export const DEFAULT_BASE_RANGES: BaseRanges = parseBaseRanges(defaultsJson);
