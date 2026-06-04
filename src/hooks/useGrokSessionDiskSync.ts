import { useEffect } from "react";
import { shouldFetchGrokSessionTitle } from "@/lib/threadTitle";
import { syncGrokSessionTitle } from "@/lib/syncGrokSessionTitle";
import { syncGrokSessionUsage } from "@/lib/syncGrokSessionUsage";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Sync title, context usage, and session metadata from Grok on-disk session files. */
export function useGrokSessionDiskSync() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const session = useWorkspaceStore((s) =>
    s.activeSessionId
      ? s.sessions.find((x) => x.id === s.activeSessionId)
      : undefined,
  );
  const grokSessionId = session?.grokSessionId;

  useEffect(() => {
    if (!activeSessionId || !grokSessionId || !session) return;
    if (shouldFetchGrokSessionTitle(session)) {
      void syncGrokSessionTitle(activeSessionId);
    }
    void syncGrokSessionUsage(activeSessionId);
  }, [activeSessionId, grokSessionId, session?.grokTitleSynced]);
}

/** @deprecated Use useGrokSessionDiskSync */
export const useGrokSessionTitleSync = useGrokSessionDiskSync;