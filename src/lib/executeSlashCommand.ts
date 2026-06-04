import { refreshUsageAfterTurn } from "@/lib/syncGrokSessionUsage";
import {
  isLocalSlashCommand,
  parseSlashMessage,
  resolveCanonicalSlashName,
} from "@/lib/slashCommands";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUsageStore } from "@/stores/usageStore";

function parseOnOff(args: string): boolean | null {
  const v = args.trim().toLowerCase();
  if (!v) return null;
  if (["off", "false", "0", "no", "disable"].includes(v)) return false;
  return true;
}

export type SlashCommandResult =
  | { handled: true; forwardText?: string }
  | { handled: false };

/** Desktop handling for slash commands; returns handled or text to forward. */
export function executeSlashCommand(text: string): SlashCommandResult {
  const parsed = parseSlashMessage(text);
  if (!parsed) return { handled: false };

  const canonical = resolveCanonicalSlashName(parsed.name);

  if (isLocalSlashCommand(canonical)) {
    useUsageStore.getState().setOverlayOpen(true);
    return { handled: true };
  }

  if (canonical === "always-approve") {
    const settings = useSettingsStore.getState();
    const next = parseOnOff(parsed.args);
    const alwaysApprove = next ?? !settings.settings.alwaysApprove;
    void settings.updateSettings({ alwaysApprove });
    return { handled: true };
  }

  return {
    handled: true,
    forwardText: `/${canonical}${parsed.args ? ` ${parsed.args}` : ""}`.trim(),
  };
}

export function refreshUsageForSlash(sessionId: string): void {
  refreshUsageAfterTurn(sessionId);
}