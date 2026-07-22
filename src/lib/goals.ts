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
  monthlyAmount: number;
  monthlyAmountRange: { min: number; max: number; step: number };
  /** Inclusive 1-indexed year range this goal is active. Outside it, the goal contributes $0 -
   *  but an `accumulate` balance keeps compounding at the investment return even after `endYear`. */
  startYear: number;
  endYear: number;
  targetAmount?: number;
}

export type Goal = RecurringGoal;

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

export const GOAL_CATALOG: GoalCatalogEntry[] = [
  {
    label: 'Travel',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Travel',
      mode: 'consume',
      monthlyAmount: 300,
      monthlyAmountRange: { min: 0, max: 3000, step: 50 },
      ...FULL_HORIZON,
    }),
  },
  {
    label: 'College savings',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'College savings',
      mode: 'accumulate',
      monthlyAmount: 300,
      monthlyAmountRange: { min: 0, max: 3000, step: 50 },
      targetAmount: 200000,
      ...FULL_HORIZON,
    }),
  },
  {
    label: 'Emergency fund top-up',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Emergency fund top-up',
      mode: 'accumulate',
      monthlyAmount: 200,
      monthlyAmountRange: { min: 0, max: 2000, step: 25 },
      ...FULL_HORIZON,
    }),
  },
  {
    label: 'Custom savings goal',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Custom goal',
      mode: 'accumulate',
      monthlyAmount: 200,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      ...FULL_HORIZON,
    }),
  },
  {
    label: 'Custom spending goal',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Custom goal',
      mode: 'consume',
      monthlyAmount: 200,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      ...FULL_HORIZON,
    }),
  },
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
  if (!isFiniteNumber(goal.monthlyAmount)) {
    return false;
  }
  if (!isFiniteNumber(goal.startYear) || !isFiniteNumber(goal.endYear) || goal.startYear > goal.endYear) {
    return false;
  }
  const rangeValue: unknown = goal.monthlyAmountRange;
  if (typeof rangeValue !== 'object' || rangeValue === null) {
    return false;
  }
  const range = rangeValue as Record<string, unknown>;
  if (
    !isFiniteNumber(range.min) ||
    !isFiniteNumber(range.max) ||
    !isFiniteNumber(range.step) ||
    range.min > range.max ||
    range.step <= 0
  ) {
    return false;
  }
  if (goal.targetAmount !== undefined && !isFiniteNumber(goal.targetAmount)) {
    return false;
  }
  return true;
}
