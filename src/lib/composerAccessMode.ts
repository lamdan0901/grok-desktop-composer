import type { LucideIcon } from "lucide-react";
import { BadgeCheck, ListChecks, Shield, ShieldAlert } from "lucide-react";
import type { AppSettings, PermissionMode } from "@/lib/types";

/** Grok CLI code-mode cycle (Shift+Tab): Normal → Always Approve → Plan */
export type ComposerAccessMode = "normal" | "alwaysApprove" | "plan";

export type ComposerAccessModePresentation = {
  value: ComposerAccessMode;
  label: string;
  Icon: LucideIcon;
  /** Modifier on `.access-mode-pill` and `.ui-dropdown__item--access-*` */
  tone: ComposerAccessMode;
};

export const COMPOSER_ACCESS_MODE_ORDER: ComposerAccessMode[] = [
  "normal",
  "alwaysApprove",
  "plan",
];

export const COMPOSER_ACCESS_MODE_PRESENTATION: ComposerAccessModePresentation[] =
  [
    { value: "normal", label: "Normal", Icon: Shield, tone: "normal" },
    {
      value: "alwaysApprove",
      label: "Always Approve",
      Icon: BadgeCheck,
      tone: "alwaysApprove",
    },
    { value: "plan", label: "Plan", Icon: ListChecks, tone: "plan" },
  ];

/** @deprecated Use COMPOSER_ACCESS_MODE_PRESENTATION */
export const COMPOSER_ACCESS_MODE_OPTIONS = COMPOSER_ACCESS_MODE_PRESENTATION.map(
  ({ value, label }) => ({ value, label }),
);

const PRESENTATION_BY_MODE = Object.fromEntries(
  COMPOSER_ACCESS_MODE_PRESENTATION.map((p) => [p.value, p]),
) as Record<ComposerAccessMode, ComposerAccessModePresentation>;

export function presentationForAccessMode(
  mode: ComposerAccessMode,
): ComposerAccessModePresentation {
  return PRESENTATION_BY_MODE[mode];
}

export function presentationForSettings(
  settings: Pick<AppSettings, "permissionMode" | "alwaysApprove">,
): ComposerAccessModePresentation & { isAdvanced: boolean } {
  const mode = composerAccessModeFromSettings(settings);
  if (mode) {
    return { ...presentationForAccessMode(mode), isAdvanced: false };
  }
  return {
    value: "normal",
    label: composerAccessModeLabel(settings),
    Icon: ShieldAlert,
    tone: "normal",
    isAdvanced: true,
  };
}

export function composerAccessModeFromSettings(
  settings: Pick<AppSettings, "permissionMode" | "alwaysApprove">,
): ComposerAccessMode | null {
  if (settings.permissionMode === "plan") return "plan";
  if (settings.alwaysApprove && settings.permissionMode === "default") {
    return "alwaysApprove";
  }
  if (settings.permissionMode === "default" && !settings.alwaysApprove) {
    return "normal";
  }
  return null;
}

export function composerAccessModeLabel(
  settings: Pick<AppSettings, "permissionMode" | "alwaysApprove">,
): string {
  const mode = composerAccessModeFromSettings(settings);
  if (mode) {
    return (
      COMPOSER_ACCESS_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode
    );
  }
  return advancedPermissionLabel(settings.permissionMode);
}

function advancedPermissionLabel(mode: PermissionMode): string {
  const labels: Record<PermissionMode, string> = {
    default: "Default",
    acceptEdits: "Accept edits",
    auto: "Auto",
    dontAsk: "Don't ask",
    bypassPermissions: "Bypass permissions",
    plan: "Plan",
  };
  return labels[mode] ?? mode;
}

export function settingsPatchForComposerAccessMode(
  mode: ComposerAccessMode,
): Pick<AppSettings, "permissionMode" | "alwaysApprove"> {
  switch (mode) {
    case "plan":
      return { permissionMode: "plan", alwaysApprove: false };
    case "alwaysApprove":
      return { permissionMode: "default", alwaysApprove: true };
    case "normal":
      return { permissionMode: "default", alwaysApprove: false };
  }
}

export function nextComposerAccessMode(
  settings: Pick<AppSettings, "permissionMode" | "alwaysApprove">,
): ComposerAccessMode {
  const current = composerAccessModeFromSettings(settings);
  if (!current) return "normal";
  const idx = COMPOSER_ACCESS_MODE_ORDER.indexOf(current);
  return COMPOSER_ACCESS_MODE_ORDER[(idx + 1) % COMPOSER_ACCESS_MODE_ORDER.length];
}

export function isAccessModeCycleKey(e: {
  key: string;
  shiftKey: boolean;
}): boolean {
  return e.key === "Tab" && e.shiftKey;
}