import type { ChartSeries } from './model';
import type { Goal } from './goals';

export type ChartSeriesId = `goal:${string}`;

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
 *  goals (e.g. travel) are pure spend with nothing to plot beyond the shared free-cash line. Unallocated
 *  savings is always plotted on the chart directly, so it isn't one of the toggle-able options. */
export function chartToggleOptions(goals: Goal[]): ChartSeriesOption[] {
  return goals
    .filter((goal) => goal.mode === 'accumulate')
    .map((goal) => ({ id: `goal:${goal.id}`, label: goal.name }));
}

export function primarySeriesFor(id: ChartSeriesId | null, chart: ChartSeries, goals: Goal[]): PrimarySeries {
  if (!id) {
    return { label: '', values: [] };
  }
  const goalId = id.slice('goal:'.length);
  const goal = goals.find((candidate) => candidate.id === goalId);
  return {
    label: goal?.name ?? 'Goal',
    values: chart.goalBalances[goalId] ?? [],
    targetAmount: goal?.targetAmount,
  };
}
