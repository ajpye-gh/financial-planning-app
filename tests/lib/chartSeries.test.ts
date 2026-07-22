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
  category: 'other',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  targetAmount: 80000,
  startYear: 1,
  endYear: 18,
  cashAllocated: 0,
  brokerageAllocated: 0,
};

const CONSUME_GOAL: RecurringGoal = {
  kind: 'recurring',
  id: 'travel',
  name: 'Travel',
  mode: 'consume',
  category: 'other',
  monthlyAmount: 300,
  monthlyAmountRange: { min: 0, max: 3000, step: 50 },
  startYear: 1,
  endYear: 18,
  cashAllocated: 0,
  brokerageAllocated: 0,
};

describe('chartToggleOptions', () => {
  it('is empty when there are no accumulate-mode goals', () => {
    expect(chartToggleOptions([])).toEqual([]);
    expect(chartToggleOptions([CONSUME_GOAL])).toEqual([]);
  });

  it('adds an option per accumulate-mode goal, but not consume-mode goals', () => {
    const options = chartToggleOptions([ACCUMULATE_GOAL, CONSUME_GOAL]);
    expect(options).toEqual([{ id: 'goal:college', label: 'College' }]);
  });
});

describe('primarySeriesFor', () => {
  it('returns an empty series when no goal is selected', () => {
    expect(primarySeriesFor(null, CHART, [])).toEqual({ label: '', values: [] });
  });

  it("returns a goal's own balance series and target amount by id `goal:<id>`", () => {
    expect(primarySeriesFor('goal:college', CHART, [ACCUMULATE_GOAL])).toEqual({
      label: 'College',
      values: [50, 120],
      targetAmount: 80000,
    });
  });
});
