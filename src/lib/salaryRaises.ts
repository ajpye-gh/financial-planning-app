export interface SalaryRaiseBreakpoint {
  id: string;
  /** 1-indexed year this income level is reached by. */
  year: number;
  /** The ABSOLUTE gross income (in $K) this stream reaches by `year` - not a delta above
   *  `salaryY0K`. e.g. a $100k earner expecting $105k by year 2 sets incomeK: 105, not 5. See
   *  model.ts's `buildStreamContext`/`incomeAtYear` for how this is interpolated into a full curve. */
  incomeK: number;
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

/** Absolute income targets equivalent to the old delta-based defaults (+$5k/+$20k/+$30k/+$50k above
 *  a $70k salaryY0K - see Defaults.json's salaryY0K.default) so the shipped default curve is
 *  unchanged, just expressed the new way: $75k by yr1, $90k by yr4, $100k by yr6, $120k by yr10. */
export const DEFAULT_SALARY_RAISES: Array<Omit<SalaryRaiseBreakpoint, 'id'>> = [
  { year: 1, incomeK: 75 },
];

/** Sensible defaults for a newly added breakpoint: one year past (and matching the income of) the
 *  latest existing one, or year 1 at the stream's current starting salary if the list is empty (an
 *  absolute-income breakpoint needs *some* starting point, and "no change yet" is it). */
export function nextBreakpoint(existing: SalaryRaiseBreakpoint[], salaryY0K: number): Omit<SalaryRaiseBreakpoint, 'id'> {
  if (existing.length === 0) {
    return { year: 1, incomeK: salaryY0K };
  }
  const last = existing.reduce((a, b) => (a.year > b.year ? a : b), existing[0]);
  return { year: Math.min(last.year + 1, HORIZON_YEARS), incomeK: last.incomeK };
}

/** Applies `patch` to the breakpoint `id`, then enforces an income curve that's non-decreasing in
 *  year order: a breakpoint can never sit below the one before it, and pushing one above later
 *  breakpoints drags them up to match ("move in unison") rather than letting income dip partway
 *  through the timeline (which would silently model a pay cut - see model.ts's income formula).
 *
 *  This only enforces monotonicity *among the breakpoints themselves* - it has no visibility into
 *  salaryY0K (not threaded through this call), so it can't stop a breakpoint from sitting below the
 *  stream's *starting* salary if salaryY0K is raised independently afterward. model.ts's
 *  `buildStreamContext` defensively floors every milestone at salaryY0K too, at evaluation time, so
 *  the computed income curve is guaranteed non-decreasing from Y0 regardless of edit order - even
 *  though the raw breakpoint list (and its slider) could theoretically still display a value below
 *  the current salaryY0K until it's next touched. */
export function applyRaiseUpdate(
  breakpoints: SalaryRaiseBreakpoint[],
  id: string,
  patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>,
): SalaryRaiseBreakpoint[] {
  const patched = breakpoints.map((breakpoint) => (breakpoint.id === id ? { ...breakpoint, ...patch } : breakpoint));
  const ascendingByYear = [...patched].sort((a, b) => a.year - b.year);

  let floor = 0;
  const incomeById = new Map<string, number>();
  for (const breakpoint of ascendingByYear) {
    const incomeK = Math.max(breakpoint.incomeK, floor);
    incomeById.set(breakpoint.id, incomeK);
    floor = incomeK;
  }

  return patched.map((breakpoint) => ({ ...breakpoint, incomeK: incomeById.get(breakpoint.id) ?? breakpoint.incomeK }));
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
  if (!isFiniteNumber(breakpoint.incomeK)) {
    return false;
  }
  return true;
}
