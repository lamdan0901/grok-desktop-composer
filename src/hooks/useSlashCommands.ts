import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { loadSlashCommandsForSession } from "@/lib/loadSlashCommands";
import {
  entriesFromAvailableCommands,
  formatSlashCommand,
  fuzzyFilterSlashCommands,
  parseSlashInput,
  type SlashCommandEntry,
} from "@/lib/slashCommands";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";

type UseSlashCommandsOptions = {
  sessionId: string | undefined;
  cwd: string | undefined;
  grokSessionId?: string;
  text: string;
  setText: (value: string) => void;
  disabled?: boolean;
  pickerAnchorRef?: RefObject<HTMLElement | null>;
};

export function useSlashCommands({
  sessionId,
  cwd,
  grokSessionId,
  text,
  setText,
  disabled,
  pickerAnchorRef,
}: UseSlashCommandsOptions) {
  const sessionCommands = useSlashCommandsStore((s) =>
    sessionId ? s.bySession[sessionId] : undefined,
  );
  const loadStatus = useSlashCommandsStore((s) =>
    sessionId ? s.statusBySession[sessionId] : undefined,
  );
  const isCached = loadStatus === "loaded";
  const [activeIndex, setActiveIndex] = useState(0);

  const slashState = useMemo(() => parseSlashInput(text), [text]);
  const slashFromInput = Boolean(
    !disabled && text.startsWith("/") && slashState?.open,
  );
  const menuOpen = Boolean(sessionId && cwd && slashFromInput);
  const loadingCommands = menuOpen && !isCached && loadStatus === "loading";

  const filterQuery =
    slashFromInput && slashState?.open ? slashState.query : "";

  const allEntries = useMemo(
    () =>
      sessionCommands
        ? entriesFromAvailableCommands(sessionCommands)
        : [],
    [sessionCommands],
  );

  const filtered = useMemo(() => {
    if (!menuOpen) return [];
    return fuzzyFilterSlashCommands(allEntries, filterQuery);
  }, [allEntries, menuOpen, filterQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [text, filterQuery, filtered.length]);

  useEffect(() => {
    if (!menuOpen || !sessionId || !cwd) return;
    if (isCached || loadStatus === "loading") return;

    void loadSlashCommandsForSession(sessionId, cwd, grokSessionId);
  }, [menuOpen, sessionId, cwd, grokSessionId, isCached, loadStatus]);

  const dismissMenu = useCallback(() => {
    setText("");
  }, [setText]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (pickerAnchorRef?.current?.contains(target)) return;
      const picker = document.querySelector(".slash-command-picker");
      if (picker?.contains(target)) return;
      dismissMenu();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, dismissMenu, pickerAnchorRef]);

  const applyEntry = useCallback(
    (entry: SlashCommandEntry) => {
      setText(formatSlashCommand(entry.canonicalName));
    },
    [setText],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!menuOpen) return false;
      if (filtered.length === 0) {
        if (e.key === "Escape") {
          e.preventDefault();
          dismissMenu();
          return true;
        }
        return false;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % filtered.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        dismissMenu();
        return true;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        const entry = filtered[activeIndex];
        if (entry) {
          e.preventDefault();
          applyEntry(entry);
          return true;
        }
      }
      return false;
    },
    [menuOpen, filtered, activeIndex, applyEntry, dismissMenu],
  );

  return {
    menuOpen,
    filtered,
    activeIndex,
    applyEntry,
    handleKeyDown,
    dismissMenu,
    connecting: loadingCommands,
    loadingCommands,
    hasSession: Boolean(sessionId),
  };
}