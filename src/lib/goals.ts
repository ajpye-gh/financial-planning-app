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
  targetAmount?: number;
}

export type Goal = RecurringGoal;

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

const DEFAULT_RANGE = { min: 0, max: 2000, step: 25 };

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
      targetAmount: 80000,
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
