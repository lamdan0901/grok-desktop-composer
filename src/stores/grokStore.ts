import { create } from "zustand";
import {
  checkAuth,
  checkCliReady,
  runGrokLogin,
  runGrokLogout,
  type AuthCheckResult,
  type CliReadyResult,
} from "@/lib/grok";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";

interface GrokState {
  cli: CliReadyResult | null;
  auth: AuthCheckResult | null;
  loaded: boolean;
  loginPending: boolean;
  refresh: () => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useGrokStore = create<GrokState>((set, get) => ({
  cli: null,
  auth: null,
  loaded: false,
  loginPending: false,

  refresh: async () => {
    try {
      const cli = await checkCliReady();
      const auth = cli.authenticated
        ? { authenticated: true, message: null }
        : await checkAuth();
      set({ cli, auth, loaded: true, loginPending: false });
      if (auth.authenticated && !useSessionConfigStore.getState().cliModelsLoaded) {
        void useSessionConfigStore.getState().loadCliModels();
      }
    } catch {
      set({
        cli: {
          ready: false,
          version: null,
          grokPath: "",
          authenticated: false,
          error: "Grok CLI commands are only available in the desktop app.",
        },
        auth: { authenticated: false, message: null },
        loaded: true,
        loginPending: false,
      });
    }
  },

  signIn: async () => {
    set({ loginPending: true });
    try {
      await runGrokLogin(true);
    } catch {
      set({ loginPending: false });
      return;
    }
    const poll = async (attempt: number) => {
      if (attempt > 60) {
        set({ loginPending: false });
        return;
      }
      const auth = await checkAuth().catch(() => ({
        authenticated: false,
        message: null,
      }));
      if (auth.authenticated) {
        await get().refresh();
        return;
      }
      window.setTimeout(() => void poll(attempt + 1), 2000);
    };
    void poll(0);
  },

  signOut: async () => {
    try {
      await runGrokLogout();
    } catch {
      // ignore when not in Tauri
    }
    await get().refresh();
  },
}));