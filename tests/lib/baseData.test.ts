import { DEFAULT_BASE_RANGES, baseDefaults, parseBaseRanges } from '@src/lib/baseData';
import { ALL_BASE_FIELD_IDS } from '@src/lib/baseFields';

describe('DEFAULT_BASE_RANGES (Defaults.json)', () => {
  it('covers every known base field with a valid range', () => {
    for (const id of ALL_BASE_FIELD_IDS) {
      const range = DEFAULT_BASE_RANGES[id];
      expect(range).toBeDefined();
      expect(range.min).toBeLessThanOrEqual(range.max);
      expect(range.default).toBeGreaterThanOrEqual(range.min);
      expect(range.default).toBeLessThanOrEqual(range.max);
      expect(range.step).toBeGreaterThan(0);
    }
  });
});

describe('parseBaseRanges', () => {
  it('accepts a well-formed set of ranges', () => {
    expect(() => parseBaseRanges(DEFAULT_BASE_RANGES)).not.toThrow();
  });

  it('rejects data missing a known field', () => {
    const { salaryY0K: _omitted, ...incomplete } = DEFAULT_BASE_RANGES;
    expect(() => parseBaseRanges(incomplete)).toThrow(/salaryY0K/);
  });

  it('rejects an out-of-range default', () => {
    const invalid = {
      ...DEFAULT_BASE_RANGES,
      salaryY0K: { ...DEFAULT_BASE_RANGES.salaryY0K, default: DEFAULT_BASE_RANGES.salaryY0K.max + 1 },
    };
    expect(() => parseBaseRanges(invalid)).toThrow(/salaryY0K/);
  });

  it('rejects non-object input', () => {
    expect(() => parseBaseRanges(null)).toThrow();
    expect(() => parseBaseRanges('nope')).toThrow();
  });
});

describe('baseDefaults', () => {
  it('extracts each field default into a flat BaseInputs record', () => {
    const inputs = baseDefaults(DEFAULT_BASE_RANGES);
    for (const id of ALL_BASE_FIELD_IDS) {
      expect(inputs[id]).toBe(DEFAULT_BASE_RANGES[id].default);
    }
  });
});
