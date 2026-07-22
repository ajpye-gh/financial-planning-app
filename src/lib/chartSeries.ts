import type { ChartSeries } from './model';
import type { Goal } from './goals';

export type ChartSeriesId = 'unallocated' | `goal:${string}`;

export interface ChartSeriesOption {
  id: ChartSeriesId;
  label: string;
}

export interface PrimarySeries {
  label: string;
  values: number[];
  targetAmount?: number;
}

/** Only `accumulate`-mode goals have a balance of their own to chart (see SPEC.md §6.4) - `consume`-mode
 *  goals (e.g. travel) are pure spend with nothing to plot beyond the shared free-cash line. */
export function chartToggleOptions(goals: Goal[]): ChartSeriesOption[] {
  const options: ChartSeriesOption[] = [{ id: 'unallocated', label: 'Unallocated savings' }];
  for (const goal of goals) {
    if (goal.mode === 'accumulate') {
      options.push({ id: `goal:${goal.id}`, label: goal.name });
    }
  }
  return options;
}

export function primarySeriesFor(id: ChartSeriesId, chart: ChartSeries, goals: Goal[]): PrimarySeries {
  if (id === 'unallocated') {
    return { label: 'Unallocated savings', values: chart.unallocatedSavings };
  }
  const goalId = id.slice('goal:'.length);
  const goal = goals.find((candidate) => candidate.id === goalId);
  return {
    label: goal?.name ?? 'Goal',
    values: chart.goalBalances[goalId] ?? [],
    targetAmount: goal?.targetAmount,
  };
}
