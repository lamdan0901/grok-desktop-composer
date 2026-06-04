import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  clearPersistedSessions,
  persistOpenSessions,
} from "@/lib/workspacePersist";

export function useWorkspacePersistence() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const win = getCurrentWindow();
        unlisten = await win.onCloseRequested(async () => {
          await persistOpenSessions();
        });
      } catch {
        const onBeforeUnload = () => {
          void persistOpenSessions();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        unlisten = () =>
          window.removeEventListener("beforeunload", onBeforeUnload);
      }
    };

    void setup();
    return () => {
      unlisten?.();
    };
  }, []);
}

export { clearPersistedSessions, persistOpenSessions };