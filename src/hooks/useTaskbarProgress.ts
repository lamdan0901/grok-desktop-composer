import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, ProgressBarStatus } from "@tauri-apps/api/window";
import { isTurnAgentActive } from "@/lib/chatTurns";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * Shows the Windows native indeterminate taskbar animation while any session is
 * streaming a response, clears it when all sessions go idle.
 */
export function useTaskbarProgress() {
  const anyActive = useWorkspaceStore((s) =>
    s.sessions.some((session) =>
      isTurnAgentActive(session.messages, { sessionStatus: session.status }),
    ),
  );

  useEffect(() => {
    if (!isTauri()) return;
    void getCurrentWindow().setProgressBar({
      status: anyActive ? ProgressBarStatus.Indeterminate : ProgressBarStatus.None,
    });
  }, [anyActive]);
}
