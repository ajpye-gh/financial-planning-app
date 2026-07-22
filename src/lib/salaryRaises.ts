export interface SalaryRaiseBreakpoint {
  id: string;
  /** 1-indexed year this cumulative raise (above `salaryY0K`) is reached by. */
  year: number;
  raiseK: number;
}

// Matches model.ts's HORIZON_YEARS. Not imported from there to avoid a runtime import cycle
// (model.ts imports SalaryRaiseBreakpoint from this module, albeit only as a type).
const HORIZON_YEARS = 18;

let fallbackIdCounter = 0;

/** crypto.randomUUID() isn't guaranteed available in every runtime (older browsers, some test environments). */
export function generateBreakpointId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `raise-${Date.now().toString(36)}-${fallbackIdCounter}`;
}

export const DEFAULT_SALARY_RAISES: Array<Omit<SalaryRaiseBreakpoint, 'id'>> = [
  { year: 1, raiseK: 5 },
  { year: 4, raiseK: 20 },
  { year: 6, raiseK: 30 },
  { year: 10, raiseK: 50 },
];

/** Sensible defaults for a newly added breakpoint: one year past (and matching the raise of) the
 *  latest existing one, or year 1 with no raise if the list is empty. */
export function nextBreakpoint(existing: SalaryRaiseBreakpoint[]): Omit<SalaryRaiseBreakpoint, 'id'> {
  if (existing.length === 0) {
    return { year: 1, raiseK: 0 };
  }
  const last = existing.reduce((a, b) => (a.year > b.year ? a : b), existing[0]);
  return { year: Math.min(last.year + 1, HORIZON_YEARS), raiseK: last.raiseK };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidBreakpoint(value: unknown): value is SalaryRaiseBreakpoint {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const breakpoint = value as Record<string, unknown>;
  if (typeof breakpoint.id !== 'string' || breakpoint.id.length === 0) {
    return false;
  }
  if (!isFiniteNumber(breakpoint.year) || breakpoint.year < 1 || breakpoint.year > HORIZON_YEARS) {
    return false;
  }
  if (!isFiniteNumber(breakpoint.raiseK)) {
    return false;
  }
  return true;
}
