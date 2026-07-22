import { chartToggleOptions, primarySeriesFor } from '@src/lib/chartSeries';
import type { ChartSeries } from '@src/lib/model';
import type { RecurringGoal } from '@src/lib/goals';

const CHART: ChartSeries = {
  yearLabels: ['Y1', 'Y2'],
  unallocatedSavings: [100, 200],
  freeCash: [10, 20],
  goalBalances: { college: [50, 120] },
};

const ACCUMULATE_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'college',
  name: 'College',
  mode: 'accumulate',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  targetAmount: 80000,
  startYear: 1,
  endYear: 18,
};

const CONSUME_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'travel',
  name: 'Travel',
  mode: 'consume',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  startYear: 1,
  endYear: 18,
};

describe('chartToggleOptions', () => {
  it('always includes "Unallocated savings"', () => {
    expect(chartToggleOptions([])).toEqual([{ id: 'unallocated', label: 'Unallocated savings' }]);
  });

  it('adds an option per accumulate-mode goal, but not consume-mode goals', () => {
    const options = chartToggleOptions([ACCUMULATE_GOAL, CONSUME_GOAL]);
    expect(options).toEqual([
      { id: 'unallocated', label: 'Unallocated savings' },
      { id: 'goal:college', label: 'College' },
    ]);
  });
});

describe('primarySeriesFor', () => {
  it('returns the unallocated savings series by id "unallocated"', () => {
    expect(primarySeriesFor('unallocated', CHART, [])).toEqual({
      label: 'Unallocated savings',
      values: [100, 200],
    });
  });

  it("returns a goal's own balance series and target amount by id `goal:<id>`", () => {
    expect(primarySeriesFor('goal:college', CHART, [ACCUMULATE_GOAL])).toEqual({
      label: 'College',
      values: [50, 120],
      targetAmount: 80000,
    });
  });
});
