import type { SessionConfigOption } from "@agentclientprotocol/sdk";
import { create } from "zustand";
import { listGrokModels } from "@/lib/grok";
import {
  modelSelectorFromCli,
  modelSelectorFromConfig,
  type ModelSelectorState,
} from "@/lib/sessionConfig";
import type { SessionId } from "@/lib/types";
import {
  parseReasoningEfforts,
  type EffortOption,
  type SessionModelState,
} from "@/lib/sessionModel";
import { useSettingsStore } from "@/stores/settingsStore";

interface SessionConfigState {
  bySession: Record<SessionId, SessionConfigOption[]>;
  modelsBySession: Record<SessionId, SessionModelState>;
  cliModels: string[];
  cliDefaultModel: string;
  cliModelsLoaded: boolean;
  cliModelsError: string | null;
  setConfigOptions: (sessionId: SessionId, options: SessionConfigOption[]) => void;
  setSessionModels: (sessionId: SessionId, models: SessionModelState) => void;
  setCurrentModel: (sessionId: SessionId, modelId: string) => void;
  getEffortOptions: (sessionId: SessionId | null) => EffortOption[];
  clearSession: (sessionId: SessionId) => void;
  loadCliModels: () => Promise<void>;
  getModelSelector: (sessionId: SessionId | null) => ModelSelectorState;
}

export const useSessionConfigStore = create<SessionConfigState>((set, get) => ({
  bySession: {},
  modelsBySession: {},
  cliModels: [],
  cliDefaultModel: "",
  cliModelsLoaded: false,
  cliModelsError: null,

  setConfigOptions: (sessionId, options) => {
    set((s) => ({
      bySession: { ...s.bySession, [sessionId]: options },
    }));
  },

  setSessionModels: (sessionId, models) =>
    set((s) => ({
      modelsBySession: { ...s.modelsBySession, [sessionId]: models },
    })),

  setCurrentModel: (sessionId, modelId) =>
    set((s) => {
      const models = s.modelsBySession[sessionId];
      return models
        ? {
            modelsBySession: {
              ...s.modelsBySession,
              [sessionId]: { ...models, currentModelId: modelId },
            },
          }
        : s;
    }),

  getEffortOptions: (sessionId) => {
    if (!sessionId) return [];
    const models = get().modelsBySession[sessionId];
    const selected = models?.availableModels.find(
      (model) => model.modelId === models.currentModelId,
    );
    return parseReasoningEfforts(selected?.meta);
  },

  clearSession: (sessionId) => {
    set((s) => {
      const next = { ...s.bySession };
      const nextModels = { ...s.modelsBySession };
      delete next[sessionId];
      delete nextModels[sessionId];
      return { bySession: next, modelsBySession: nextModels };
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