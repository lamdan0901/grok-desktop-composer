import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export type FolderTrustRequest = { folder?: string; reason?: string };
export type FolderTrustResponse = { outcome: "approved" | "rejected" };
type Resolver = (response: FolderTrustResponse) => void;
const resolvers = new Map<SessionId, Resolver>();

type State = {
  pendingBySession: Record<SessionId, FolderTrustRequest>;
  request: (sessionId: SessionId, request: FolderTrustRequest) => Promise<FolderTrustResponse>;
  respond: (sessionId: SessionId, approved: boolean) => FolderTrustResponse;
  cancelSession: (sessionId: SessionId) => void;
};

export const useFolderTrustStore = create<State>(() => ({
  pendingBySession: {},
  request(sessionId, request) {
    return new Promise((resolve) => {
      resolvers.set(sessionId, resolve);
      useFolderTrustStore.setState((state) => ({
        pendingBySession: { ...state.pendingBySession, [sessionId]: request },
      }));
    });
  },
  respond(sessionId, approved) {
    const response: FolderTrustResponse = { outcome: approved ? "approved" : "rejected" };
    const resolver = resolvers.get(sessionId);
    resolvers.delete(sessionId);
    useFolderTrustStore.setState((state) => {
      const { [sessionId]: _removed, ...pendingBySession } = state.pendingBySession;
      return { pendingBySession };
    });
    resolver?.(response);
    return response;
  },
  cancelSession(sessionId) {
    if (resolvers.has(sessionId)) useFolderTrustStore.getState().respond(sessionId, false);
  },
}));
