import { useCallback, useState } from "react";
import { clampSidebarWidth } from "@/lib/sidebarLayout";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function useSidebarResize() {
  const sidebarWidth = useWorkspaceStore((s) => s.sidebarWidth);
  const setSidebarWidth = useWorkspaceStore((s) => s.setSidebarWidth);
  const [resizing, setResizing] = useState(false);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      setResizing(true);

      const onMove = (ev: PointerEvent) => {
        setSidebarWidth(startWidth + (ev.clientX - startX));
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        setResizing(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        e.currentTarget.releasePointerCapture(e.pointerId);
        e.currentTarget.removeEventListener("pointermove", onMove);
        e.currentTarget.removeEventListener("pointerup", onUp);
        e.currentTarget.removeEventListener("pointercancel", onUp);
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.currentTarget.addEventListener("pointermove", onMove);
      e.currentTarget.addEventListener("pointerup", onUp);
      e.currentTarget.addEventListener("pointercancel", onUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  return {
    sidebarWidth: clampSidebarWidth(sidebarWidth),
    resizing,
    onResizePointerDown,
  };
}