import type { Answers } from './questions';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from './baseData';
import { isValidChild, type Child } from './children';
import { isValidGoal, type Goal } from './goals';
import { DEFAULT_SALARY_RAISES, generateBreakpointId, isValidBreakpoint, type SalaryRaiseBreakpoint } from './salaryRaises';

// Matches model.ts's HORIZON_YEARS. Not imported from there to avoid a runtime import cycle
// (model.ts imports these modules' types, and importing back would be circular).
const HORIZON_YEARS = 18;

/** Everything needed to reproduce a household scenario end to end - the unit both the autosaved
 *  draft and a named Save/Load slot are shaped as. */
export interface Plan {
  answers: Answers;
  baseInputs: BaseInputs;
  goals: Goal[];
  salaryRaises: SalaryRaiseBreakpoint[];
  jobLossYear: number | undefined;
  partnerSalaryRaises: SalaryRaiseBreakpoint[];
  partnerJobLossYear: number | undefined;
  children: Child[];
}

export function freshPlan(): Plan {
  return {
    answers: { housing: 'own' },
    baseInputs: baseDefaults(DEFAULT_BASE_RANGES),
    goals: [],
    salaryRaises: DEFAULT_SALARY_RAISES.map((breakpoint) => ({ id: generateBreakpointId(), ...breakpoint })),
    jobLossYear: undefined,
    partnerSalaryRaises: [],
    partnerJobLossYear: undefined,
    children: [],
  };
}

export function isValidJobLossYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= HORIZON_YEARS;
}

/** Strict, all-or-nothing validation for a saved plan - unlike the autosaved draft (which recovers
 *  field-by-field from partial corruption, see useDraftState.ts's loadDraft), a named Save/Load is an
 *  explicit user action, so a malformed plan should fail clearly instead of silently loading a
 *  patchwork of defaults. */
export function isValidPlan(value: unknown): value is Plan {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const plan = value as Record<string, unknown>;
  if (typeof plan.answers !== 'object' || plan.answers === null) {
    return false;
  }
  if (typeof plan.baseInputs !== 'object' || plan.baseInputs === null) {
    return false;
  }
  if (!Array.isArray(plan.goals) || !plan.goals.every(isValidGoal)) {
    return false;
  }
  if (!Array.isArray(plan.salaryRaises) || !plan.salaryRaises.every(isValidBreakpoint)) {
    return false;
  }
  if (!Array.isArray(plan.partnerSalaryRaises) || !plan.partnerSalaryRaises.every(isValidBreakpoint)) {
    return false;
  }
  if (!Array.isArray(plan.children) || !plan.children.every(isValidChild)) {
    return false;
  }
  if (plan.jobLossYear !== undefined && !isValidJobLossYear(plan.jobLossYear)) {
    return false;
  }
  if (plan.partnerJobLossYear !== undefined && !isValidJobLossYear(plan.partnerJobLossYear)) {
    return false;
  }
  return true;
}

const PLANS_STORAGE_KEY = 'financial-planning-app:plans';

type PlanRegistry = Record<string, Plan>;

/** Corrupt entries are dropped individually rather than invalidating the whole registry - one bad
 *  save shouldn't take down every other saved plan. */
function readRegistry(): PlanRegistry {
  try {
    const raw = localStorage.getItem(PLANS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }
    const registry: PlanRegistry = {};
    for (const [name, candidate] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidPlan(candidate)) {
        registry[name] = candidate;
      }
    }
    return registry;
  } catch {
    return {};
  }
}

/** Saved plan names, alphabetical. */
export function listSavedPlans(): string[] {
  return Object.keys(readRegistry()).sort((a, b) => a.localeCompare(b));
}

export function savePlan(name: string, plan: Plan): void {
  const registry = readRegistry();
  registry[name] = plan;
  localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(registry));
}

export function loadSavedPlan(name: string): Plan | null {
  return readRegistry()[name] ?? null;
}
