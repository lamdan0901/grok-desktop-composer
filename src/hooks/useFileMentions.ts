import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from "react";
import { listProjectFiles } from "@/lib/acpFs";
import {
  detectFileMention,
  filterFileMentions,
  replaceFileMention,
  type ProjectFileEntry,
} from "@/lib/fileMentions";

type UseFileMentionsOptions = {
  cwd?: string;
  text: string;
  cursor: number;
  setText: (value: string) => void;
  setCursor: (value: number) => void;
  disabled?: boolean;
  pickerAnchorRef?: RefObject<HTMLElement | null>;
};

export function useFileMentions({
  cwd,
  text,
  cursor,
  setText,
  setCursor,
  disabled,
  pickerAnchorRef,
}: UseFileMentionsOptions) {
  const [entries, setEntries] = useState<ProjectFileEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const context = useMemo(() => detectFileMention(text, cursor), [text, cursor]);
  const menuOpen = Boolean(!disabled && cwd && context);
  const filtered = useMemo(
    () => (menuOpen && context ? filterFileMentions(entries, context.query) : []),
    [context, entries, menuOpen],
  );

  useEffect(() => {
    if (!cwd) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    listProjectFiles(cwd)
      .then((next) => {
        if (!cancelled) setEntries(next);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  useEffect(() => setActiveIndex(0), [text, context?.query, filtered.length]);

  const dismissMenu = useCallback(() => {
    if (!context) return;
    setText(text.slice(0, context.range.start) + text.slice(context.range.end));
    setCursor(context.range.start);
  }, [context, setCursor, setText, text]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (pickerAnchorRef?.current?.contains(target)) return;
      if (document.querySelector(".file-mention-picker")?.contains(target)) return;
      dismissMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [dismissMenu, menuOpen, pickerAnchorRef]);

  const applyEntry = useCallback(
    (entry: ProjectFileEntry) => {
      if (!context) return;
      const replacement = entry.isDir ? `${entry.path}/` : `${entry.path} `;
      const nextText = replaceFileMention(text, context, replacement);
      const nextCursor = context.pathStart + replacement.length;
      setText(nextText);
      setCursor(nextCursor);
    },
    [context, setCursor, setText, text],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!menuOpen) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        dismissMenu();
        return true;
      }
      if (!filtered.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % filtered.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
        return true;
      }
      if (event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) {
        const entry = filtered[activeIndex];
        if (!entry) return false;
        event.preventDefault();
        applyEntry(entry);
        return true;
      }
      return false;
    }, [activeIndex, applyEntry, dismissMenu, filtered, menuOpen],
  );

  return { menuOpen, filtered, activeIndex, applyEntry, handleKeyDown };
}
