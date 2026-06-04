import { useEffect, useRef } from "react";
import { removeTabSession } from "@/lib/acp";
import {
  clearSessionConnectionKeys,
  pruneStaleSessionConnectionKeys,
  sessionConnectionKey,
} from "@/lib/sessionConnectionRegistry";
import {
  getSessionCwd,
  isSessionBusy,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

function sessionIdSignature(sessions: { id: string }[]): string {
  return sessions.map((s) => s.id).join("|");
}

async function releaseInactiveConnections(
  activeSessionId: string | null,
): Promise<void> {
  const { sessions, setAcpState } = useWorkspaceStore.getState();
  for (const session of sessions) {
    if (session.id === activeSessionId) continue;
    if (isSessionBusy(session)) continue;
    if (session.acpState === "disconnected") continue;

    clearSessionConnectionKeys(session.id);
    setAcpState(session.id, "disconnected", undefined);
    await removeTabSession(session.id);
  }
}

/**
 * Cleans up ACP processes when threads are closed or the user switches away.
 * Does not connect on open — see `ensureAcpForSend` on first message.
 */
export function useSessionConnections() {
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const prevSessionIdsRef = useRef<Set<string>>(new Set());
  const idsSig = sessionIdSignature(sessions);

  useEffect(() => {
    const currentIds = new Set(sessions.map((s) => s.id));
    for (const id of prevSessionIdsRef.current) {
      if (!currentIds.has(id)) {
        clearSessionConnectionKeys(id);
        void removeTabSession(id);
      }
    }
    prevSessionIdsRef.current = currentIds;
  }, [idsSig, sessions]);

  useEffect(() => {
    return () => {
      for (const s of useWorkspaceStore.getState().sessions) {
        clearSessionConnectionKeys(s.id);
      }
      void Promise.all(
        useWorkspaceStore.getState().sessions.map((s) => removeTabSession(s.id)),
      );
    };
  }, []);

  useEffect(() => {
    const activeKeys = new Set(
      sessions
        .map((s) => {
          const cwd = getSessionCwd(s, projects);
          return cwd
            ? sessionConnectionKey(s.id, cwd, s.grokSessionId)
            : null;
        })
        .filter((k): k is string => k != null),
    );
    pruneStaleSessionConnectionKeys(activeKeys);
    void releaseInactiveConnections(activeSessionId);
  }, [activeSessionId, idsSig, sessions, projects]);
}

/** @deprecated Use useSessionConnections */
export const useTabSessions = useSessionConnections;