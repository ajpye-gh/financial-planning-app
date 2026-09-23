import { useMemo, useState, type ReactNode } from 'react';
import type { ChildBreakpointsProps } from './components/controls/ChildBreakpoints';
import { ControlsPanel } from './components/controls/ControlsPanel';
import type { SalaryRaiseBreakpointsProps } from './components/controls/SalaryRaiseBreakpoints';
import { SliderField } from './components/controls/SliderField';
import { GoalsPanel } from './components/goals/GoalsPanel';
import { MortgagePage } from './components/mortgage/MortgagePage';
import { PlanMenu } from './components/PlanMenu';
import { RetirementPage } from './components/retirement/RetirementPage';
import { ChartToggle } from './components/results/ChartToggle';
import { CashflowChart } from './components/results/CashflowChart';
import { MetricCards, type Metric } from './components/results/MetricCards';
import { VerdictBanner } from './components/results/VerdictBanner';
import { BreakdownTable } from './components/results/BreakdownTable';
import { useDraftState } from './hooks/useDraftState';
import { ownsHome } from './lib/questions';
import { DEFAULT_BASE_RANGES } from './lib/baseData';
import { INSPECT_YEAR_FIELD } from './lib/baseFields';
import { runModel, type IncomeStreamInputs } from './lib/model';
import { chartToggleOptions, primarySeriesFor, type ChartSeriesId } from './lib/chartSeries';
import { formatCurrency, formatCurrencyCompact } from './lib/format';

type PageTab = 'primary' | 'mortgage' | 'retirement';

function tabClassName(tab: PageTab, activeTab: PageTab): string {
  const base = 'page-tabs__item';
  return tab === activeTab ? `${base} ${base}--active` : base;
}

function App() {
  const draft = useDraftState();
  const [selectedSeriesId, setSelectedSeriesId] = useState<ChartSeriesId | null>(null);
  const [activeTab, setActiveTab] = useState<PageTab>('primary');

  const primaryIncomeControls: SalaryRaiseBreakpointsProps = {
    breakpoints: draft.salaryRaises,
    salaryY0K: draft.baseInputs.salaryY0K,
    onAdd: draft.addSalaryRaise,
    onRemove: draft.removeSalaryRaise,
    onUpdate: draft.updateSalaryRaise,
    jobLossYear: draft.jobLossYear,
    onSetJobLoss: draft.setJobLossYear,
    onClearJobLoss: draft.clearJobLossYear,
  };
  const partnerIncomeControls: SalaryRaiseBreakpointsProps = {
    breakpoints: draft.partnerSalaryRaises,
    salaryY0K: draft.baseInputs.partnerSalaryY0K,
    onAdd: draft.addPartnerSalaryRaise,
    onRemove: draft.removePartnerSalaryRaise,
    onUpdate: draft.updatePartnerSalaryRaise,
    jobLossYear: draft.partnerJobLossYear,
    onSetJobLoss: draft.setPartnerJobLossYear,
    onClearJobLoss: draft.clearPartnerJobLossYear,
  };
  const childrenControls: ChildBreakpointsProps = {
    kids: draft.children,
    onAdd: draft.addChild,
    onRemove: draft.removeChild,
    onUpdate: draft.updateChild,
  };

  const result = useMemo(() => {
    const primaryIncome: IncomeStreamInputs = {
      salaryY0K: draft.baseInputs.salaryY0K,
      growthAfterLastRaisePct: draft.baseInputs.salaryGrowthAfterY10Pct,
      netKeepRatePct: draft.baseInputs.netKeepRatePct,
      raises: draft.salaryRaises,
      annualBonusK: draft.baseInputs.annualBonusK,
      jobLossYear: draft.jobLossYear,
    };
    const partnerIncome: IncomeStreamInputs = {
      salaryY0K: draft.baseInputs.partnerSalaryY0K,
      growthAfterLastRaisePct: draft.baseInputs.partnerSalaryGrowthAfterY10Pct,
      netKeepRatePct: draft.baseInputs.partnerNetKeepRatePct,
      raises: draft.partnerSalaryRaises,
      annualBonusK: draft.baseInputs.partnerAnnualBonusK,
      jobLossYear: draft.partnerJobLossYear,
    };
    return runModel({
      base: draft.baseInputs,
      ownsHome: ownsHome(draft.answers),
      goals: draft.goals,
      children: draft.children,
      primaryIncome,
      partnerIncome,
    });
  }, [
    draft.baseInputs,
    draft.answers,
    draft.goals,
    draft.children,
    draft.salaryRaises,
    draft.jobLossYear,
    draft.partnerSalaryRaises,
    draft.partnerJobLossYear,
  ]);

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
      // Series index === year number (index 0 is the Y0 baseline), so no -1 offset here.
      const endYearIndex = Math.min(Math.max(goal.endYear, 0), series.length - 1);
      runningTotals[goal.id] = series[endYearIndex];
    }
  }

  const cashAllocatedTotal = draft.goals.reduce((sum, goal) => sum + goal.cashAllocated, 0);
  const brokerageAllocatedTotal = draft.goals.reduce((sum, goal) => sum + goal.brokerageAllocated, 0);
  const cashRemaining = Math.max(0, draft.baseInputs.cashTodayK * 1000 - cashAllocatedTotal);
  const brokerageRemaining = Math.max(0, draft.baseInputs.brokerageTodayK * 1000 - brokerageAllocatedTotal);

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

  let activeTabContent: ReactNode;
  if (activeTab === 'primary') {
    activeTabContent = (
      <div className="app-shell">
        <aside className="app-shell__sidebar">
          <ControlsPanel
            answers={draft.answers}
            onAnswer={draft.setAnswer}
            ranges={DEFAULT_BASE_RANGES}
            values={draft.baseInputs}
            onChange={draft.setBaseInput}
            primaryIncomeControls={primaryIncomeControls}
            partnerIncomeControls={partnerIncomeControls}
            childrenControls={childrenControls}
          />
        </aside>

        <div className="app-shell__main">
          <div className="page__section-title">Goals</div>
          <GoalsPanel
            goals={draft.goals}
            runningTotals={runningTotals}
            cashRemaining={cashRemaining}
            brokerageRemaining={brokerageRemaining}
            base={draft.baseInputs}
            ownsHome={ownsHome(draft.answers)}
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
        </div>
      </div>
    );
  } else if (activeTab === 'mortgage') {
    activeTabContent = (
      <MortgagePage baseInputs={draft.baseInputs} ranges={DEFAULT_BASE_RANGES} onChange={draft.setBaseInput} answers={draft.answers} />
    );
  } else {
    activeTabContent = (
      <RetirementPage
        baseInputs={draft.baseInputs}
        ranges={DEFAULT_BASE_RANGES}
        onChange={draft.setBaseInput}
        answers={draft.answers}
        onAnswer={draft.setAnswer}
      />
    );
  }

  return (
    <main className="page">
      <div className="page__header">
        <PlanMenu onLoad={draft.loadPlan} planForSaving={draft.planForSaving} />
        <img src="https://ajpye-gh.github.io/pyenancial/og-image.svg" alt="Pyenancial" className="page__logo" />
      </div>
      <p className="page__subtitle">
        A cashflow model for your situation — add the goals you're saving or spending toward, and see how they
        trade off against your free cash.
      </p>

      <nav className="page-tabs">
        <button type="button" className={tabClassName('primary', activeTab)} onClick={() => setActiveTab('primary')}>
          Home
        </button>
        <button type="button" className={tabClassName('mortgage', activeTab)} onClick={() => setActiveTab('mortgage')}>
          Mortgage
        </button>
        <button type="button" className={tabClassName('retirement', activeTab)} onClick={() => setActiveTab('retirement')}>
          Retirement
        </button>
      </nav>

      {activeTabContent}
    </main>
  );
}

export default App;
