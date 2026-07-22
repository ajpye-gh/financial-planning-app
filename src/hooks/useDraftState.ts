import { useCallback, useEffect, useState } from 'react';
import type { Answers } from '../lib/questions';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '../lib/baseData';
import type { BaseFieldId } from '../lib/baseFields';
import { generateChildId, isValidChild, nextChildYear, type Child } from '../lib/children';
import { isValidGoal, type Goal } from '../lib/goals';
import {
  DEFAULT_SALARY_RAISES,
  applyRaiseUpdate,
  generateBreakpointId,
  isValidBreakpoint,
  nextBreakpoint,
  type SalaryRaiseBreakpoint,
} from '../lib/salaryRaises';

const STORAGE_KEY = 'financial-planning-app:draft';
const AUTOSAVE_DEBOUNCE_MS = 400;
const HORIZON_YEARS = 18;

interface Draft {
  answers: Answers;
  baseInputs: BaseInputs;
  goals: Goal[];
  salaryRaises: SalaryRaiseBreakpoint[];
  jobLossYear: number | undefined;
  partnerSalaryRaises: SalaryRaiseBreakpoint[];
  partnerJobLossYear: number | undefined;
  children: Child[];
}

function freshDraft(): Draft {
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

function isValidJobLossYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= HORIZON_YEARS;
}

function loadDraft(): Draft {
  const fresh = freshDraft();
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
  startOver: () => void;
}

export function useDraftState(): UseDraftStateResult {
  const [draft, setDraft] = useState<Draft>(loadDraft);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch {
        // best-effort; localStorage can throw (private browsing, quota exceeded)
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [draft]);

  const setAnswer = useCallback((id: string, value: boolean | string) => {
    setDraft((prev) => ({ ...prev, answers: { ...prev.answers, [id]: value } }));
  }, []);

  const setBaseInput = useCallback((id: BaseFieldId, value: number) => {
    setDraft((prev) => ({ ...prev, baseInputs: { ...prev.baseInputs, [id]: value } }));
  }, []);

  const addGoal = useCallback((goal: Goal) => {
    setDraft((prev) => ({ ...prev, goals: [...prev.goals, goal] }));
  }, []);

  const removeGoal = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, goals: prev.goals.filter((goal) => goal.id !== id) }));
  }, []);

  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => {
    setDraft((prev) => ({
      ...prev,
      goals: prev.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
    }));
  }, []);

  const addSalaryRaise = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      salaryRaises: [...prev.salaryRaises, { id: generateBreakpointId(), ...nextBreakpoint(prev.salaryRaises) }],
    }));
  }, []);

  const removeSalaryRaise = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, salaryRaises: prev.salaryRaises.filter((breakpoint) => breakpoint.id !== id) }));
  }, []);

  const updateSalaryRaise = useCallback((id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => {
    setDraft((prev) => ({ ...prev, salaryRaises: applyRaiseUpdate(prev.salaryRaises, id, patch) }));
  }, []);

  const setJobLossYear = useCallback((year: number) => {
    setDraft((prev) => ({ ...prev, jobLossYear: year }));
  }, []);

  const clearJobLossYear = useCallback(() => {
    setDraft((prev) => ({ ...prev, jobLossYear: undefined }));
  }, []);

  const addPartnerSalaryRaise = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      partnerSalaryRaises: [
        ...prev.partnerSalaryRaises,
        { id: generateBreakpointId(), ...nextBreakpoint(prev.partnerSalaryRaises) },
      ],
    }));
  }, []);

  const removePartnerSalaryRaise = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      partnerSalaryRaises: prev.partnerSalaryRaises.filter((breakpoint) => breakpoint.id !== id),
    }));
  }, []);

  const updatePartnerSalaryRaise = useCallback((id: string, patch: Partial<Omit<SalaryRaiseBreakpoint, 'id'>>) => {
    setDraft((prev) => ({ ...prev, partnerSalaryRaises: applyRaiseUpdate(prev.partnerSalaryRaises, id, patch) }));
  }, []);

  const setPartnerJobLossYear = useCallback((year: number) => {
    setDraft((prev) => ({ ...prev, partnerJobLossYear: year }));
  }, []);

  const clearPartnerJobLossYear = useCallback(() => {
    setDraft((prev) => ({ ...prev, partnerJobLossYear: undefined }));
  }, []);

  const addChild = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      children: [...prev.children, { id: generateChildId(), year: nextChildYear(prev.children) }],
    }));
  }, []);

  const removeChild = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, children: prev.children.filter((child) => child.id !== id) }));
  }, []);

  const updateChild = useCallback((id: string, year: number) => {
    setDraft((prev) => ({
      ...prev,
      children: prev.children.map((child) => (child.id === id ? { ...child, year } : child)),
    }));
  }, []);

  const startOver = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore - nothing to clean up if storage isn't accessible
    }
    setDraft(freshDraft());
  }, []);

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
    startOver,
  };
}
