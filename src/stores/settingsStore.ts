import { create } from "zustand";
import { fetchSettings, persistSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  settingsOpen: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  settingsOpen: false,

  loadSettings: async () => {
    try {
      const raw = await fetchSettings();
      const settings: AppSettings = { ...DEFAULT_SETTINGS, ...raw };
      set({ settings, loaded: true });
      document.documentElement.dataset.theme = settings.theme;
    } catch {
      set({ loaded: true });
    }
  },

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    document.documentElement.dataset.theme = next.theme;
    try {
      const saved = await persistSettings(next);
      set({ settings: saved });
    } catch {
      // Keep optimistic local state if persistence fails (e.g. browser preview)
    }
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));