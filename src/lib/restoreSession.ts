import { isTauri } from "@tauri-apps/api/core";
import { replayUpdatesJsonl } from "@/lib/acp/sessionUpdates";
import { parseChatHistoryJsonl } from "@/lib/parseChatHistory";
import {
  readGrokChatHistory,
  readGrokUpdatesJsonl,
  resolveGrokSessionCwd,
} from "@/lib/sessions";
import type { ChatMessage, Session } from "@/lib/types";
import { sessionShowsTranscriptRestoreError } from "@/lib/sessionEmpty";
import { syncGrokSessionTitle } from "@/lib/syncGrokSessionTitle";
import { syncGrokSessionUsage } from "@/lib/syncGrokSessionUsage";
import { getSessionCwd, useWorkspaceStore } from "@/stores/workspaceStore";

/** True when transcript history should be loaded from disk (no ACP). */
export function sessionNeedsTranscriptRestore(session: Session): boolean {
  if (!session.grokSessionId || session.transcriptRestore === "loading") {
    return false;
  }
  if (session.messages.length > 0) {
    return false;
  }
  return session.transcriptRestore !== "done";
}

function shouldMarkTranscriptRestoreFailed(session: Session): boolean {
  return sessionShowsTranscriptRestoreError(session);
}

function transcriptHasUserMessage(messages: ChatMessage[]): boolean {
  return messages.some((m) => m.role === "user");
}

export async function loadTranscriptFromDiskForSession(
  grokSessionId: string,
  cwd: string | undefined,
  workspaceSessionId: string,
): Promise<ChatMessage[]> {
  if (!isTauri()) {
    console.warn(
      "[restore] Not running in Tauri; transcript load requires the desktop app.",
    );
    return [];
  }

  let resolvedCwd = cwd?.trim() || undefined;
  if (!resolvedCwd) {
    try {
      resolvedCwd =
        (await resolveGrokSessionCwd(grokSessionId)) ?? undefined;
    } catch (err) {
      console.warn("[restore] resolveGrokSessionCwd:", err);
    }
  }

  try {
    const updates = await readGrokUpdatesJsonl(grokSessionId, resolvedCwd);
    if (updates?.trim()) {
      replayUpdatesJsonl(workspaceSessionId, updates);
      const session = useWorkspaceStore
        .getState()
        .sessions.find((s) => s.id === workspaceSessionId);
      if (
        session &&
        session.messages.length > 0 &&
        transcriptHasUserMessage(session.messages)
      ) {
        return session.messages;
      }
    }
  } catch (err) {
    console.warn("[restore] updates.jsonl:", err);
  }

  try {
    const raw = await readGrokChatHistory(grokSessionId, resolvedCwd);
    if (raw?.trim()) {
      const fromChat = parseChatHistoryJsonl(raw);
      if (fromChat.length > 0) return fromChat;
    }
  } catch (err) {
    console.warn("[restore] chat_history.jsonl:", err);
  }

  return [];
}

/**
 * Load a saved Grok transcript from disk when the user opens a thread.
 * Does not start the ACP agent — that happens on the first send.
 */
export async function restoreSessionTranscriptIfNeeded(
  sessionId: string,
): Promise<void> {
  const store = useWorkspaceStore.getState();
  let session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const grokSessionId = session.grokSessionId;
  if (grokSessionId && !session.sessionCwd) {
    try {
      const resolved = await resolveGrokSessionCwd(grokSessionId);
      if (resolved && resolved.trim()) {
        useWorkspaceStore.getState().setSessionCwd(sessionId, resolved);
        // Re-fetch so subsequent getSessionCwd and needs check see the update
        session = useWorkspaceStore.getState().sessions.find((s) => s.id === sessionId) ?? session;
      }
    } catch (err) {
      console.warn("[restore] resolveGrokSessionCwd for sessionCwd:", err);
    }
  }

  if (!sessionNeedsTranscriptRestore(session)) return;

  if (!grokSessionId) return;

  const cwd = getSessionCwd(session, store.projects);
  const showRestoreUi = shouldMarkTranscriptRestoreFailed(session);
  if (showRestoreUi) {
    store.setTranscriptRestore(sessionId, "loading");
  }

  const diskMessages = await loadTranscriptFromDiskForSession(
    grokSessionId,
    cwd,
    sessionId,
  );

  if (diskMessages.length > 0) {
    store.setSessionMessages(sessionId, diskMessages);
    await syncGrokSessionTitle(sessionId);
    await syncGrokSessionUsage(sessionId);
    store.clearResumeOnConnect(sessionId);
    store.setTranscriptRestore(sessionId, "done");
    store.setAcpState(sessionId, "disconnected");
    return;
  }

  await syncGrokSessionTitle(sessionId);
  await syncGrokSessionUsage(sessionId);

  store.clearResumeOnConnect(sessionId);
  if (shouldMarkTranscriptRestoreFailed(session)) {
    store.setTranscriptRestore(sessionId, "failed");
  } else {
    store.setTranscriptRestore(sessionId, undefined);
  }
  store.setAcpState(sessionId, "disconnected");
}