import { useCallback, useMemo, useState } from "react";
import { suppressAgentOutput } from "@/lib/agentOutputGuard";
import { getTabSession, restartSessionAgent } from "@/lib/acp";
import { restartTab } from "@/lib/grok";
import {
  modelSelectorFromCli,
  modelSelectorFromConfig,
} from "@/lib/sessionConfig";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

const ACP_MODEL_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Model change timed out")),
        ms,
      );
    }),
  ]);
}

export function useApplyModelChange() {
  const [changing, setChanging] = useState(false);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const projects = useWorkspaceStore((s) => s.projects);
  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const setAcpState = useWorkspaceStore((s) => s.setAcpState);
  const setGrokSessionId = useWorkspaceStore((s) => s.setGrokSessionId);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const configOptions = useSessionConfigStore((s) =>
    activeSessionId ? s.bySession[activeSessionId] : undefined,
  );
  const cliModels = useSessionConfigStore((s) => s.cliModels);
  const cliDefaultModel = useSessionConfigStore((s) => s.cliDefaultModel);
  const getEffortOptions = useSessionConfigStore((s) => s.getEffortOptions);
  const getCurrentEffort = useSessionConfigStore((s) => s.getCurrentEffort);
  const getCurrentModelId = useSessionConfigStore((s) => s.getCurrentModelId);
  const setCurrentEffort = useSessionConfigStore((s) => s.setCurrentEffort);
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);

  const selector = useMemo(() => {
    const fromAcp = configOptions?.length
      ? modelSelectorFromConfig(configOptions)
      : null;
    if (fromAcp) return fromAcp;
    return modelSelectorFromCli(cliModels, cliDefaultModel, defaultModel);
  }, [configOptions, cliModels, cliDefaultModel, defaultModel]);

  const restartWithModel = useCallback(
    async (modelId: string) => {
      if (!session || !cwd) return;
      await updateSettings({ defaultModel: modelId });
      setAcpState(session.id, "connecting");
      try {
        await restartTab(session.id);
        await restartSessionAgent(session.id, cwd, session.grokSessionId);
      } finally {
        setAcpState(session.id, "ready");
        const grokId = getTabSession(session.id).grokSessionId;
        if (grokId) setGrokSessionId(session.id, grokId, cwd);
      }
    },
    [session, cwd, updateSettings, setAcpState, setGrokSessionId],
  );

  const applyModelChange = useCallback(
    async (value: string) => {
      if (!session || !cwd || !selector || value === selector.currentValue) {
        return;
      }

      if (session.messages.length > 0) {
        suppressAgentOutput(session.id);
      }

      setChanging(true);
      try {
        if (selector.source === "acp") {
          await withTimeout(
            getTabSession(session.id).setModel(value),
            ACP_MODEL_TIMEOUT_MS,
          );
        } else {
          await restartWithModel(value);
        }
      } catch {
        setAcpState(session.id, "error", "Failed to change model");
      } finally {
        setChanging(false);
      }
    },
    [session, cwd, selector, restartWithModel, setAcpState],
  );

  const effortOptions = activeSessionId
    ? getEffortOptions(activeSessionId)
    : [];
  const currentEffort = activeSessionId
    ? getCurrentEffort(activeSessionId)
    : undefined;
  const currentModelId = activeSessionId
    ? getCurrentModelId(activeSessionId)
    : undefined;

  const applyEffortChange = useCallback(
    async (effort: string) => {
      if (
        !session ||
        !cwd ||
        !currentModelId ||
        currentEffort === effort ||
        !effortOptions.some((option) => option.value === effort)
      ) {
        return;
      }

      if (session.messages.length > 0) {
        suppressAgentOutput(session.id);
      }

      setChanging(true);
      try {
        await withTimeout(
          getTabSession(session.id).setModel(currentModelId, effort),
          ACP_MODEL_TIMEOUT_MS,
        );
        setCurrentEffort(session.id, effort);
      } catch {
        setAcpState(session.id, "error", "Failed to change reasoning effort");
      } finally {
        setChanging(false);
      }
    },
    [
      session,
      cwd,
      currentModelId,
      currentEffort,
      effortOptions,
      setCurrentEffort,
      setAcpState,
    ],
  );

  const disabled =
    !session ||
    !cwd ||
    session.acpState === "connecting" ||
    session.status === "plan_review" ||
    session.status === "awaiting_permission" ||
    changing;

  return {
    applyModelChange,
    applyEffortChange,
    changing,
    disabled,
    selector,
    effortOptions,
    currentEffort,
  };
}
