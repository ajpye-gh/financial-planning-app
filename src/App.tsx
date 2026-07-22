import { useMemo, useState } from 'react';
import { ControlsPanel } from './components/controls/ControlsPanel';
import { SliderField } from './components/controls/SliderField';
import { GoalsPanel } from './components/goals/GoalsPanel';
import { ChartToggle } from './components/results/ChartToggle';
import { CashflowChart } from './components/results/CashflowChart';
import { MetricCards, type Metric } from './components/results/MetricCards';
import { VerdictBanner } from './components/results/VerdictBanner';
import { BreakdownTable } from './components/results/BreakdownTable';
import { useDraftState } from './hooks/useDraftState';
import { ownsHome } from './lib/questions';
import { DEFAULT_BASE_RANGES } from './lib/baseData';
import { INSPECT_YEAR_FIELD } from './lib/baseFields';
import { runModel } from './lib/model';
import { chartToggleOptions, primarySeriesFor, type ChartSeriesId } from './lib/chartSeries';
import { formatCurrency, formatCurrencyCompact } from './lib/format';

function App() {
  const draft = useDraftState();
  const [selectedSeriesId, setSelectedSeriesId] = useState<ChartSeriesId | null>(null);

  const result = useMemo(
    () =>
      runModel({
        base: draft.baseInputs,
        ownsHome: ownsHome(draft.answers),
        goals: draft.goals,
        salaryRaises: draft.salaryRaises,
      }),
    [draft.baseInputs, draft.answers, draft.goals, draft.salaryRaises],
  );

  const toggleOptions = chartToggleOptions(draft.goals);
  const effectiveSeriesId = toggleOptions.some((option) => option.id === selectedSeriesId)
    ? selectedSeriesId
    : (toggleOptions[0]?.id ?? null);
  const primary = primarySeriesFor(effectiveSeriesId, result.chart, draft.goals);

  const runningTotals: Record<string, number> = {};
  for (const goal of draft.goals) {
    const series = result.chart.goalBalances[goal.id];
    if (series && series.length > 0) {
      // Balance at the goal's own endYear, not the model horizon - the balance keeps compounding
      // past endYear (see model.ts), but that's not what "did I hit my target" should check against.
      const endYearIndex = Math.min(Math.max(goal.endYear, 1), series.length) - 1;
      runningTotals[goal.id] = series[endYearIndex];
    }
  }

  const metrics: Metric[] = [
    {
      id: 'free-cash',
      label: 'Free cash, inspect yr',
      value: `${formatCurrency(result.freeCashAtInspect)}/mo`,
      tone: result.freeCashAtInspect < 0 ? 'danger' : 'success',
    },
    {
      id: 'unallocated-inspect',
      label: 'Unallocated savings, inspect yr',
      value: formatCurrencyCompact(result.unallocatedAtInspect),
      tone: result.unallocatedAtInspect < 0 ? 'danger' : undefined,
    },
  ];

  return (
    <main className="page">
      <h1>Financial Planning</h1>
      <p className="page__subtitle">
        A cashflow model for your situation — add the goals you're saving or spending toward, and see how they
        trade off against your free cash.
      </p>

      <div className="app-shell">
        <aside className="app-shell__sidebar">
          <ControlsPanel
            answers={draft.answers}
            onAnswer={draft.setAnswer}
            ranges={DEFAULT_BASE_RANGES}
            values={draft.baseInputs}
            onChange={draft.setBaseInput}
            salaryRaises={draft.salaryRaises}
            onAddSalaryRaise={draft.addSalaryRaise}
            onRemoveSalaryRaise={draft.removeSalaryRaise}
            onUpdateSalaryRaise={draft.updateSalaryRaise}
          />
        </aside>

        <div className="app-shell__main">
          <div className="page__section-title">Goals</div>
          <GoalsPanel
            goals={draft.goals}
            runningTotals={runningTotals}
            onAdd={draft.addGoal}
            onRemove={draft.removeGoal}
            onUpdate={draft.updateGoal}
          />

          <div className="page__section-title">Results</div>
          <VerdictBanner verdict={result.verdict} />
          <ChartToggle options={toggleOptions} selected={effectiveSeriesId} onSelect={setSelectedSeriesId} />
          <CashflowChart chart={result.chart} primary={primary} />
          <div className="inspect-year-control">
            <SliderField
              meta={INSPECT_YEAR_FIELD}
              range={DEFAULT_BASE_RANGES.inspectYear}
              value={draft.baseInputs.inspectYear}
              onChange={draft.setBaseInput}
            />
          </div>
          <MetricCards metrics={metrics} />
          <BreakdownTable snapshot={result.snapshot} goals={draft.goals} />

          <button type="button" onClick={draft.startOver}>
            Start over
          </button>
        </div>
      </div>
    </main>
  );
}

export default App;
