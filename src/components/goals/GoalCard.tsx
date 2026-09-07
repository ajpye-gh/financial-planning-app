import { useState } from 'react';
import {
  HORIZON_YEARS,
  MORTGAGE_TERM_YEARS,
  estimateMortgage,
  projectHomeEquity,
  type HomeEquityProjection,
  type MortgageEstimate,
} from '../../lib/model';
import { formatCurrency, formatCurrencyCompact } from '../../lib/format';
import { EditIcon, SaveIcon } from '../icons';
import { Tooltip } from '../Tooltip';
import { Slider } from '../controls/Slider';
import { canAllocateBrokerage, canAllocateCash, canAllocateEquity, type Goal } from '../../lib/goals';
import type { BaseInputs } from '../../lib/baseData';

interface GoalCardProps {
  goal: Goal;
  runningTotal?: number;
  /** Cash today / Brokerage today not yet promised to any goal (including this one's own current
   *  allocation) - each slider's max is this plus what this goal already has, so no goal can be
   *  dragged into over-allocating the shared pool. */
  cashRemaining: number;
  brokerageRemaining: number;
  /** For projecting home equity at this goal's endYear (see projectHomeEquity) - unlike
   *  cashRemaining/brokerageRemaining, equity is all-or-nothing and depends on *when* you'd roll it
   *  over, so it can't be precomputed once in the parent the way those are. */
  base: BaseInputs;
  ownsHome: boolean;
  /** Initial expanded/collapsed state only - true for a just-added goal (so the user can configure
   *  it right away), false (collapsed) otherwise. The card's own chevron toggles it freely after
   *  that, uncontrolled. */
  defaultExpanded?: boolean;
  onUpdate: (id: string, patch: Partial<Goal>) => void;
  onRemove: (id: string) => void;
}

const ALLOCATION_STEP = 500;
const TARGET_AMOUNT_RANGE = { min: 0, max: 1000000, step: 10000 };
const PURCHASE_PRICE_RANGE = { min: 0, max: 2000, step: 10 };
const MORTGAGE_RATE_RANGE = { min: 0, max: 15, step: 0.25 };
const POST_PURCHASE_COST_RANGE = { min: 0, max: 5000, step: 50 };

/** Collapsed cards are height-capped (see .goal-card--collapsed) so the goals list stays scannable. */
function cardClassName(isExpanded: boolean): string {
  return isExpanded ? 'goal-card' : 'goal-card goal-card--collapsed';
}

/** Only property goals get a mortgage estimate. */
function mortgageEstimateFor(goal: Goal, runningTotal: number | undefined): MortgageEstimate | null {
  return goal.category === 'property' ? estimateMortgage(goal, runningTotal ?? 0) : null;
}

/** Only goals allowed to claim home equity need a projection computed. */
function equityProjectionFor(goal: Goal, base: BaseInputs, ownsHome: boolean): HomeEquityProjection | null {
  return canAllocateEquity(goal) ? projectHomeEquity(base, ownsHome, goal.endYear) : null;
}

export function GoalCard({
  goal,
  runningTotal,
  cashRemaining,
  brokerageRemaining,
  base,
  ownsHome,
  defaultExpanded = false,
  onUpdate,
  onRemove,
}: Readonly<GoalCardProps>) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(goal.name);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const clampYear = (value: number) => Math.min(Math.max(Math.round(value), 1), HORIZON_YEARS);
  const isProperty = goal.category === 'property';
  const mortgageEstimate = mortgageEstimateFor(goal, runningTotal);
  const equityProjection = equityProjectionFor(goal, base, ownsHome);

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
    <div className={cardClassName(isExpanded)}>
      <div className="goal-card__header">
        <div className="goal-card__title">
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
          {isExpanded && (
            <button
              type="button"
              className="goal-card__edit-name"
              onClick={isEditingName ? commitName : startEditingName}
              aria-label={isEditingName ? `Save ${goal.name}` : `Rename ${goal.name}`}
              title={isEditingName ? 'Save' : 'Rename'}
            >
              {isEditingName ? <SaveIcon /> : <EditIcon />}
            </button>
          )}
        </div>
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
      </div>

      {!isExpanded ? (
        <div className="goal-card__summary">
          <span className="goal-card__summary-amount">{formatCurrency(goal.monthlyAmount)}/mo</span>
          {goal.mode === 'accumulate' && runningTotal !== undefined && <span>→ {formatCurrencyCompact(runningTotal)}</span>}
        </div>
      ) : (
        <>
          <span className={`goal-card__mode-badge goal-card__mode-badge--${goal.mode}`}>
            {goal.mode === 'accumulate' ? 'saving' : 'spending'}
          </span>

          <Slider
            id={`${goal.id}-monthly-amount`}
            label="Monthly amount"
            range={goal.monthlyAmountRange}
            value={goal.monthlyAmount}
            onChange={(value) => onUpdate(goal.id, { monthlyAmount: value })}
            valueLabel={`${formatCurrency(goal.monthlyAmount)}/mo`}
          />

          {goal.mode === 'accumulate' && !isProperty && (
            <Slider
              id={`${goal.id}-target-amount`}
              label="Target amount"
              range={TARGET_AMOUNT_RANGE}
              value={goal.targetAmount ?? 0}
              onChange={(value) => onUpdate(goal.id, { targetAmount: value > 0 ? value : undefined })}
              valueLabel={goal.targetAmount ? formatCurrency(goal.targetAmount) : 'No target'}
            />
          )}

          {canAllocateCash(goal) && (
            <Slider
              id={`${goal.id}-cash-allocated`}
              label="From cash today"
              range={{ min: 0, max: cashRemaining + goal.cashAllocated, step: ALLOCATION_STEP }}
              value={goal.cashAllocated}
              onChange={(value) => onUpdate(goal.id, { cashAllocated: value })}
              valueLabel={formatCurrency(goal.cashAllocated)}
            />
          )}

          {canAllocateBrokerage(goal) && (
            <Slider
              id={`${goal.id}-brokerage-allocated`}
              label="From brokerage today"
              range={{ min: 0, max: brokerageRemaining + goal.brokerageAllocated, step: ALLOCATION_STEP }}
              value={goal.brokerageAllocated}
              onChange={(value) => onUpdate(goal.id, { brokerageAllocated: value })}
              valueLabel={formatCurrency(goal.brokerageAllocated)}
            />
          )}

          {equityProjection && equityProjection.equity > 0 && (
            <label className="goal-card__toggle">
              <input
                type="checkbox"
                checked={goal.equityAllocated}
                onChange={(event) => onUpdate(goal.id, { equityAllocated: event.target.checked })}
              />
              <Tooltip
                tip={`Projected in year ${goal.endYear}: ${formatCurrency(equityProjection.homeValue)} home value − ${formatCurrency(equityProjection.mortgageBalance)} remaining mortgage = ${formatCurrency(equityProjection.equity)} equity. Grows with home appreciation and mortgage paydown, not the market investment return.`}
              >
                Use home equity
              </Tooltip>
              {' '}({formatCurrency(equityProjection.equity)} projected)
            </label>
          )}

          {goal.mode === 'accumulate' && isProperty && (
            <>
              <Slider
                id={`${goal.id}-purchase-price`}
                label="Total property price"
                range={PURCHASE_PRICE_RANGE}
                value={goal.purchasePriceK ?? 0}
                onChange={(value) => onUpdate(goal.id, { purchasePriceK: value })}
                valueLabel={formatCurrency((goal.purchasePriceK ?? 0) * 1000)}
              />
              <Slider
                id={`${goal.id}-mortgage-rate`}
                label="Mortgage rate"
                range={MORTGAGE_RATE_RANGE}
                value={goal.mortgageRatePct ?? 0}
                onChange={(value) => onUpdate(goal.id, { mortgageRatePct: value })}
                valueLabel={`${(goal.mortgageRatePct ?? 0).toFixed(2)}%`}
              />
              {mortgageEstimate && mortgageEstimate.purchasePrice > 0 && (
                <div className="goal-card__mortgage-preview">
                  <Tooltip
                    tip={`${formatCurrency(mortgageEstimate.purchasePrice)} price − ${formatCurrency(mortgageEstimate.downPayment)} down payment = ${formatCurrency(mortgageEstimate.loanAmount)} loan, amortized at ${(goal.mortgageRatePct ?? 0).toFixed(2)}% over ${MORTGAGE_TERM_YEARS}yr.`}
                  >
                    Estimated mortgage payment
                  </Tooltip>
                  :{' '}
                  <span className="goal-card__mortgage-preview-value">{formatCurrency(mortgageEstimate.monthlyPayment)}/mo</span>
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
                <Slider
                  id={`${goal.id}-post-purchase-cost`}
                  label="Post-purchase monthly cost"
                  range={POST_PURCHASE_COST_RANGE}
                  value={goal.postPurchaseMonthlyCost ?? 0}
                  onChange={(value) => onUpdate(goal.id, { postPurchaseMonthlyCost: value })}
                  valueLabel={`${formatCurrency(goal.postPurchaseMonthlyCost ?? 0)}/mo`}
                />
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

          <div className="goal-card__footer">
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

            <button type="button" className="goal-card__delete" onClick={() => onRemove(goal.id)}>
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
