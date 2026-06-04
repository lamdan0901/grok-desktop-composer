import { create } from "zustand";

const MAX_LINES = 100;

interface AcpState {
  linesByTab: Record<string, string[]>;
  errorsByTab: Record<string, string[]>;
  appendLine: (tabId: string, line: string) => void;
  appendError: (tabId: string, message: string) => void;
  clearTab: (tabId: string) => void;
}

function pushCapped(list: string[], value: string): string[] {
  const next = [...list, value];
  if (next.length > MAX_LINES) {
    return next.slice(next.length - MAX_LINES);
  }
  return next;
}

export const useAcpStore = create<AcpState>((set) => ({
  linesByTab: {},
  errorsByTab: {},

  appendLine: (tabId, line) =>
    set((state) => ({
      linesByTab: {
        ...state.linesByTab,
        [tabId]: pushCapped(state.linesByTab[tabId] ?? [], line),
      },
    })),

  appendError: (tabId, message) =>
    set((state) => ({
      errorsByTab: {
        ...state.errorsByTab,
        [tabId]: pushCapped(state.errorsByTab[tabId] ?? [], message),
      },
    })),

  clearTab: (tabId) =>
    set((state) => {
      const { [tabId]: _l, ...linesByTab } = state.linesByTab;
      const { [tabId]: _e, ...errorsByTab } = state.errorsByTab;
      return { linesByTab, errorsByTab };
    }),
}));