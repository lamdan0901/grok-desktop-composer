import { create } from "zustand";
import type { HookEntry } from "@/lib/acp/xaiExtensions";

type State = {
  hooksByTab: Record<string, HookEntry[]>;
  loadingByTab: Record<string, boolean>;
  errorByTab: Record<string, string | undefined>;
  setHooks: (tabId: string, hooks: HookEntry[]) => void;
  setLoading: (tabId: string, value: boolean) => void;
  setError: (tabId: string, value?: string) => void;
  clearTab: (tabId: string) => void;
};

export const useHookStore = create<State>((set) => ({
  hooksByTab: {},
  loadingByTab: {},
  errorByTab: {},
  setHooks: (tabId, hooks) => set((state) => ({ hooksByTab: { ...state.hooksByTab, [tabId]: hooks } })),
  setLoading: (tabId, value) => set((state) => ({ loadingByTab: { ...state.loadingByTab, [tabId]: value } })),
  setError: (tabId, value) => set((state) => ({ errorByTab: { ...state.errorByTab, [tabId]: value } })),
  clearTab: (tabId) => set((state) => {
    const { [tabId]: _hooks, ...hooksByTab } = state.hooksByTab;
    const { [tabId]: _loading, ...loadingByTab } = state.loadingByTab;
    const { [tabId]: _error, ...errorByTab } = state.errorByTab;
    return { hooksByTab, loadingByTab, errorByTab };
  }),
}));
