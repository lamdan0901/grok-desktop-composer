import type { KeyboardEvent } from "react";
import { useCallback } from "react";
import {
  isAccessModeCycleKey,
  nextComposerAccessMode,
  settingsPatchForComposerAccessMode,
} from "@/lib/composerAccessMode";
import { useSettingsStore } from "@/stores/settingsStore";

export function useComposerAccessModeCycle() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const cycleAccessMode = useCallback(() => {
    const next = nextComposerAccessMode(settings);
    void updateSettings(settingsPatchForComposerAccessMode(next));
  }, [settings, updateSettings]);

  const handleAccessModeKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isAccessModeCycleKey(e)) return;
      e.preventDefault();
      cycleAccessMode();
    },
    [cycleAccessMode],
  );

  return { cycleAccessMode, handleAccessModeKeyDown };
}