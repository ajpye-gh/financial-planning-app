import { useState } from 'react';
import { HORIZON_YEARS, MORTGAGE_TERM_YEARS, monthlyMortgagePayment } from '../../lib/model';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { EditIcon, SaveIcon } from '../icons';
import { Tooltip } from '../Tooltip';
import { canAllocateBrokerage, canAllocateCash, canAllocateEquity, type Goal } from '../../lib/goals';

interface GoalCardProps {
  goal: Goal;
  runningTotal?: number;
  /** Cash today / Brokerage today not yet promised to any goal (including this one's own current
   *  allocation) - each slider's max is this plus what this goal already has, so no goal can be
   *  dragged into over-allocating the shared pool. */
  cashRemaining: number;
  brokerageRemaining: number;
  /** Current home equity (home value minus mortgage balance), 0 if renting - all-or-nothing, so
   *  unlike cashRemaining/brokerageRemaining there's no "remaining" variant to compute. */
  homeEquity: number;
  /** Initial expanded/collapsed state only - true for a just-added goal (so the user can configure
   *  it right away), false (collapsed) otherwise. The card's own chevron toggles it freely after
   *  that, uncontrolled. */
  defaultExpanded?: boolean;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onRemove: (id: string) => void;
}

const TARGET_AMOUNT_RANGE = { min: 0, max: 1000000, step: 10000 };
const ALLOCATION_STEP = 500;
const PURCHASE_PRICE_RANGE = { min: 0, max: 2000, step: 10 };
const MORTGAGE_RATE_RANGE = { min: 0, max: 15, step: 0.25 };
const POST_PURCHASE_COST_RANGE = { min: 0, max: 5000, step: 50 };

export function GoalCard({
  goal,
  runningTotal,
  cashRemaining,
  brokerageRemaining,
  homeEquity,
  defaultExpanded = false,
  onUpdate,
  onRemove,
}: Readonly<GoalCardProps>) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(goal.name);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const clampYear = (value: number) => Math.min(Math.max(Math.round(value), 1), HORIZON_YEARS);
  const isProperty = goal.category === 'property';

  const startEditingName = () => {
    setDraftName(goal.name);
    setIsEditingName(true);
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== goal.name) {
      onUpdate(goal.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const handleStartYearChange = (value: number) => {
    const startYear = clampYear(value);
    onUpdate(goal.id, { startYear, endYear: Math.max(startYear, goal.endYear) });
  };

  const handleEndYearChange = (value: number) => {
    const endYear = clampYear(value);
    onUpdate(goal.id, { endYear, startYear: Math.min(endYear, goal.startYear) });
  };

  return (
    <div className="goal-card">
      <div className="goal-card__header">
        {isEditingName ? (
          <input
            type="text"
            className="goal-card__name-input"
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitName();
              }
            }}
            aria-label="Goal name"
          />
        ) : (
          <span className="goal-card__name">{goal.name}</span>
        )}
        <button
          type="button"
          className="goal-card__edit-name"
          onClick={isEditingName ? commitName : startEditingName}
          aria-label={isEditingName ? `Save ${goal.name}` : `Rename ${goal.name}`}
          title={isEditingName ? 'Save' : 'Rename'}
        >
          {isEditingName ? <SaveIcon /> : <EditIcon />}
        </button>
        <button
          type="button"
          className="goal-card__expand"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${goal.name}` : `Expand ${goal.name}`}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        <button
          type="button"
          className="goal-card__remove"
          onClick={() => onRemove(goal.id)}
          aria-label={`Remove ${goal.name}`}
        >
          ×
        </button>
      </div>

      <span className={`goal-card__mode-badge goal-card__mode-badge--${goal.mode}`}>
        {goal.mode === 'accumulate' ? 'saving' : 'spending'}
      </span>

      {!isExpanded ? (
        <div className="goal-card__summary">
          <span className="goal-card__summary-amount">{formatCurrency(goal.monthlyAmount)}/mo</span>
          {goal.mode === 'accumulate' && runningTotal !== undefined && <span>→ {formatCurrencyCompact(runningTotal)}</span>}
        </div>
      ) : (
        <>
          <div className="slider-field">
            <span className="slider-field__label">Monthly amount</span>
            <div className="slider-field__control">
              <input
                type="range"
                min={goal.monthlyAmountRange.min}
                max={goal.monthlyAmountRange.max}
                step={goal.monthlyAmountRange.step}
                value={goal.monthlyAmount}
                onChange={(event) => onUpdate(goal.id, { monthlyAmount: Number(event.target.value) })}
              />
              <span className="slider-field__value">{formatCurrency(goal.monthlyAmount)}/mo</span>
            </div>
          </div>

          {goal.mode === 'accumulate' && (
            <div className="slider-field">
              <span className="slider-field__label">Target amount</span>
              <div className="slider-field__control">
                <input
                  type="range"
                  min={TARGET_AMOUNT_RANGE.min}
                  max={TARGET_AMOUNT_RANGE.max}
                  step={TARGET_AMOUNT_RANGE.step}
                  value={goal.targetAmount ?? 0}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    onUpdate(goal.id, { targetAmount: value > 0 ? value : undefined });
                  }}
                />
                <span className="slider-field__value">
                  {goal.targetAmount ? formatCurrency(goal.targetAmount) : 'No target'}
                </span>
              </div>
            </div>
          )}

          {canAllocateCash(goal) && (
            <div className="slider-field">
              <span className="slider-field__label">From cash today</span>
              <div className="slider-field__control">
                <input
                  type="range"
                  min={0}
                  max={cashRemaining + goal.cashAllocated}
                  step={ALLOCATION_STEP}
                  value={goal.cashAllocated}
                  onChange={(event) => onUpdate(goal.id, { cashAllocated: Number(event.target.value) })}
                />
                <span className="slider-field__value">{formatCurrency(goal.cashAllocated)}</span>
              </div>
            </div>
          )}

          {canAllocateBrokerage(goal) && (
            <div className="slider-field">
              <span className="slider-field__label">From brokerage today</span>
              <div className="slider-field__control">
                <input
                  type="range"
                  min={0}
                  max={brokerageRemaining + goal.brokerageAllocated}
                  step={ALLOCATION_STEP}
                  value={goal.brokerageAllocated}
                  onChange={(event) => onUpdate(goal.id, { brokerageAllocated: Number(event.target.value) })}
                />
                <span className="slider-field__value">{formatCurrency(goal.brokerageAllocated)}</span>
              </div>
            </div>
          )}

          {canAllocateEquity(goal) && homeEquity > 0 && (
            <label className="goal-card__toggle">
              <input
                type="checkbox"
                checked={goal.equityAllocated}
                onChange={(event) => onUpdate(goal.id, { equityAllocated: event.target.checked })}
              />
              Use home equity ({formatCurrency(homeEquity)})
            </label>
          )}

          {goal.mode === 'accumulate' && isProperty && (
            <>
              <div className="slider-field">
                <span className="slider-field__label">Total property price</span>
                <div className="slider-field__control">
                  <input
                    type="range"
                    min={PURCHASE_PRICE_RANGE.min}
                    max={PURCHASE_PRICE_RANGE.max}
                    step={PURCHASE_PRICE_RANGE.step}
                    value={goal.purchasePriceK ?? 0}
                    onChange={(event) => onUpdate(goal.id, { purchasePriceK: Number(event.target.value) })}
                  />
                  <span className="slider-field__value">{formatCurrency((goal.purchasePriceK ?? 0) * 1000)}</span>
                </div>
              </div>
              <div className="slider-field">
                <span className="slider-field__label">Mortgage rate</span>
                <div className="slider-field__control">
                  <input
                    type="range"
                    min={MORTGAGE_RATE_RANGE.min}
                    max={MORTGAGE_RATE_RANGE.max}
                    step={MORTGAGE_RATE_RANGE.step}
                    value={goal.mortgageRatePct ?? 0}
                    onChange={(event) => onUpdate(goal.id, { mortgageRatePct: Number(event.target.value) })}
                  />
                  <span className="slider-field__value">{(goal.mortgageRatePct ?? 0).toFixed(2)}%</span>
                </div>
              </div>
              {(goal.purchasePriceK ?? 0) > 0 && (
                <div className="goal-card__mortgage-preview">
                  Estimated mortgage payment:{' '}
                  <span className="goal-card__mortgage-preview-value">
                    {formatCurrency(
                      monthlyMortgagePayment(
                        (goal.purchasePriceK ?? 0) * 1000 - (runningTotal ?? 0),
                        goal.mortgageRatePct ?? 0,
                        MORTGAGE_TERM_YEARS,
                      ),
                    )}
                    /mo
                  </span>
                </div>
              )}
            </>
          )}

          {goal.mode === 'accumulate' && !isProperty && (
            <>
              <label className="goal-card__toggle">
                <input
                  type="checkbox"
                  checked={goal.isPurchase}
                  onChange={(event) => onUpdate(goal.id, { isPurchase: event.target.checked })}
                />
                This ends in a purchase
              </label>
              {goal.isPurchase && (
                <div className="slider-field">
                  <span className="slider-field__label">Post-purchase monthly cost</span>
                  <div className="slider-field__control">
                    <input
                      type="range"
                      min={POST_PURCHASE_COST_RANGE.min}
                      max={POST_PURCHASE_COST_RANGE.max}
                      step={POST_PURCHASE_COST_RANGE.step}
                      value={goal.postPurchaseMonthlyCost ?? 0}
                      onChange={(event) => onUpdate(goal.id, { postPurchaseMonthlyCost: Number(event.target.value) })}
                    />
                    <span className="slider-field__value">{formatCurrency(goal.postPurchaseMonthlyCost ?? 0)}/mo</span>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="goal-card__years">
            <label className="goal-card__year-field">
              Start yr
              <input
                type="number"
                min={1}
                max={HORIZON_YEARS}
                value={goal.startYear}
                onChange={(event) => handleStartYearChange(Number(event.target.value))}
              />
            </label>
            <label className="goal-card__year-field">
              End yr
              <input
                type="number"
                min={1}
                max={HORIZON_YEARS}
                value={goal.endYear}
                onChange={(event) => handleEndYearChange(Number(event.target.value))}
              />
            </label>
          </div>

          {goal.mode === 'accumulate' && runningTotal !== undefined && (
            <div className="goal-card__total">
              Balance:{' '}
              {goal.targetAmount !== undefined ? (
                <Tooltip
                  tip={`Projected balance at your end year (${goal.endYear}), against the ${formatCurrencyCompact(goal.targetAmount)} target you set for this goal.`}
                >
                  <span className="goal-card__total-value">{formatCurrencyCompact(runningTotal)}</span> /{' '}
                  {formatCurrencyCompact(goal.targetAmount)}
                </Tooltip>
              ) : (
                <span className="goal-card__total-value">{formatCurrencyCompact(runningTotal)}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
