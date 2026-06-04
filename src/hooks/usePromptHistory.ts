import { useCallback, useEffect, type KeyboardEvent } from "react";
import { usePromptHistoryStore } from "@/stores/promptHistoryStore";

type UsePromptHistoryOptions = {
  text: string;
  setText: (value: string) => void;
};

export function usePromptHistory({ text, setText }: UsePromptHistoryOptions) {
  const navigateUp = usePromptHistoryStore((s) => s.navigateUp);
  const navigateDown = usePromptHistoryStore((s) => s.navigateDown);
  const resetNavigation = usePromptHistoryStore((s) => s.resetNavigation);
  const addPrompt = usePromptHistoryStore((s) => s.addPrompt);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") {
        return false;
      }
      e.preventDefault();
      if (e.key === "ArrowUp") {
        const nextText = navigateUp(text);
        setText(nextText);
      } else {
        const nextText = navigateDown(text);
        setText(nextText);
      }
      return true;
    },
    [text, setText, navigateUp, navigateDown],
  );

  const commitPrompt = useCallback(
    (prompt: string) => {
      addPrompt(prompt);
      resetNavigation();
    },
    [addPrompt, resetNavigation],
  );

  // Detach from history navigation if the user edits the text away from the
  // currently recalled history item. This makes the edited value the new live
  // text for subsequent Up presses (next Up will start from the most recent).
  useEffect(() => {
    const state = usePromptHistoryStore.getState();
    const idx = state.historyIndex;
    if (idx === -1) return;
    const hist = state.history;
    if (idx >= hist.length || hist[idx] !== text) {
      resetNavigation();
    }
  }, [text, resetNavigation]);

  return {
    handleKeyDown,
    commitPrompt,
  };
}
