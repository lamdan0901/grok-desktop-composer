import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export interface ExitPlanModeRequest {
  sessionId: string;
  toolCallId: string;
  planContent?: string;
}
export interface ExitPlanModeResponse {
  outcome: "approved" | "cancelled" | "abandoned";
  feedback?: string;
}

type Resolver = (r: ExitPlanModeResponse) => void;
const resolvers = new Map<SessionId, Resolver>();

interface PlanReviewState {
  pendingBySession: Record<SessionId, ExitPlanModeRequest>;
  requestReview: (
    sessionId: SessionId,
    request: ExitPlanModeRequest,
  ) => Promise<ExitPlanModeResponse>;
  resolve: (sessionId: SessionId, response: ExitPlanModeResponse) => void;
  cancelSession: (sessionId: SessionId) => void;
}

export const usePlanReviewStore = create<PlanReviewState>(() => ({
  pendingBySession: {},
  requestReview(sessionId, request) {
    return new Promise<ExitPlanModeResponse>((resolve) => {
      resolvers.set(sessionId, resolve);
      usePlanReviewStore.setState((s) => ({
        pendingBySession: { ...s.pendingBySession, [sessionId]: request },
      }));
    });
  },
  resolve(sessionId, response) {
    const resolver = resolvers.get(sessionId);
    resolvers.delete(sessionId);
    usePlanReviewStore.setState((s) => {
      const { [sessionId]: _removed, ...rest } = s.pendingBySession;
      return { pendingBySession: rest };
    });
    resolver?.(response);
  },
  cancelSession(sessionId) {
    if (!resolvers.has(sessionId)) return;
    usePlanReviewStore.getState().resolve(sessionId, { outcome: "abandoned" });
  },
}));
