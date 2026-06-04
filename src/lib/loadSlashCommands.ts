import { getTabSession } from "@/lib/acp";
import { tryLoadSlashCommandsFromDisk } from "@/lib/acp/slashCommandsFromDisk";
import { ensureAcpForSend } from "@/lib/ensureAcpForSend";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";
import type { SessionId } from "@/lib/types";

const LOAD_TIMEOUT_MS = 15_000;
const inflightBySession = new Map<SessionId, Promise<void>>();

/**
 * Connect to Grok once per thread (when user types `/`) and wait for
 * `available_commands_update`. Cached thereafter until the tab is closed.
 */
export async function loadSlashCommandsForSession(
  sessionId: SessionId,
  cwd: string,
  grokSessionId?: string,
): Promise<void> {
  const store = useSlashCommandsStore.getState();
  if (store.isCached(sessionId)) return;

  const existing = inflightBySession.get(sessionId);
  if (existing) return existing;

  const work = (async () => {
    const get = () => useSlashCommandsStore.getState();
    get().markLoading(sessionId);

    const finished = waitForSlashCommands(sessionId, LOAD_TIMEOUT_MS);

    try {
      if (grokSessionId) {
        const fromDisk = await tryLoadSlashCommandsFromDisk(
          sessionId,
          grokSessionId,
          cwd,
        );
        if (fromDisk) return;
      }

      await ensureAgentForSlashCommands(sessionId, cwd, grokSessionId);

      if (!get().isCached(sessionId) && grokSessionId) {
        await tryLoadSlashCommandsFromDisk(sessionId, grokSessionId, cwd);
      }
    } catch {
      if (!get().isCached(sessionId)) {
        get().markIdle(sessionId);
      }
    } finally {
      await finished;
      if (!get().isCached(sessionId)) {
        get().markIdle(sessionId);
      }
      inflightBySession.delete(sessionId);
    }
  })();

  inflightBySession.set(sessionId, work);
  return work;
}

/** Start listener before connect so we never miss a fast `available_commands_update`. */
function waitForSlashCommands(
  sessionId: SessionId,
  timeoutMs: number,
): Promise<void> {
  const get = () => useSlashCommandsStore.getState();
  if (get().isCached(sessionId)) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(deadline);
      unsub();
      resolve();
    };

    const deadline = setTimeout(finish, timeoutMs);

    const unsub = useSlashCommandsStore.subscribe((state) => {
      const status = state.statusBySession[sessionId];
      if (status === "loaded" || status === "idle") {
        finish();
      }
    });

    const status = get().statusBySession[sessionId];
    if (status === "loaded" || status === "idle") {
      finish();
    }
  });
}

/**
 * `ensureAcpForSend` returns immediately when the tab is already ready, but Grok
 * does not resend `available_commands_update` on resume — reconnect once.
 */
async function ensureAgentForSlashCommands(
  sessionId: SessionId,
  cwd: string,
  grokSessionId?: string,
): Promise<void> {
  const tab = getTabSession(sessionId);
  if (tab.isReady && !useSlashCommandsStore.getState().isCached(sessionId)) {
    await tab.dispose();
  }
  await ensureAcpForSend(sessionId, cwd, grokSessionId);
}

export function clearSlashCommandsInflight(sessionId: SessionId): void {
  inflightBySession.delete(sessionId);
}