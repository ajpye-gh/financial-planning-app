import { useCallback, useEffect, useState } from 'react';
import { useTravel } from 'use-travel';
import type { Answers } from '../lib/questions';
import type { BaseInputs } from '../lib/baseData';
import type { BaseFieldId } from '../lib/baseFields';
import { generateChildId, isValidChild, nextChildYear, type Child } from '../lib/children';
import { enforceExclusiveEquity, isValidGoal, rebalanceAllocations, sanitizeGoal, type Goal } from '../lib/goals';
import { freshPlan, isValidJobLossYear, type Plan } from '../lib/plans';
import {
  applyRaiseUpdate,
  generateBreakpointId,
  isValidBreakpoint,
  nextBreakpoint,
  type SalaryRaiseBreakpoint,
} from '../lib/salaryRaises';

const STORAGE_KEY = 'pyenancial:draft';
const AUTOSAVE_DEBOUNCE_MS = 400;
const MAX_HISTORY = 50;
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'password', 'tel', 'number']);

function loadDraft(): Plan {
  const fresh = freshPlan();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fresh;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return fresh;
    }
    const record = parsed as Record<string, unknown>;

    const goals = Array.isArray(record.goals) ? record.goals.filter(isValidGoal) : fresh.goals;
    const salaryRaises = Array.isArray(record.salaryRaises)
      ? record.salaryRaises.filter(isValidBreakpoint)
      : fresh.salaryRaises;
    const partnerSalaryRaises = Array.isArray(record.partnerSalaryRaises)
      ? record.partnerSalaryRaises.filter(isValidBreakpoint)
      : fresh.partnerSalaryRaises;
    const jobLossYear = isValidJobLossYear(record.jobLossYear) ? record.jobLossYear : fresh.jobLossYear;
    const partnerJobLossYear = isValidJobLossYear(record.partnerJobLossYear)
      ? record.partnerJobLossYear
      : fresh.partnerJobLossYear;
    const children = Array.isArray(record.children) ? record.children.filter(isValidChild) : fresh.children;

    const answersValue: unknown = record.answers;
    const answers = typeof answersValue === 'object' && answersValue !== null ? (answersValue as Answers) : fresh.answers;

    const baseInputsValue: unknown = record.baseInputs;
    const baseInputs = {
      ...fresh.baseInputs,
      ...(typeof baseInputsValue === 'object' && baseInputsValue !== null ? baseInputsValue : {}),
    };

    return { answers, baseInputs, goals, salaryRaises, jobLossYear, partnerSalaryRaises, partnerJobLossYear, children };
  } catch {
    // Corrupt/inaccessible localStorage - autosave is best-effort, fall back to a fresh draft.
    return fresh;
  }
}

export interface UseDraftStateResult {
  answers: Answers;
  setAnswer: (id: string, value: boolean | string) => void;
  baseInputs: BaseInputs;
  setBaseInput: (id: BaseFieldId, value: number) => void;
  goals: Goal[];
  addGoal: (goal: Goal) => void;
  removeGoal: (id: string) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  salaryRaises: SalaryRaiseBreakpoint[];
  addSalaryRaise: () => void;
  removeSalaryRaise: (id: string) => void;
  updateSalaryRaise: (id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => void;
  jobLossYear: number | undefined;
  setJobLossYear: (year: number) => void;
  clearJobLossYear: () => void;
  partnerSalaryRaises: SalaryRaiseBreakpoint[];
  addPartnerSalaryRaise: () => void;
  removePartnerSalaryRaise: (id: string) => void;
  updatePartnerSalaryRaise: (id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => void;
  partnerJobLossYear: number | undefined;
  setPartnerJobLossYear: (year: number) => void;
  clearPartnerJobLossYear: () => void;
  children: Child[];
  addChild: () => void;
  removeChild: (id: string) => void;
  updateChild: (id: string, year: number) => void;
  /** Current draft, shaped for a named Save (see lib/plans.ts). */
  planForSaving: () => Plan;
  /** Replaces the entire draft with a loaded plan (see lib/plans.ts). */
  loadPlan: (plan: Plan) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** True while a change is debounced/pending write to the autosave slot - drives the toolbar's
   *  saving indicator. */
  isAutosaving: boolean;
}

export function useDraftState(): UseDraftStateResult {
  const [initialDraft] = useState(loadDraft);
  const [draft, setDraft, { back, forward, canUndo, canRedo }] = useTravel<Plan, false, true>(initialDraft, {
    maxHistory: MAX_HISTORY,
  });
  const [isAutosaving, setIsAutosaving] = useState(false);

  // Marks a change as pending right where it originates (an event handler), rather than inferring
  // "pending" reactively from a `useEffect` keyed on `draft` - setState belongs in the handler that
  // causes it, not synchronously in an effect body watching for it after the fact.
  const updateDraft = useCallback((updater: Parameters<typeof setDraft>[0]) => {
    setIsAutosaving(true);
    setDraft(updater);
  }, [setDraft]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // best-effort; localStorage can throw (private browsing, quota exceeded)
      }
      setIsAutosaving(false);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const target = event.target as HTMLInputElement | null;
      const tag = target?.tagName;
      const isTextInput = tag === 'INPUT' && TEXT_INPUT_TYPES.has(target?.type ?? 'text');
      if (isTextInput || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          back();
        }
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        if (canRedo) {
          event.preventDefault();
          forward();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [back, forward, canUndo, canRedo]);

  const setAnswer = useCallback((id: string, value: boolean | string) => {
    updateDraft((next) => {
      next.answers[id] = value;
    });
  }, [updateDraft]);

  const setBaseInput = useCallback((id: BaseFieldId, value: number) => {
    updateDraft((next) => {
      next.baseInputs[id] = value;
      // Shrinking Cash today / Brokerage today can leave goals promised more than's actually there.
      if (id === 'cashTodayK' || id === 'brokerageTodayK') {
        next.goals = rebalanceAllocations(next.goals, next.baseInputs.cashTodayK * 1000, next.baseInputs.brokerageTodayK * 1000);
      }
    });
  }, [updateDraft]);

  const addGoal = useCallback((goal: Goal) => {
    updateDraft((next) => {
      next.goals.push(goal);
    });
  }, [updateDraft]);

  const removeGoal = useCallback((id: string) => {
    updateDraft((next) => {
      next.goals = next.goals.filter((goal) => goal.id !== id);
    });
  }, [updateDraft]);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    updateDraft((next) => {
      let goals = next.goals.map((goal) => (goal.id === id ? sanitizeGoal({ ...goal, ...patch }) : goal));
      if (patch.equityAllocated) {
        goals = enforceExclusiveEquity(goals, id);
      }
      next.goals = rebalanceAllocations(goals, next.baseInputs.cashTodayK * 1000, next.baseInputs.brokerageTodayK * 1000);
    });
  }, [updateDraft]);

  const addSalaryRaise = useCallback(() => {
    updateDraft((next) => {
      next.salaryRaises.push({ id: generateBreakpointId(), ...nextBreakpoint(next.salaryRaises, next.baseInputs.salaryY0K) });
    });
  }, [updateDraft]);

  const removeSalaryRaise = useCallback((id: string) => {
    updateDraft((next) => {
      next.salaryRaises = next.salaryRaises.filter((breakpoint) => breakpoint.id !== id);
    });
  }, [updateDraft]);

  const updateSalaryRaise = useCallback((id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => {
    updateDraft((next) => {
      next.salaryRaises = applyRaiseUpdate(next.salaryRaises, id, patch);
    });
  }, [updateDraft]);

  const setJobLossYear = useCallback((year: number) => {
    updateDraft((next) => {
      next.jobLossYear = year;
    });
  }, [updateDraft]);

  const clearJobLossYear = useCallback(() => {
    updateDraft((next) => {
      next.jobLossYear = undefined;
    });
  }, [updateDraft]);

  const addPartnerSalaryRaise = useCallback(() => {
    updateDraft((next) => {
      next.partnerSalaryRaises.push({
        id: generateBreakpointId(),
        ...nextBreakpoint(next.partnerSalaryRaises, next.baseInputs.partnerSalaryY0K),
      });
    });
  }, [updateDraft]);

  const removePartnerSalaryRaise = useCallback((id: string) => {
    updateDraft((next) => {
      next.partnerSalaryRaises = next.partnerSalaryRaises.filter((breakpoint) => breakpoint.id !== id);
    });
  }, [updateDraft]);

  const updatePartnerSalaryRaise = useCallback((id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => {
    updateDraft((next) => {
      next.partnerSalaryRaises = applyRaiseUpdate(next.partnerSalaryRaises, id, patch);
    });
  }, [updateDraft]);

  const setPartnerJobLossYear = useCallback((year: number) => {
    updateDraft((next) => {
      next.partnerJobLossYear = year;
    });
  }, [updateDraft]);

  const clearPartnerJobLossYear = useCallback(() => {
    updateDraft((next) => {
      next.partnerJobLossYear = undefined;
    });
  }, [updateDraft]);

  const addChild = useCallback(() => {
    updateDraft((next) => {
      next.children.push({ id: generateChildId(), year: nextChildYear(next.children) });
    });
  }, [updateDraft]);

  const removeChild = useCallback((id: string) => {
    updateDraft((next) => {
      next.children = next.children.filter((child) => child.id !== id);
    });
  }, [updateDraft]);

  const updateChild = useCallback((id: string, year: number) => {
    updateDraft((next) => {
      const child = next.children.find((candidate) => candidate.id === id);
      if (child) {
        child.year = year;
      }
    });
  }, [updateDraft]);

  const planForSaving = useCallback((): Plan => draft, [draft]);

  const loadPlan = useCallback((plan: Plan) => {
    updateDraft(plan);
  }, [updateDraft]);

  const undo = useCallback(() => back(), [back]);
  const redo = useCallback(() => forward(), [forward]);

  return {
    answers: draft.answers,
    setAnswer,
    baseInputs: draft.baseInputs,
    setBaseInput,
    goals: draft.goals,
    addGoal,
    removeGoal,
    updateGoal,
    salaryRaises: draft.salaryRaises,
    addSalaryRaise,
    removeSalaryRaise,
    updateSalaryRaise,
    jobLossYear: draft.jobLossYear,
    setJobLossYear,
    clearJobLossYear,
    partnerSalaryRaises: draft.partnerSalaryRaises,
    addPartnerSalaryRaise,
    removePartnerSalaryRaise,
    updatePartnerSalaryRaise,
    partnerJobLossYear: draft.partnerJobLossYear,
    setPartnerJobLossYear,
    clearPartnerJobLossYear,
    children: draft.children,
    addChild,
    removeChild,
    updateChild,
    planForSaving,
    loadPlan,
    undo,
    redo,
    canUndo,
    canRedo,
    isAutosaving,
  };
}
