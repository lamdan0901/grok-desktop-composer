import type { SessionConfigOption } from "@agentclientprotocol/sdk";
import { create } from "zustand";
import { listGrokModels } from "@/lib/grok";
import {
  modelSelectorFromCli,
  modelSelectorFromConfig,
  type ModelSelectorState,
} from "@/lib/sessionConfig";
import type { SessionId } from "@/lib/types";
import { useSettingsStore } from "@/stores/settingsStore";

interface SessionConfigState {
  bySession: Record<SessionId, SessionConfigOption[]>;
  cliModels: string[];
  cliDefaultModel: string;
  cliModelsLoaded: boolean;
  cliModelsError: string | null;
  setConfigOptions: (sessionId: SessionId, options: SessionConfigOption[]) => void;
  clearSession: (sessionId: SessionId) => void;
  loadCliModels: () => Promise<void>;
  getModelSelector: (sessionId: SessionId | null) => ModelSelectorState;
}

export const useSessionConfigStore = create<SessionConfigState>((set, get) => ({
  bySession: {},
  cliModels: [],
  cliDefaultModel: "",
  cliModelsLoaded: false,
  cliModelsError: null,

  setConfigOptions: (sessionId, options) => {
    set((s) => ({
      bySession: { ...s.bySession, [sessionId]: options },
    }));
  },

  clearSession: (sessionId) => {
    set((s) => {
      const next = { ...s.bySession };
      delete next[sessionId];
      return { bySession: next };
    });
  },

  loadCliModels: async () => {
    try {
      const result = await listGrokModels();
      set({
        cliModels: result.models,
        cliDefaultModel: result.defaultModel,
        cliModelsLoaded: true,
        cliModelsError: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load models";
      set({
        cliModelsLoaded: true,
        cliModelsError: message,
      });
    }
  },

  getModelSelector: (sessionId) => {
    const { bySession, cliModels, cliDefaultModel } = get();
    const settings = useSettingsStore.getState().settings;
    const configOptions = sessionId ? bySession[sessionId] : undefined;

    const fromAcp = configOptions?.length
      ? modelSelectorFromConfig(configOptions)
      : null;
    if (fromAcp) return fromAcp;

    return modelSelectorFromCli(
      cliModels,
      cliDefaultModel,
      settings.defaultModel,
    );
  },
}));