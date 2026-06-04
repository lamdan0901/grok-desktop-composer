import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  slashCommandLabel,
  type SlashCommandEntry,
} from "@/lib/slashCommands";

type SlashCommandPickerProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  items: SlashCommandEntry[];
  activeIndex: number;
  connecting?: boolean;
  loadingCommands?: boolean;
  onSelect: (entry: SlashCommandEntry) => void;
};

function scopeLabel(scope: SlashCommandEntry["scope"]): string {
  switch (scope) {
    case "skill":
      return "skill";
    case "alias":
      return "alias";
    default:
      return "builtin";
  }
}

export function SlashCommandPicker({
  open,
  anchorRef,
  items,
  activeIndex,
  connecting,
  loadingCommands,
  onSelect,
}: SlashCommandPickerProps) {
  const [style, setStyle] = useState<CSSProperties>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 8;
      const maxHeight = Math.min(320, Math.max(140, rect.top - gap - 16));
      setStyle({
        position: "fixed",
        left: rect.left,
        top: rect.top - gap,
        transform: "translateY(-100%)",
        width: Math.min(Math.max(rect.width, 320), window.innerWidth - 24),
        maxHeight,
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
  }, [open, anchorRef, items.length]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, items.length]);

  if (!open) return null;

  const showLoading = (connecting || loadingCommands) && items.length === 0;

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      className="slash-command-picker"
      style={style}
      aria-label="Slash commands"
    >
      {showLoading ? (
        <div className="slash-command-picker__empty">Loading commands…</div>
      ) : items.length === 0 ? (
        <div className="slash-command-picker__empty">No matching commands</div>
      ) : (
        items.map((entry, index) => (
          <button
            key={`${entry.displayName}-${entry.isAlias}`}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={[
              "slash-command-picker__item",
              index === activeIndex ? "slash-command-picker__item--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(entry)}
          >
            <span className="slash-command-picker__head">
              <span className="slash-command-picker__name">
                {slashCommandLabel(entry)}
              </span>
              <span className="slash-command-picker__scope">
                {scopeLabel(entry.scope)}
              </span>
            </span>
            {entry.inputHint ? (
              <span className="slash-command-picker__hint">{entry.inputHint}</span>
            ) : null}
            <span className="slash-command-picker__desc">{entry.description}</span>
          </button>
        ))
      )}
    </div>
  );

  return createPortal(menu, document.body);
}