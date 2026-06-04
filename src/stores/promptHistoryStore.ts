import { create } from "zustand";

interface PromptHistoryState {
  history: string[]; // oldest first, newest last
  historyIndex: number; // -1 = not navigating history

  addPrompt: (prompt: string) => void;
  navigateUp: (currentText: string) => string;
  navigateDown: (currentText: string) => string;
  resetNavigation: () => void;
}

export const usePromptHistoryStore = create<PromptHistoryState>((set, get) => ({
  history: [],
  historyIndex: -1,

  addPrompt: (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    const { history } = get();
    if (history.length > 0 && history[history.length - 1] === trimmed) {
      // avoid consecutive duplicates; still reset nav
      set({ historyIndex: -1 });
      return;
    }
    set({
      history: [...history, trimmed],
      historyIndex: -1,
    });
  },

  navigateUp: (currentText: string) => {
    const { history, historyIndex: curIdx } = get();
    if (history.length === 0) return currentText;

    let newIndex: number;
    if (curIdx === -1 || curIdx >= history.length) {
      newIndex = history.length - 1;
    } else {
      newIndex = Math.max(0, curIdx - 1);
    }

    set({ historyIndex: newIndex });
    return history[newIndex];
  },

  navigateDown: (currentText: string) => {
    const { history, historyIndex: curIdx } = get();
    if (curIdx === -1 || curIdx >= history.length) {
      return currentText;
    }

    const newIndex = curIdx + 1;
    if (newIndex >= history.length) {
      // Down from the newest history item (or past it) clears the prompt.
      // This is the requested behavior: Up to recall, Down clears (instead of
      // restoring any pre-navigation text).
      set({ historyIndex: -1 });
      return "";
    }

    set({ historyIndex: newIndex });
    return history[newIndex];
  },

  resetNavigation: () => {
    set({ historyIndex: -1 });
  },
}));
