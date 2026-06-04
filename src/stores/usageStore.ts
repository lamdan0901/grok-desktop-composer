import { create } from "zustand";
import type { SessionId } from "@/lib/types";
import type { GrokSessionMeta } from "@/lib/sessions";
import {
  shouldAcceptSignalsUpdate,
  type SessionSignals,
} from "@/lib/usage";

interface UsageEntry {
  signals?: SessionSignals;
  meta?: GrokSessionMeta;
  loading: boolean;
  error: string | null;
  watchKey?: string;
}

interface UsageState {
  bySession: Record<SessionId, UsageEntry | undefined>;
  overlayOpen: boolean;
  setLoading: (sessionId: SessionId, loading: boolean) => void;
  setError: (sessionId: SessionId, error: string | null) => void;
  setSignals: (
    sessionId: SessionId,
    signals: SessionSignals,
    watchKey?: string,
  ) => void;
  setMeta: (sessionId: SessionId, meta: GrokSessionMeta) => void;
  clearSession: (sessionId: SessionId) => void;
  setOverlayOpen: (open: boolean) => void;
}

const emptyEntry = (): UsageEntry => ({
  loading: false,
  error: null,
});

export const useUsageStore = create<UsageState>((set) => ({
  bySession: {},
  overlayOpen: false,
  setLoading: (sessionId, loading) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: {
          ...(state.bySession[sessionId] ?? emptyEntry()),
          loading,
        },
      },
    })),
  setError: (sessionId, error) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: {
          ...(state.bySession[sessionId] ?? emptyEntry()),
          error,
          loading: false,
        },
      },
    })),
  setSignals: (sessionId, signals, watchKey) =>
    set((state) => {
      const prev = state.bySession[sessionId];
      if (!shouldAcceptSignalsUpdate(prev?.signals, signals)) {
        return state;
      }
      return {
        bySession: {
          ...state.bySession,
          [sessionId]: {
            ...(prev ?? emptyEntry()),
            signals,
            loading: false,
            error: null,
            ...(watchKey ? { watchKey } : {}),
          },
        },
      };
    }),
  setMeta: (sessionId, meta) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: {
          ...(state.bySession[sessionId] ?? emptyEntry()),
          meta,
        },
      },
    })),
  clearSession: (sessionId) =>
    set((state) => {
      const next = { ...state.bySession };
      delete next[sessionId];
      return { bySession: next };
    }),
  setOverlayOpen: (open) => set({ overlayOpen: open }),
}));