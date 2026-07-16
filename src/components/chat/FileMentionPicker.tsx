import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { ProjectFileEntry } from "@/lib/fileMentions";

type FileMentionPickerProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  items: ProjectFileEntry[];
  activeIndex: number;
  onSelect: (entry: ProjectFileEntry) => void;
};

export function FileMentionPicker({
  open,
  anchorRef,
  items,
  activeIndex,
  onSelect,
}: FileMentionPickerProps) {
  const [style, setStyle] = useState<CSSProperties>({});
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setStyle({
        position: "fixed",
        left: rect.left,
        top: rect.top - 8,
        transform: "translateY(-100%)",
        width: Math.min(Math.max(rect.width, 320), window.innerWidth - 24),
        maxHeight: Math.min(320, Math.max(140, rect.top - 24)),
        zIndex: 10000,
      });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, items.length, open]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items.length, open]);

  if (!open) return null;
  return createPortal(
    <div
      className="file-mention-picker slash-command-picker"
      role="listbox"
      aria-label="File mentions"
      style={style}
    >
      {items.length === 0 ? (
        <div className="slash-command-picker__empty">No matching files</div>
      ) : (
        items.map((entry, index) => (
          <button
            key={`${entry.isDir ? "dir" : "file"}-${entry.path}`}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={`slash-command-picker__item${index === activeIndex ? " slash-command-picker__item--active" : ""}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(entry)}
          >
            <span className="slash-command-picker__head">
              <span className="slash-command-picker__name">@{entry.path}</span>
              <span className="slash-command-picker__scope">{entry.isDir ? "folder" : "file"}</span>
            </span>
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
