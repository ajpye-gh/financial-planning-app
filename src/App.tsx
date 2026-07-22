import { useMemo, useState } from 'react';
import { QuestionnaireWizard } from './components/questionnaire/QuestionnaireWizard';
import { ControlsPanel } from './components/controls/ControlsPanel';
import { GoalsPanel } from './components/goals/GoalsPanel';
import { ChartToggle } from './components/results/ChartToggle';
import { CashflowChart } from './components/results/CashflowChart';
import { MetricCards, type Metric } from './components/results/MetricCards';
import { VerdictBanner } from './components/results/VerdictBanner';
import { BreakdownTable } from './components/results/BreakdownTable';
import { useDraftState } from './hooks/useDraftState';
import { isQuestionnaireComplete, ownsHome } from './lib/questions';
import { DEFAULT_BASE_RANGES } from './lib/baseData';
import { runModel } from './lib/model';
import { chartToggleOptions, primarySeriesFor, type ChartSeriesId } from './lib/chartSeries';
import { formatCurrency, formatCurrencyCompact } from './lib/format';

function App() {
  const draft = useDraftState();
  const [selectedSeriesId, setSelectedSeriesId] = useState<ChartSeriesId>('unallocated');

  const questionnaireDone = isQuestionnaireComplete(draft.answers);

  const result = useMemo(
    () => runModel({ base: draft.baseInputs, ownsHome: ownsHome(draft.answers), goals: draft.goals }),
    [draft.baseInputs, draft.answers, draft.goals],
  );

  if (!questionnaireDone) {
    return (
      <main className="page">
        <QuestionnaireWizard answers={draft.answers} onAnswer={draft.setAnswer} onComplete={() => undefined} />
      </main>
    );
  }

  const toggleOptions = chartToggleOptions(draft.goals);
  const effectiveSeriesId = toggleOptions.some((option) => option.id === selectedSeriesId)
    ? selectedSeriesId
    : 'unallocated';
  const primary = primarySeriesFor(effectiveSeriesId, result.chart, draft.goals);

  const runningTotals: Record<string, number> = {};
  for (const goal of draft.goals) {
    const series = result.chart.goalBalances[goal.id];
    if (series && series.length > 0) {
      runningTotals[goal.id] = series[series.length - 1];
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
      id: 'unallocated-end',
      label: 'Unallocated savings, yr 18',
      value: formatCurrencyCompact(result.unallocatedAtEnd),
      tone: result.unallocatedAtEnd < 0 ? 'danger' : undefined,
    },
  ];

  return (
    <main className="page">
      <h1>Financial Planning</h1>
      <p className="page__subtitle">
        A cashflow model for your situation — add the goals you're saving or spending toward, and see how they
        trade off against your free cash.
      </p>

      <div className="page__section-title">Your position</div>
      <ControlsPanel answers={draft.answers} ranges={DEFAULT_BASE_RANGES} values={draft.baseInputs} onChange={draft.setBaseInput} />

      <div className="page__section-title">Goals</div>
      <GoalsPanel
        goals={draft.goals}
        runningTotals={runningTotals}
        onAdd={draft.addGoal}
        onRemove={draft.removeGoal}
        onChangeAmount={draft.updateGoal}
      />

      <div className="page__section-title">Results</div>
      <VerdictBanner verdict={result.verdict} />
      <MetricCards metrics={metrics} />
      <ChartToggle options={toggleOptions} selected={effectiveSeriesId} onSelect={setSelectedSeriesId} />
      <CashflowChart chart={result.chart} primary={primary} />
      <BreakdownTable snapshot={result.snapshot} goals={draft.goals} />

      <button type="button" onClick={draft.startOver}>
        Start over
      </button>
    </main>
  );
}

export default App;
