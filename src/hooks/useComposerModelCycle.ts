import type { KeyboardEvent } from "react";
import { useCallback } from "react";
import { shouldShowHomeComposer } from "@/lib/sessionEmpty";
import { isModelCycleKey, nextModelInCycle } from "@/lib/sessionConfig";
import { useApplyModelChange } from "@/hooks/useApplyModelChange";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useComposerModelCycle() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const session = sessions.find((s) => s.id === activeSessionId);
  const getModelSelector = useSessionConfigStore((s) => s.getModelSelector);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const { applyModelChange, disabled: sessionChangeDisabled } =
    useApplyModelChange();

  const cycleModel = useCallback(() => {
    const selector = getModelSelector(activeSessionId);
    if (!selector || selector.choices.length <= 1) return;

    const next = nextModelInCycle(selector);
    if (next === selector.currentValue) return;

    const onSessionComposer =
      activeSessionId &&
      session &&
      !shouldShowHomeComposer(activeSessionId, session) &&
      !sessionChangeDisabled;

    if (onSessionComposer) {
      void applyModelChange(next);
    } else {
      void updateSettings({ defaultModel: next });
    }
  }, [
    activeSessionId,
    session,
    getModelSelector,
    updateSettings,
    applyModelChange,
    sessionChangeDisabled,
  ]);

  const handleModelKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isModelCycleKey(e)) return;
      e.preventDefault();
      cycleModel();
    },
    [cycleModel],
  );

  return { cycleModel, handleModelKeyDown };
}
