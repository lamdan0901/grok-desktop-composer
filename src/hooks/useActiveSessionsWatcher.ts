import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import type { ActiveSessionsChangedPayload } from "@/lib/activeSessions";
import {
  readActiveGrokSessions,
  startActiveSessionsWatch,
} from "@/lib/activeSessions";
import { useActiveSessionsStore } from "@/stores/activeSessionsStore";

/**
 * Keeps `active_sessions.json` in sync for cross-client session detection.
 */
export function useActiveSessionsWatcher() {
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const bootstrap = async () => {
      try {
        const initial = await readActiveGrokSessions();
        if (!cancelled) {
          useActiveSessionsStore.getState().setSessions(initial);
        }
        await startActiveSessionsWatch();
      } catch {
        // watcher may already be running from Rust setup
      }

      try {
        unlisten = await listen<ActiveSessionsChangedPayload>(
          "active-sessions-changed",
          (e) => {
            useActiveSessionsStore.getState().setSessions(e.payload.sessions);
          },
        );
        if (cancelled) {
          unlisten();
        }
      } catch {
        // vite-only preview
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}