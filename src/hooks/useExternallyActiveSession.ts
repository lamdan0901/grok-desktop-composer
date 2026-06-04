import { useMemo } from "react";
import {
  getExternallyActiveGrokSessionIds,
  getOwnedGrokSessionIds,
  isGrokSessionExternallyActive,
} from "@/lib/activeSessions";
import { useActiveSessionsStore } from "@/stores/activeSessionsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * True when this thread's Grok session is active in another client (e.g. Grok TUI).
 */
export function useExternallyActiveSession(grokSessionId: string | undefined) {
  const activeSessions = useActiveSessionsStore((s) => s.sessions);
  const sessions = useWorkspaceStore((s) => s.sessions);

  return useMemo(() => {
    const owned = getOwnedGrokSessionIds(sessions);
    return isGrokSessionExternallyActive(
      grokSessionId,
      activeSessions,
      owned,
    );
  }, [grokSessionId, activeSessions, sessions]);
}

export function useExternallyActiveGrokIds() {
  const activeSessions = useActiveSessionsStore((s) => s.sessions);
  const sessions = useWorkspaceStore((s) => s.sessions);

  return useMemo(() => {
    const owned = getOwnedGrokSessionIds(sessions);
    return getExternallyActiveGrokSessionIds(activeSessions, owned);
  }, [activeSessions, sessions]);
}