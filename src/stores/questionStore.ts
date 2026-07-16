import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export interface QuestionOption {
  label: string;
  description: string;
  preview?: string;
  id?: string;
}
export interface Question {
  question: string;
  options: QuestionOption[];
  multiSelect?: boolean;
  id?: string;
}
export interface AskQuestionRequest {
  sessionId: string;
  toolCallId: string;
  mode: "default" | "plan";
  questions: Question[];
}
export type AskQuestionResponse =
  | {
      outcome: "accepted";
      answers: Record<string, string[]>;
      annotations?: Record<string, { preview?: string; notes?: string }>;
    }
  | { outcome: "cancelled" };

type Resolver = (r: AskQuestionResponse) => void;
const resolvers = new Map<SessionId, Resolver>();

interface QuestionState {
  pendingBySession: Record<SessionId, AskQuestionRequest>;
  askQuestion: (
    sessionId: SessionId,
    request: AskQuestionRequest,
  ) => Promise<AskQuestionResponse>;
  respond: (sessionId: SessionId, response: AskQuestionResponse) => void;
  cancelSession: (sessionId: SessionId) => void;
}

export const useQuestionStore = create<QuestionState>(() => ({
  pendingBySession: {},
  askQuestion(sessionId, request) {
    return new Promise<AskQuestionResponse>((resolve) => {
      resolvers.set(sessionId, resolve);
      useQuestionStore.setState((s) => ({
        pendingBySession: { ...s.pendingBySession, [sessionId]: request },
      }));
    });
  },
  respond(sessionId, response) {
    const resolver = resolvers.get(sessionId);
    resolvers.delete(sessionId);
    useQuestionStore.setState((s) => {
      const { [sessionId]: _removed, ...rest } = s.pendingBySession;
      return { pendingBySession: rest };
    });
    resolver?.(response);
  },
  cancelSession(sessionId) {
    if (!resolvers.has(sessionId)) return;
    useQuestionStore.getState().respond(sessionId, { outcome: "cancelled" });
  },
}));
