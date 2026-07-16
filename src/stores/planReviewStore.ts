import { create } from "zustand";
import type { SessionId } from "@/lib/types";
import type { PlanComment } from "@/lib/planComments";

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
  commentsBySession: Record<SessionId, PlanComment[]>;
  requestReview: (
    sessionId: SessionId,
    request: ExitPlanModeRequest,
  ) => Promise<ExitPlanModeResponse>;
  resolve: (sessionId: SessionId, response: ExitPlanModeResponse) => void;
  cancelSession: (sessionId: SessionId) => void;
  addComment: (sessionId: SessionId, comment: PlanComment) => void;
  removeComment: (sessionId: SessionId, commentId: string) => void;
  clearComments: (sessionId: SessionId) => void;
  getComments: (sessionId: SessionId) => PlanComment[];
}

export const usePlanReviewStore = create<PlanReviewState>((set, get) => ({
  pendingBySession: {},
  commentsBySession: {},
  requestReview(sessionId, request) {
    return new Promise<ExitPlanModeResponse>((resolve) => {
      resolvers.set(sessionId, resolve);
      set((s) => ({
        pendingBySession: { ...s.pendingBySession, [sessionId]: request },
      }));
    });
  },
  resolve(sessionId, response) {
    const resolver = resolvers.get(sessionId);
    resolvers.delete(sessionId);
    set((s) => {
      const { [sessionId]: _removed, ...rest } = s.pendingBySession;
      const { [sessionId]: _comments, ...commentsBySession } =
        s.commentsBySession;
      return { pendingBySession: rest, commentsBySession };
    });
    resolver?.(response);
  },
  cancelSession(sessionId) {
    if (!resolvers.has(sessionId)) return;
    get().resolve(sessionId, { outcome: "abandoned" });
  },
  addComment(sessionId, comment) {
    set((state) => ({
      commentsBySession: {
        ...state.commentsBySession,
        [sessionId]: [...(state.commentsBySession[sessionId] ?? []), comment],
      },
    }));
  },
  removeComment(sessionId, commentId) {
    set((state) => ({
      commentsBySession: {
        ...state.commentsBySession,
        [sessionId]: (state.commentsBySession[sessionId] ?? []).filter(
          (comment) => comment.id !== commentId,
        ),
      },
    }));
  },
  clearComments(sessionId) {
    set((state) => {
      const { [sessionId]: _removed, ...commentsBySession } =
        state.commentsBySession;
      return { commentsBySession };
    });
  },
  getComments(sessionId) {
    return get().commentsBySession[sessionId] ?? [];
  },
}));
