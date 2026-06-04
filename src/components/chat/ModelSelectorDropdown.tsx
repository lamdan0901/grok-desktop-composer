import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuWrap,
} from "@/components/ui/DropdownMenu";

export type ModelChoice = {
  value: string;
  label: string;
};

type ModelSelectorDropdownProps = {
  choices: ModelChoice[];
  currentValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
  changing?: boolean;
  variant?: "home" | "session";
  title?: string;
};

export function ModelSelectorDropdown({
  choices,
  currentValue,
  onSelect,
  disabled = false,
  changing = false,
  variant = "session",
  title = "Ctrl+Tab to cycle models",
}: ModelSelectorDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const currentLabel =
    choices.find((c) => c.value === currentValue)?.label ?? currentValue;

  const wrapClass =
    variant === "home" ? "home-composer__pill-wrap" : "composer__pill-wrap";
  const pillClass =
    variant === "home"
      ? "home-composer__pill home-composer__pill--model"
      : "model-selector-pill";

  return (
    <DropdownMenuWrap
      className={wrapClass}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={pillClass}
        disabled={disabled}
        title={title}
        aria-label="Model"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          if (!disabled) setMenuOpen((v) => !v);
        }}
      >
        <span>{changing ? "Updating…" : currentLabel}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {menuOpen && !disabled && (
        <DropdownMenu align={variant === "home" ? "right" : "left"}>
          {choices.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              active={opt.value === currentValue}
              onClick={() => {
                onSelect(opt.value);
                setMenuOpen(false);
              }}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenu>
      )}
    </DropdownMenuWrap>
  );
}