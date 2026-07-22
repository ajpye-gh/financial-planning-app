import { useCallback, useEffect, useState } from 'react';
import type { Answers } from '../lib/questions';
import { DEFAULT_BASE_RANGES, baseDefaults, type BaseInputs } from '../lib/baseData';
import type { BaseFieldId } from '../lib/baseFields';
import { isValidGoal, type Goal } from '../lib/goals';

const STORAGE_KEY = 'financial-planning-app:draft';
const AUTOSAVE_DEBOUNCE_MS = 400;

interface Draft {
  answers: Answers;
  baseInputs: BaseInputs;
  goals: Goal[];
}

function freshDraft(): Draft {
  return { answers: {}, baseInputs: baseDefaults(DEFAULT_BASE_RANGES), goals: [] };
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

    const answersValue: unknown = record.answers;
    const answers = typeof answersValue === 'object' && answersValue !== null ? (answersValue as Answers) : fresh.answers;

    const baseInputsValue: unknown = record.baseInputs;
    const baseInputs = {
      ...fresh.baseInputs,
      ...(typeof baseInputsValue === 'object' && baseInputsValue !== null ? baseInputsValue : {}),
    };

    return { answers, baseInputs, goals };
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
    startOver,
  };
}
