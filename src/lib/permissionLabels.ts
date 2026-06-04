import type { PermissionMode } from "./types";

const SHORT_LABELS: Record<PermissionMode, string> = {
  default: "Default",
  acceptEdits: "Accept edits",
  auto: "Auto",
  dontAsk: "Don't ask",
  bypassPermissions: "Full access",
  plan: "Plan",
};

export function permissionModeShortLabel(mode: PermissionMode): string {
  return SHORT_LABELS[mode] ?? mode;
}