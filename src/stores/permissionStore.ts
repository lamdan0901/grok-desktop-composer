import { create } from "zustand";
import type {
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import type { SessionId } from "@/lib/types";

export interface PendingPermission {
  sessionId: SessionId;
  request: RequestPermissionRequest;
}

type PermissionResolver = (response: RequestPermissionResponse) => void;

const resolvers = new Map<SessionId, PermissionResolver>();

interface PermissionState {
  pendingBySession: Record<SessionId, PendingPermission>;
  waitForDecision: (
    sessionId: SessionId,
    request: RequestPermissionRequest,
  ) => Promise<RequestPermissionResponse>;
  respond: (
    sessionId: SessionId,
    option: PermissionOption | null,
  ) => void;
  cancelSession: (sessionId: SessionId) => void;
}

function buildResponse(
  option: PermissionOption | null,
): RequestPermissionResponse {
  if (!option) {
    return { outcome: { outcome: "cancelled" } };
  }
  return {
    outcome: {
      outcome: "selected",
      optionId: option.optionId,
    },
  };
}

export const usePermissionStore = create<PermissionState>(() => ({
  pendingBySession: {},

  waitForDecision(sessionId, request) {
    return new Promise((resolve) => {
      resolvers.set(sessionId, resolve);
      usePermissionStore.setState((state) => ({
        pendingBySession: {
          ...state.pendingBySession,
          [sessionId]: { sessionId, request },
        },
      }));
    });
  },

  respond(sessionId, option) {
    const resolver = resolvers.get(sessionId);
    resolvers.delete(sessionId);
    usePermissionStore.setState((state) => {
      const { [sessionId]: _removed, ...rest } = state.pendingBySession;
      return { pendingBySession: rest };
    });
    resolver?.(buildResponse(option));
  },

  cancelSession(sessionId) {
    if (!resolvers.has(sessionId)) return;
    usePermissionStore.getState().respond(sessionId, null);
  },
}));

export function getPendingForSession(
  sessionId: SessionId | null,
): PendingPermission | null {
  if (!sessionId) return null;
  return usePermissionStore.getState().pendingBySession[sessionId] ?? null;
}