import { getTabSession } from "@/lib/acp";
import {
  getOwnedGrokSessionIds,
  isGrokSessionExternallyActive,
} from "@/lib/activeSessions";
import { isBenignAttachError } from "@/lib/acpErrors";
import { useActiveSessionsStore } from "@/stores/activeSessionsStore";
import {
  markSessionConnectionTracked,
  sessionConnectionKey,
} from "@/lib/sessionConnectionRegistry";
import {
  refreshTitleAfterTurn,
  syncGrokSessionTitle,
} from "@/lib/syncGrokSessionTitle";
import { syncGrokSessionUsage } from "@/lib/syncGrokSessionUsage";
import { resolveGrokSessionCwd } from "@/lib/sessions";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Start the Grok ACP agent for this thread (call only when the user sends a message). */
export async function ensureAcpForSend(
  sessionId: string,
  cwd: string,
  grokSessionId?: string,
): Promise<void> {
  const store = useWorkspaceStore.getState();

  // For old/grokSessionId threads (especially legacy ones from before sessionCwd was captured,
  // or from persisted snapshots using project cwd string), resolve the *exact* cwd that the
  // grok agent recorded for this session. resumeSession / bare prompt with a mismatched cwd
  // (common on Windows) produces "Invalid params".
  let attachCwd = cwd;
  if (grokSessionId) {
    const wsSession = store.sessions.find((s) => s.id === sessionId);
    if (wsSession && !wsSession.sessionCwd) {
      try {
        const resolved = await resolveGrokSessionCwd(grokSessionId);
        if (resolved && resolved.trim()) {
          attachCwd = resolved;
          useWorkspaceStore.getState().setSessionCwd(sessionId, resolved);
        }
      } catch (err) {
        console.warn("[ensureAcpForSend] resolveGrokSessionCwd for attach:", err);
      }
    } else if (wsSession?.sessionCwd) {
      attachCwd = wsSession.sessionCwd;
    }
  }

  const tab = getTabSession(sessionId);
  const resolvedGrokIdForCheck =
    grokSessionId ?? tab.grokSessionId ?? store.sessions.find((s) => s.id === sessionId)?.grokSessionId;
  const owned = getOwnedGrokSessionIds(store.sessions);
  if (
    isGrokSessionExternallyActive(
      resolvedGrokIdForCheck,
      useActiveSessionsStore.getState().sessions,
      owned,
    )
  ) {
    throw new Error(
      "This thread is active in the Grok terminal. Close it there before sending from this app.",
    );
  }

  if (
    tab.isReady &&
    tab.isAgentAttached &&
    (!grokSessionId || tab.grokSessionId === grokSessionId)
  ) {
    store.setAcpState(sessionId, "ready");
    return;
  }

  store.setAcpState(sessionId, "connecting");
  try {
    if (grokSessionId) {
      const session = store.sessions.find((s) => s.id === sessionId);
      // Transcript already on screen (disk restore or prior turns): attach without
      // loadSession replay, which would append duplicate chunks and mis-order messages.
      if (session && session.messages.length > 0) {
        await tab.ensureResumed(attachCwd, grokSessionId);
      } else {
        await tab.ensureLoaded(attachCwd, grokSessionId);
      }
    } else {
      await tab.ensureConnected(attachCwd);
    }

    const resolvedGrokId = tab.grokSessionId ?? grokSessionId;
    markSessionConnectionTracked(
      sessionConnectionKey(sessionId, attachCwd, resolvedGrokId),
    );
    store.setAcpState(sessionId, "ready");
    store.clearResumeOnConnect(sessionId);

    if (resolvedGrokId) {
      const session = store.sessions.find((s) => s.id === sessionId);
      if (session && !session.grokSessionId) {
        store.setGrokSessionId(sessionId, resolvedGrokId, attachCwd);
      }
      await syncGrokSessionTitle(sessionId);
      refreshTitleAfterTurn(sessionId);
      await syncGrokSessionUsage(sessionId);
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to Grok";
    if (!isBenignAttachError(err)) {
      store.setAcpState(sessionId, "error", message);
    } else {
      store.setAcpState(sessionId, "ready");
    }
    throw err;
  }
}