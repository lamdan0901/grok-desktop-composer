import { useEffect, useRef } from "react";
import { getTabSession } from "@/lib/acp";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUsageStore } from "@/stores/usageStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Escape is reserved for closing overlays/menus instead of canceling the thread. */
export function escapeBlocksThreadCancel(): boolean {
  if (useSettingsStore.getState().settingsOpen) return true;
  if (useUsageStore.getState().overlayOpen) return true;
  if (typeof document === "undefined") return false;
  if (document.querySelector(".ui-dropdown--portal")) return true;
  if (document.querySelector(".slash-command-picker")) return true;
  return false;
}

export function useCancelThreadOnEscape(
  enabled: boolean,
  sessionId: string | undefined,
  onCancel?: () => void,
): void {
  const finalizeAssistantStream = useWorkspaceStore(
    (s) => s.finalizeAssistantStream,
  );
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escapeBlocksThreadCancel()) return;
      e.preventDefault();
      void getTabSession(sessionId).cancelPrompt();
      finalizeAssistantStream(sessionId);
      onCancelRef.current?.();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, sessionId, finalizeAssistantStream]);
}