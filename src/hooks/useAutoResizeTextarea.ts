import { useCallback, useEffect, useRef } from "react";

const DEFAULT_MAX_HEIGHT = 300;

export function useAutoResizeTextarea(
  value: string,
  maxHeight = DEFAULT_MAX_HEIGHT,
) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjust = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const style = getComputedStyle(el);
    const minH = parseFloat(style.minHeight) || 0;
    const lineHeight = parseFloat(style.lineHeight) || 0;
    const paddingY =
      (parseFloat(style.paddingTop) || 0) +
      (parseFloat(style.paddingBottom) || 0);
    let contentHeight = Math.max(el.scrollHeight - paddingY, 0);
    if (lineHeight > 0) {
      const lines = Math.max(1, Math.ceil(contentHeight / lineHeight));
      contentHeight = lines * lineHeight;
    }
    const next = Math.min(Math.max(contentHeight + paddingY, minH), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  useEffect(() => {
    adjust();
  }, [value, adjust]);

  return { ref, adjust };
}