import { useEffect, useRef } from "react";
import { hydrateMissingSessionTimestamps } from "@/lib/hydrateSessionTimestamps";
import { hydrateSidebarSessionsFromDisk } from "@/lib/hydrateSidebarSessions";
import { syncWorkspaceToSettings } from "@/lib/workspacePersist";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useWorkspaceBootstrap() {
  const loaded = useSettingsStore((s) => s.loaded);
  const lastProjectPaths = useSettingsStore((s) => s.settings.lastProjectPaths);
  const openTabs = useSettingsStore((s) => s.settings.openTabs);
  const bootstrapFromPersisted = useWorkspaceStore(
    (s) => s.bootstrapFromPersisted,
  );
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!loaded || bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    bootstrapFromPersisted(lastProjectPaths, openTabs);
    void (async () => {
      if (useWorkspaceStore.getState().sessions.length === 0) {
        await hydrateSidebarSessionsFromDisk();
      }
      await hydrateMissingSessionTimestamps();
    })();
  }, [loaded, lastProjectPaths, openTabs, bootstrapFromPersisted]);

  useEffect(() => {
    if (!loaded) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useWorkspaceStore.subscribe((state, prev) => {
      if (
        state.projects === prev.projects &&
        state.sessions === prev.sessions &&
        state.activeProjectId === prev.activeProjectId
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        void syncWorkspaceToSettings();
      }, 400);
    });

    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [loaded]);
}