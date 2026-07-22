/** A goal's fixed purpose, assigned once at creation from the catalog and never edited afterward
 *  (renaming the goal's display `name` doesn't change this) - it's what the asset-allocation rules
 *  in `canAllocateCash`/`canAllocateBrokerage` key off of, since `name` is free text. */
export type GoalCategory = 'emergency' | 'retirement' | 'other';

/**
 * Monthly amount that either accumulates (grows at the investment return) or is pure consumption.
 *
 * This is the first of three goal kinds from SPEC.md §4.3 (`BigPurchaseGoal` and `DebtPayoffGoal`
 * come in later phases per the roadmap in §8) — the field shape here (`kind` discriminant, own `id`)
 * is deliberately forward-compatible with `Goal` becoming a union once those land.
 */
export interface RecurringGoal {
  kind: 'recurring';
  id: string;
  name: string;
  mode: 'accumulate' | 'consume';
  category: GoalCategory;
  monthlyAmount: number;
  monthlyAmountRange: { min: number; max: number; step: number };
  /** Inclusive 1-indexed year range this goal is active. Outside it, the goal contributes $0 -
   *  but an `accumulate` balance keeps compounding at the investment return even after `endYear`. */
  startYear: number;
  endYear: number;
  targetAmount?: number;
  /** One-time starting balance carried over from your current Cash today - only ever nonzero for
   *  `category: 'emergency'` goals (see `canAllocateCash`). */
  cashAllocated: number;
  /** One-time starting balance carried over from your current Brokerage today - never allowed for
   *  `category: 'retirement'` goals (see `canAllocateBrokerage`). */
  brokerageAllocated: number;
}

export type Goal = RecurringGoal;

/** Cash today can only ever seed the emergency fund - it's meant to stay liquid, not get locked into
 *  a purpose-specific goal like college or a big purchase. */
export function canAllocateCash(goal: Pick<RecurringGoal, 'mode' | 'category'>): boolean {
  return goal.mode === 'accumulate' && goal.category === 'emergency';
}

/** Brokerage today can seed most goals, but never retirement savings - that's meant to build up
 *  fresh via its own monthly contribution, not get a head start from money earmarked for other things. */
export function canAllocateBrokerage(goal: Pick<RecurringGoal, 'mode' | 'category'>): boolean {
  return goal.mode === 'accumulate' && goal.category !== 'retirement';
}

/** Zeroes out any allocation a goal's mode/category doesn't permit - e.g. brokerage assigned to a
 *  retirement goal, or either allocation on a consume-mode goal (no balance to seed). */
export function sanitizeAllocations(goal: RecurringGoal): RecurringGoal {
  return {
    ...goal,
    cashAllocated: canAllocateCash(goal) ? goal.cashAllocated : 0,
    brokerageAllocated: canAllocateBrokerage(goal) ? goal.brokerageAllocated : 0,
  };
}

function rebalanceField(goals: RecurringGoal[], field: 'cashAllocated' | 'brokerageAllocated', total: number): RecurringGoal[] {
  const sum = goals.reduce((runningTotal, goal) => runningTotal + goal[field], 0);
  if (sum <= total || sum === 0) {
    return goals;
  }
  const factor = total / sum;
  return goals.map((goal) => ({ ...goal, [field]: Math.round(goal[field] * factor) }));
}

/** Scales every goal's cash/brokerage allocation down proportionally if their sum now exceeds what's
 *  actually available - e.g. after the user drags the base Cash today / Brokerage today slider down
 *  below what's already promised to goals. A no-op whenever there's enough to go around. */
export function rebalanceAllocations(goals: RecurringGoal[], totalCash: number, totalBrokerage: number): RecurringGoal[] {
  return rebalanceField(rebalanceField(goals, 'cashAllocated', totalCash), 'brokerageAllocated', totalBrokerage);
}

// Matches model.ts's HORIZON_YEARS. Not imported from there to avoid a runtime import cycle
// (model.ts imports RecurringGoal from this module, albeit only as a type).
const DEFAULT_END_YEAR = 18;

let fallbackIdCounter = 0;

/** crypto.randomUUID() isn't guaranteed available in every runtime (older browsers, some test environments). */
export function generateGoalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `goal-${Date.now().toString(36)}-${fallbackIdCounter}`;
}

export interface GoalCatalogEntry {
  label: string;
  create: (id: string) => RecurringGoal;
}

const DEFAULT_RANGE = { min: 0, max: 5000, step: 100 };
const FULL_HORIZON = { startYear: 1, endYear: DEFAULT_END_YEAR };
const NO_ALLOCATION = { cashAllocated: 0, brokerageAllocated: 0 };

export const GOAL_CATALOG: GoalCatalogEntry[] = [
  {
    label: 'Retirement savings',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Retirement savings',
      mode: 'accumulate',
      category: 'retirement',
      monthlyAmount: 1000,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
  {
    label: 'Travel',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Travel',
      mode: 'consume',
      category: 'other',
      monthlyAmount: 300,
      monthlyAmountRange: { min: 0, max: 3000, step: 50 },
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
  {
    label: 'College savings',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'College savings',
      mode: 'accumulate',
      category: 'other',
      monthlyAmount: 300,
      monthlyAmountRange: { min: 0, max: 3000, step: 50 },
      targetAmount: 200000,
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
  {
    label: 'Emergency fund top-up',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Emergency fund top-up',
      mode: 'accumulate',
      category: 'emergency',
      monthlyAmount: 200,
      monthlyAmountRange: { min: 0, max: 2000, step: 25 },
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
  {
    label: 'Custom savings goal',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Custom goal',
      mode: 'accumulate',
      category: 'other',
      monthlyAmount: 200,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
  {
    label: 'Custom spending goal',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Custom goal',
      mode: 'consume',
      category: 'other',
      monthlyAmount: 200,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      ...FULL_HORIZON,
      ...NO_ALLOCATION,
    }),
  },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidCategory(value: unknown): value is GoalCategory {
  return value === 'emergency' || value === 'retirement' || value === 'other';
}

function isValidAllocation(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0;
}

function isValidMonthlyAmountRange(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const range = value as Record<string, unknown>;
  return (
    isFiniteNumber(range.min) &&
    isFiniteNumber(range.max) &&
    isFiniteNumber(range.step) &&
    range.min <= range.max &&
    range.step > 0
  );
}

export function isValidGoal(value: unknown): value is Goal {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const goal = value as Record<string, unknown>;
  if (goal.kind !== 'recurring') {
    return false;
  }
  if (typeof goal.id !== 'string' || goal.id.length === 0) {
    return false;
  }
  if (typeof goal.name !== 'string' || goal.name.length === 0) {
    return false;
  }
  if (goal.mode !== 'accumulate' && goal.mode !== 'consume') {
    return false;
  }
  if (!isValidCategory(goal.category)) {
    return false;
  }
  if (!isFiniteNumber(goal.monthlyAmount)) {
    return false;
  }
  if (!isValidAllocation(goal.cashAllocated) || !isValidAllocation(goal.brokerageAllocated)) {
    return false;
  }
  if (!isFiniteNumber(goal.startYear) || !isFiniteNumber(goal.endYear) || goal.startYear > goal.endYear) {
    return false;
  }
  if (!isValidMonthlyAmountRange(goal.monthlyAmountRange)) {
    return false;
  }
  if (goal.targetAmount !== undefined && !isFiniteNumber(goal.targetAmount)) {
    return false;
  }
  return true;
}
