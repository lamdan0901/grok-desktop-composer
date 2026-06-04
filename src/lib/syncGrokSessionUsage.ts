import { isTauri } from "@tauri-apps/api/core";
import { getGrokSessionMeta } from "@/lib/sessions";
import {
  readSessionSignalsAtPath,
  resolveSignalsPath,
  resolveSignalsPathById,
  watchGrokSession,
  watchSessionSignals,
} from "@/lib/usage";
import { useUsageStore } from "@/stores/usageStore";
import { getSessionCwd, useWorkspaceStore } from "@/stores/workspaceStore";

async function resolveSignalsFile(
  cwd: string,
  grokSessionId: string,
): Promise<string | null> {
  if (cwd) {
    const byCwd = await resolveSignalsPath(cwd, grokSessionId);
    if (byCwd) return byCwd;
  }
  return resolveSignalsPathById(grokSessionId);
}

/**
 * Load context usage from `signals.json` and session metadata from `summary.json`
 * (same on-disk sources as `/session-info` and `/context` in the Grok TUI).
 */
export async function syncGrokSessionUsage(
  sessionId: string,
  options?: { quiet?: boolean },
): Promise<boolean> {
  if (!isTauri()) return false;

  const store = useWorkspaceStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session?.grokSessionId) return false;

  const cwd = getSessionCwd(session, store.projects);
  const grokId = session.grokSessionId;
  const usage = useUsageStore.getState();
  const cached = usage.bySession[sessionId];

  if (
    !options?.quiet &&
    cached?.watchKey === grokId &&
    (cached.signals != null || cached.meta != null)
  ) {
    return Boolean(cached.signals ?? cached.meta);
  }

  if (!options?.quiet) {
    usage.setLoading(sessionId, true);
    usage.setError(sessionId, null);
  }

  try {
    const meta = await getGrokSessionMeta(grokId, cwd || undefined);
    if (meta) {
      usage.setMeta(sessionId, meta);
    }

    const path = await resolveSignalsFile(cwd, grokId);
    if (!path) {
      usage.setLoading(sessionId, false);
      if (!meta) {
        usage.setError(
          sessionId,
          "No usage file yet. Send a message or wait for the agent to update this thread.",
        );
      }
      if (cwd) {
        void watchGrokSession(sessionId, cwd, grokId).catch(() => undefined);
      }
      return Boolean(meta);
    }

    const signals = await readSessionSignalsAtPath(path);
    usage.setSignals(sessionId, signals, grokId);
    await watchSessionSignals(sessionId, path);
    return true;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load session usage";
    usage.setError(sessionId, message);
    return false;
  }
}

const USAGE_RETRY_MS = 400;

/**
 * Re-read signals after a prompt turn. Grok may flush `signals.json` slightly
 * after `prompt()` returns; a short retry covers that without switching threads.
 */
export function refreshUsageAfterTurn(sessionId: string): void {
  void syncGrokSessionUsage(sessionId, { quiet: true });
  window.setTimeout(() => {
    void syncGrokSessionUsage(sessionId, { quiet: true });
  }, USAGE_RETRY_MS);
}