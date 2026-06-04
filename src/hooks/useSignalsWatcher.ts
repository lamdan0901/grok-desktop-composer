import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import type { SignalsChangedPayload } from "@/lib/usage";
import { unwatchSessionSignals } from "@/lib/usage";
import { useUsageStore } from "@/stores/usageStore";

/**
 * Applies live updates when Grok writes `signals.json` (via Tauri file watcher).
 * Initial load is handled by `syncGrokSessionUsage` / `useGrokSessionDiskSync`.
 */
export function useSignalsWatcher() {
  const watchedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen<SignalsChangedPayload>("signals-changed", (e) => {
          const { tabId, signals } = e.payload;
          useUsageStore
            .getState()
            .setSignals(tabId, signals, watchedRef.current ?? undefined);
        });
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

  useEffect(() => {
    return () => {
      if (watchedRef.current) {
        void unwatchSessionSignals(watchedRef.current).catch(() => undefined);
        watchedRef.current = null;
      }
    };
  }, []);
}