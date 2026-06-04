import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export interface SessionPlanState {
  path: string | null;
  content: string;
  loading: boolean;
  error: string | null;
}

interface PlanState {
  bySession: Record<SessionId, SessionPlanState>;
  setPlan: (
    sessionId: SessionId,
    patch: Partial<SessionPlanState>,
  ) => void;
  setLoading: (sessionId: SessionId, loading: boolean) => void;
  setError: (sessionId: SessionId, error: string | null) => void;
  clearPlan: (sessionId: SessionId) => void;
}

function defaultPlanState(): SessionPlanState {
  return {
    path: null,
    content: "",
    loading: false,
    error: null,
  };
}

export const usePlanStore = create<PlanState>((set) => ({
  bySession: {},

  setPlan(sessionId, patch) {
    set((state) => {
      const current = state.bySession[sessionId] ?? defaultPlanState();
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...current, ...patch, loading: false, error: null },
        },
      };
    });
  },

  setLoading(sessionId, loading) {
    set((state) => {
      const current = state.bySession[sessionId] ?? defaultPlanState();
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...current, loading },
        },
      };
    });
  },

  setError(sessionId, error) {
    set((state) => {
      const current = state.bySession[sessionId] ?? defaultPlanState();
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: { ...current, error, loading: false },
        },
      };
    });
  },

  clearPlan(sessionId) {
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.bySession;
      return { bySession: rest };
    });
  },
}));