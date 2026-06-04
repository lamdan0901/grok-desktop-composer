import { isTauri } from "@tauri-apps/api/core";
import { getGrokSessionTitle } from "@/lib/sessions";
import {
  isPlaceholderThreadTitle,
  shouldFetchGrokSessionTitle,
} from "@/lib/threadTitle";
import { getSessionCwd, useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * Pull the Grok-generated title from `summary.json` on disk (same source as
 * `/session-info` Title and `grok sessions list` SUMMARY).
 */
export async function syncGrokSessionTitle(sessionId: string): Promise<void> {
  if (!isTauri()) return;

  const store = useWorkspaceStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session?.grokSessionId) return;
  if (!shouldFetchGrokSessionTitle(session)) return;

  const cwd = getSessionCwd(session, store.projects);
  let title: string | null;
  try {
    title = await getGrokSessionTitle(
      session.grokSessionId,
      cwd || undefined,
    );
  } catch (err) {
    console.warn("[syncGrokSessionTitle]", err);
    return;
  }

  const trimmed = title?.trim();
  if (
    !trimmed ||
    isPlaceholderThreadTitle(trimmed) ||
    session.title.trim() === trimmed
  ) {
    return;
  }

  store.setSessionTitleFromGrok(sessionId, trimmed);
  stopTitleRefreshWhileTurn(sessionId);
}

const TITLE_RETRY_MS = [150, 400, 800, 1500, 3000, 6000];
const TITLE_POLL_MS = 350;
const TITLE_POLL_MAX_MS = 45_000;

const titlePollHandles = new Map<string, number>();

/**
 * Poll `summary.json` while a turn is in flight (stops when Grok writes a title
 * or after {@link TITLE_POLL_MAX_MS}).
 */
export function startTitleRefreshWhileTurn(sessionId: string): () => void {
  stopTitleRefreshWhileTurn(sessionId);
  const session = useWorkspaceStore.getState().sessions.find((s) => s.id === sessionId);
  if (session && !shouldFetchGrokSessionTitle(session)) {
    return () => stopTitleRefreshWhileTurn(sessionId);
  }
  void syncGrokSessionTitle(sessionId);
  const started = Date.now();
  const handle = window.setInterval(() => {
    const current = useWorkspaceStore.getState().sessions.find((s) => s.id === sessionId);
    if (current && !shouldFetchGrokSessionTitle(current)) {
      stopTitleRefreshWhileTurn(sessionId);
      return;
    }
    void syncGrokSessionTitle(sessionId);
    if (Date.now() - started >= TITLE_POLL_MAX_MS) {
      stopTitleRefreshWhileTurn(sessionId);
    }
  }, TITLE_POLL_MS);
  titlePollHandles.set(sessionId, handle);
  return () => stopTitleRefreshWhileTurn(sessionId);
}

export function stopTitleRefreshWhileTurn(sessionId: string): void {
  const handle = titlePollHandles.get(sessionId);
  if (handle == null) return;
  window.clearInterval(handle);
  titlePollHandles.delete(sessionId);
}

/**
 * Re-read `summary.json` after a prompt turn. Grok may write `generated_title`
 * later than `signals.json`; short retries pick it up without waiting for a tab switch.
 */
export function refreshTitleAfterTurn(sessionId: string): void {
  const session = useWorkspaceStore.getState().sessions.find((s) => s.id === sessionId);
  if (session && !shouldFetchGrokSessionTitle(session)) return;

  void syncGrokSessionTitle(sessionId);
  for (const delay of TITLE_RETRY_MS) {
    window.setTimeout(() => {
      const current = useWorkspaceStore
        .getState()
        .sessions.find((s) => s.id === sessionId);
      if (current && !shouldFetchGrokSessionTitle(current)) return;
      void syncGrokSessionTitle(sessionId);
    }, delay);
  }
}
