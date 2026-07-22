export interface Child {
  id: string;
  /** Year this child arrives; 0 means already part of the household today. */
  year: number;
}

// Matches model.ts's HORIZON_YEARS. Not imported from there to avoid a runtime import cycle
// (model.ts imports Child from this module, albeit only as a type).
const HORIZON_YEARS = 18;

let fallbackIdCounter = 0;

/** crypto.randomUUID() isn't guaranteed available in every runtime (older browsers, some test environments). */
export function generateChildId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `child-${Date.now().toString(36)}-${fallbackIdCounter}`;
}

/** Sensible default for a newly added child: today (year 0) if the list is empty, one year past the
 *  latest existing arrival otherwise. */
export function nextChildYear(existing: Child[]): number {
  if (existing.length === 0) {
    return 0;
  }
  const last = existing.reduce((a, b) => (a.year > b.year ? a : b), existing[0]);
  return Math.min(last.year + 1, HORIZON_YEARS);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isValidChild(value: unknown): value is Child {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const child = value as Record<string, unknown>;
  if (typeof child.id !== 'string' || child.id.length === 0) {
    return false;
  }
  if (!isFiniteNumber(child.year) || child.year < 0 || child.year > HORIZON_YEARS) {
    return false;
  }
  return true;
}
