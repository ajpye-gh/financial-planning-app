/** A goal's fixed purpose, assigned once at creation from the catalog and never edited afterward
 *  (renaming the goal's display `name` doesn't change this) - it's what the asset-allocation rules
 *  in `canAllocateCash`/`canAllocateBrokerage`/`canAllocateEquity` key off of, since `name` is free
 *  text. */
export type GoalCategory = 'emergency' | 'retirement' | 'other' | 'property';

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
  /** Set once at creation, `true` only for the "First home purchase" catalog entry - never edited
   *  afterward, same as `category` (see the comment above `GoalCategory`). Distinguishes it from the
   *  "Move-up purchase" catalog entry, which shares `category: 'property'` but - unlike a first
   *  purchase - legitimately can roll over equity from a home the household already owns (see
   *  `canAllocateEquity`). Optional so an older saved plan predating this field still validates
   *  (`isValidGoal`) and loads; treated as `false` (permissive - equity stays allowed) when absent,
   *  since we can't positively identify a pre-existing goal as a first purchase from missing data. */
  isFirstPurchase?: boolean;
  monthlyAmount: number;
  monthlyAmountRange: { min: number; max: number; step: number };
  /** Inclusive 1-indexed year range this goal is active. Outside it, the goal contributes $0 - an
   *  `accumulate` balance keeps growing before startYear (money invested early still compounds) but
   *  freezes entirely after endYear (see model.ts's advanceGoalBalances - the goal is considered
   *  reached/realized at that point, not still sitting invested). */
  startYear: number;
  endYear: number;
  /** A savings target to compare the projected balance against (see the goal card's "Balance: $X /
   *  $Y target" line) - purely informational, doesn't feed back into the projection. Not used for
   *  `category: 'property'` goals - "Total property price" (purchasePriceK) already captures the
   *  number that matters there, so a separate target would be redundant (see `sanitizeGoal`). */
  targetAmount?: number;
  /** One-time starting balance carried over from your current Cash today - only ever nonzero for
   *  `category: 'emergency'` goals (see `canAllocateCash`). */
  cashAllocated: number;
  /** One-time starting balance carried over from your current Brokerage today - never allowed for
   *  `category: 'retirement'` goals (see `canAllocateBrokerage`). */
  brokerageAllocated: number;
  /** All-or-nothing: whether this goal claims your current home's equity, realistically projected
   *  (home appreciation minus mortgage paydown - see model.ts's projectHomeEquity) and injected once,
   *  at this goal's endYear - not added to the Y0 starting balance and compounded at the market
   *  investment return like cash/brokerage (a house isn't a brokerage account). Only ever `true` for
   *  `category: 'property'` goals (see `canAllocateEquity`), and only for one goal at a time - equity
   *  is a single real-world pool, so setting it on one goal clears it from every other (see
   *  `enforceExclusiveEquity`). */
  equityAllocated: boolean;
  /** Whether this goal's balance gets "spent" on a purchase at endYear, producing an ongoing
   *  monthly cost afterward (see model.ts's activePropertyGoal/isPurchaseGoal usage). Always `true`
   *  for `category: 'property'` goals (a property goal is inherently a purchase - not user-toggled,
   *  see `sanitizeGoal`); optional for any other accumulate goal (e.g. a boat). */
  isPurchase: boolean;
  /** Total purchase price, thousands - only meaningful for `category: 'property'`. Combined with the
   *  goal's projected ending balance (the down payment) and `mortgageRatePct`, estimates the monthly
   *  mortgage payment that replaces your base housing cost once the purchase completes. */
  purchasePriceK?: number;
  /** Only meaningful for `category: 'property'` - a per-goal assumption, not global, since a future
   *  purchase's prevailing rate can differ from today's. Loan term is a fixed 30yr, not a field. */
  mortgageRatePct?: number;
  /** Manually-estimated ongoing monthly cost once the purchase completes - only meaningful when
   *  `isPurchase && category !== 'property'` (property estimates its cost from the mortgage fields
   *  above instead). Adds on top of expenses, unlike a property purchase which replaces housing cost. */
  postPurchaseMonthlyCost?: number;
}

/** mode: 'accumulate' && isPurchase - the goal's balance is "spent" at endYear rather than staying
 *  invested, producing an ongoing monthly cost from then on (see model.ts). */
export function isPurchaseGoal(goal: Pick<RecurringGoal, 'mode' | 'isPurchase'>): boolean {
  return goal.mode === 'accumulate' && goal.isPurchase;
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

/** Home equity can only seed a property goal - it's the one asset class actually tied to owning a
 *  home, so it doesn't make sense to offer it anywhere else. Further excludes a first-purchase goal
 *  even though it shares `category: 'property'` with a move-up purchase: equity can only be rolled
 *  over from a home you already own, and a first purchase is by definition for someone who doesn't
 *  own one yet. */
export function canAllocateEquity(goal: Pick<RecurringGoal, 'mode' | 'category' | 'isFirstPurchase'>): boolean {
  return goal.mode === 'accumulate' && goal.category === 'property' && !goal.isFirstPurchase;
}

/** Zeroes out any allocation, or purchase field, a goal's mode/category doesn't permit - e.g.
 *  brokerage assigned to a retirement goal, either allocation on a consume-mode goal (no balance to
 *  seed), or a mortgage rate on a non-property goal. Also enforces that `isPurchase` is always `true`
 *  for a property goal (inherently a purchase, not user-toggled) and clears the manual
 *  postPurchaseMonthlyCost estimate for property goals (they estimate their cost from the mortgage
 *  fields instead - see model.ts). */
export function sanitizeGoal(goal: RecurringGoal): RecurringGoal {
  const isProperty = goal.category === 'property';
  const isPurchase = isProperty || goal.isPurchase;
  return {
    ...goal,
    targetAmount: isProperty ? undefined : goal.targetAmount,
    isFirstPurchase: isProperty ? goal.isFirstPurchase === true : false,
    cashAllocated: canAllocateCash(goal) ? goal.cashAllocated : 0,
    brokerageAllocated: canAllocateBrokerage(goal) ? goal.brokerageAllocated : 0,
    equityAllocated: canAllocateEquity(goal) ? goal.equityAllocated : false,
    isPurchase,
    purchasePriceK: isProperty ? goal.purchasePriceK : undefined,
    mortgageRatePct: isProperty ? goal.mortgageRatePct : undefined,
    postPurchaseMonthlyCost: isPurchase && !isProperty ? goal.postPurchaseMonthlyCost : undefined,
  };
}

/** Home equity is a single real-world pool, not a shared budget like cash/brokerage - so unlike
 *  `rebalanceAllocations`, this doesn't scale amounts down, it just enforces that at most one goal
 *  has it allocated at a time. Called whenever a goal's `equityAllocated` is set to `true`. */
export function enforceExclusiveEquity(goals: RecurringGoal[], allocatedGoalId: string): RecurringGoal[] {
  return goals.map((goal) => (goal.id === allocatedGoalId ? goal : { ...goal, equityAllocated: false }));
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
const NO_ALLOCATION = { cashAllocated: 0, brokerageAllocated: 0, equityAllocated: false, isPurchase: false, isFirstPurchase: false };
// Property goals default to a realistic near-term purchase year instead of the full 18-year
// horizon other catalog entries use - buying in "year 18" wouldn't exercise the post-purchase
// housing-cost replacement in any reasonable demo/testing.
const PROPERTY_HORIZON = { startYear: 1, endYear: 5 };

// 'retirement' stays a valid GoalCategory (see above) even though it's no longer offered here -
// retirement planning now lives on its own page (RetirementPage.tsx) - so an already-saved plan
// with an old retirement goal still loads and validates correctly.
export const GOAL_CATALOG: GoalCatalogEntry[] = [
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
    label: 'First home purchase',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'First home purchase',
      mode: 'accumulate',
      category: 'property',
      monthlyAmount: 500,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      purchasePriceK: 300,
      mortgageRatePct: 6.5,
      ...PROPERTY_HORIZON,
      ...NO_ALLOCATION,
      isPurchase: true,
      isFirstPurchase: true,
    }),
  },
  {
    label: 'Move-up purchase (equity rollover)',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Move-up purchase',
      mode: 'accumulate',
      category: 'property',
      monthlyAmount: 500,
      monthlyAmountRange: { ...DEFAULT_RANGE },
      purchasePriceK: 500,
      mortgageRatePct: 6.5,
      ...PROPERTY_HORIZON,
      ...NO_ALLOCATION,
      isPurchase: true,
    }),
  },
  {
    label: 'Emergency fund',
    create: (id) => ({
      kind: 'recurring',
      id,
      name: 'Emergency fund',
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
  return value === 'emergency' || value === 'retirement' || value === 'other' || value === 'property';
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

/** cashAllocated/brokerageAllocated/equityAllocated - the one-time asset-allocation fields. */
function isValidAllocationFields(goal: Record<string, unknown>): boolean {
  return (
    isValidAllocation(goal.cashAllocated) &&
    isValidAllocation(goal.brokerageAllocated) &&
    typeof goal.equityAllocated === 'boolean'
  );
}

/** isPurchase, its optional property/manual-cost fields, and isFirstPurchase - see the RecurringGoal
 *  doc comments. isFirstPurchase is optional (unlike isPurchase) so a goal saved before the field
 *  existed still validates - see its doc comment on RecurringGoal. */
function isValidPurchaseFields(goal: Record<string, unknown>): boolean {
  if (typeof goal.isPurchase !== 'boolean') {
    return false;
  }
  if (goal.isFirstPurchase !== undefined && typeof goal.isFirstPurchase !== 'boolean') {
    return false;
  }
  if (goal.purchasePriceK !== undefined && !isFiniteNumber(goal.purchasePriceK)) {
    return false;
  }
  if (goal.mortgageRatePct !== undefined && !isFiniteNumber(goal.mortgageRatePct)) {
    return false;
  }
  return goal.postPurchaseMonthlyCost === undefined || isFiniteNumber(goal.postPurchaseMonthlyCost);
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
  if (!isValidAllocationFields(goal)) {
    return false;
  }
  if (!isValidPurchaseFields(goal)) {
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
