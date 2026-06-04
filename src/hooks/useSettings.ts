import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

export function useSettingsBootstrap() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return loaded;
}