import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isPlaceholderThreadTitle } from "@/lib/threadTitle";
import { useWorkspaceStore } from "@/stores/workspaceStore";

interface SessionTitleChangedPayload {
  tabId: string;
  title: string;
}

/**
 * Applies live title updates when Grok writes `summary.json` (same session dir watcher as signals).
 */
export function useSessionTitleWatcher() {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen<SessionTitleChangedPayload>(
          "session-title-changed",
          (e) => {
            const { tabId, title } = e.payload;
            const trimmed = title.trim();
            if (!trimmed || isPlaceholderThreadTitle(trimmed)) return;

            const session = useWorkspaceStore
              .getState()
              .sessions.find((s) => s.id === tabId);
            if (!session || session.title.trim() === trimmed) return;

            useWorkspaceStore.getState().setSessionTitleFromGrok(tabId, trimmed);
          },
        );
        if (cancelled) {
          unlisten();
        }
      } catch {
        // vite-only preview
      }
    };

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
