import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { dispatchTabLine } from "@/lib/acp";
import { ingestSlashCommandsFromAcpLine } from "@/lib/acp/ingestSlashCommands";
import { isBenignAcpNoise } from "@/lib/acpErrors";
import type { AcpLinePayload, TabErrorPayload } from "@/lib/grok";
import { useAcpStore } from "@/stores/acpStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useTabAcpBridge() {
  const appendLine = useAcpStore((s) => s.appendLine);
  const appendError = useAcpStore((s) => s.appendError);
  const appendSessionError = useWorkspaceStore((s) => s.appendError);
  const setAcpState = useWorkspaceStore((s) => s.setAcpState);

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      try {
        const unlistenLine = await listen<AcpLinePayload>("acp-line", (e) => {
          const { tabId, line } = e.payload;
          ingestSlashCommandsFromAcpLine(tabId, line);
          dispatchTabLine(tabId, line);
          appendLine(tabId, line);
        });
        const unlistenErr = await listen<TabErrorPayload>("tab-error", (e) => {
          const { tabId, message } = e.payload;
          if (isBenignAcpNoise(message)) {
            console.debug("[acp stderr]", tabId, message);
            return;
          }
          appendError(tabId, message);
          appendSessionError(tabId, message);
          setAcpState(tabId, "error", message);
        });
        if (!cancelled) {
          unlisteners.push(unlistenLine, unlistenErr);
        } else {
          unlistenLine();
          unlistenErr();
        }
      } catch {
        // Not running inside Tauri (e.g. vite-only preview)
      }
    };

    void setup();

    return () => {
      cancelled = true;
      for (const u of unlisteners) u();
    };
  }, [appendLine, appendError, appendSessionError, setAcpState]);
}