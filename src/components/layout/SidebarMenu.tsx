import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/DropdownMenu";

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

interface SidebarMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: SidebarMenuItem[];
  onClose: () => void;
}

export function SidebarMenu({ open, x, y, items, onClose }: SidebarMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxY = Math.max(8, Math.min(y, window.innerHeight - 280));

  return createPortal(
    <DropdownMenu
      ref={ref}
      portal
      style={{ left: x, top: maxY }}
    >
      {items.map((item) => (
        <DropdownMenuItem
          key={item.id}
          danger={item.danger}
          disabled={item.disabled}
          icon={item.icon}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>,
    document.body,
  );
}