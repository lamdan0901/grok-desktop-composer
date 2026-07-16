import { useCallback } from "react";
import { useApplyModelChange } from "@/hooks/useApplyModelChange";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";
import { EffortSelector } from "./EffortSelector";
import { ModelSelectorDropdown } from "./ModelSelectorDropdown";

export function ModelSelector() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const projects = useWorkspaceStore((s) => s.projects);
  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const cliModelsLoaded = useSessionConfigStore((s) => s.cliModelsLoaded);
  const {
    applyModelChange,
    applyEffortChange,
    changing,
    disabled,
    selector,
    effortOptions,
    currentEffort,
  } = useApplyModelChange();

  const handleSelect = useCallback(
    (value: string) => {
      applyModelChange(value).catch((error) => {
        console.error("Model change failed", error);
      });
    },
    [applyModelChange],
  );

  if (!activeSessionId || !cwd) return null;
  if (!selector && !cliModelsLoaded) return null;
  if (!selector) return null;

  const title =
    selector.source === "cli"
      ? "Ctrl+Tab to cycle · Restarts the agent with the selected model"
      : "Ctrl+Tab to cycle models";

  return (
    <div className="model-selector">
      <ModelSelectorDropdown
        variant="session"
        choices={selector.choices}
        currentValue={selector.currentValue}
        disabled={disabled}
        changing={changing}
        title={title}
        onSelect={handleSelect}
      />
      <EffortSelector
        options={effortOptions}
        currentValue={currentEffort}
        disabled={disabled}
        changing={changing}
        onSelect={(value) => {
          applyEffortChange(value).catch((error) => {
            console.error("Reasoning effort change failed", error);
          });
        }}
      />
    </div>
  );
}
