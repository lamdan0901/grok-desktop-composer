import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuWrap,
} from "@/components/ui/DropdownMenu";
import {
  COMPOSER_ACCESS_MODE_PRESENTATION,
  composerAccessModeFromSettings,
  presentationForSettings,
  settingsPatchForComposerAccessMode,
  type ComposerAccessMode,
  type ComposerAccessModePresentation,
} from "@/lib/composerAccessMode";
import { useSettingsStore } from "@/stores/settingsStore";

type AccessModePillProps = {
  className?: string;
  variant?: "home" | "session";
};

function ModeIcon({
  presentation,
  size = 15,
}: {
  presentation: ComposerAccessModePresentation;
  size?: number;
}) {
  const { Icon } = presentation;
  return (
    <span className="access-mode-pill__icon-wrap" aria-hidden>
      <Icon size={size} className="access-mode-pill__icon" strokeWidth={2} />
    </span>
  );
}

export function AccessModePill({ className, variant = "home" }: AccessModePillProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const activeMode = composerAccessModeFromSettings(settings);
  const presentation = presentationForSettings(settings);
  const toneClass = presentation.isAdvanced
    ? "access-mode-pill--advanced"
    : `access-mode-pill--${presentation.tone}`;

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const applyMode = useCallback(
    (mode: ComposerAccessMode) => {
      void updateSettings(settingsPatchForComposerAccessMode(mode));
      setMenuOpen(false);
    },
    [updateSettings],
  );

  const isHome = variant === "home";
  const wrapClass = [
    isHome ? "home-composer__pill-wrap" : "composer__pill-wrap",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DropdownMenuWrap
      className={wrapClass}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`access-mode-pill access-mode-pill--${variant} ${toneClass}`}
        title="Shift+Tab to cycle · Restart thread to apply to a running agent"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <ModeIcon presentation={presentation} />
        <span className="access-mode-pill__label">{presentation.label}</span>
        <ChevronDown size={14} className="access-mode-pill__chevron" aria-hidden />
      </button>
      {menuOpen && (
        <DropdownMenu>
          {COMPOSER_ACCESS_MODE_PRESENTATION.map((opt) => {
            const { Icon } = opt;
            return (
              <DropdownMenuItem
                key={opt.value}
                className={`ui-dropdown__item--access-${opt.tone}`}
                active={activeMode === opt.value}
                icon={<Icon size={14} strokeWidth={2} />}
                onClick={() => applyMode(opt.value)}
              >
                {opt.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenu>
      )}
    </DropdownMenuWrap>
  );
}