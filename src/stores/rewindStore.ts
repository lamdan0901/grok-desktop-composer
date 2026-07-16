import { create } from "zustand";

export interface RewindPoint {
  id: string;
  label: string;
  timestamp?: string;
  fileCount?: number;
}

interface RewindState {
  pointsBySession: Record<string, RewindPoint[]>;
  loadingBySession: Record<string, boolean>;
  errorBySession: Record<string, string | null>;
  setPoints: (sessionId: string, points: RewindPoint[]) => void;
  setLoading: (sessionId: string, loading: boolean) => void;
  setError: (sessionId: string, error: string | null) => void;
  clearSession: (sessionId: string) => void;
}

export const useRewindStore = create<RewindState>((set) => ({
  pointsBySession: {},
  loadingBySession: {},
  errorBySession: {},
  setPoints: (sessionId, points) =>
    set((state) => ({
      pointsBySession: { ...state.pointsBySession, [sessionId]: points },
    })),
  setLoading: (sessionId, loading) =>
    set((state) => ({
      loadingBySession: { ...state.loadingBySession, [sessionId]: loading },
    })),
  setError: (sessionId, error) =>
    set((state) => ({
      errorBySession: { ...state.errorBySession, [sessionId]: error },
    })),
  clearSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _points, ...pointsBySession } = state.pointsBySession;
      const { [sessionId]: _loading, ...loadingBySession } = state.loadingBySession;
      const { [sessionId]: _error, ...errorBySession } = state.errorBySession;
      return { pointsBySession, loadingBySession, errorBySession };
    }),
}));
