import type { AvailableCommand } from "@agentclientprotocol/sdk";
import { parseAcpLine } from "@/lib/acp/acpStreamFilter";
import type { SessionId } from "@/lib/types";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";

const SESSION_NOTIFY_METHODS = new Set([
  "session/update",
  "x.ai/session/update",
  "x.ai/session_notification",
  "_x.ai/session_notification",
]);

function commandsFromUpdate(
  update: Record<string, unknown>,
): AvailableCommand[] | null {
  if (update.sessionUpdate !== "available_commands_update") return null;
  const list =
    update.availableCommands ??
    (update.available_commands as AvailableCommand[] | undefined);
  if (!Array.isArray(list) || list.length === 0) return null;
  return list as AvailableCommand[];
}

function extractFromParams(
  params: Record<string, unknown>,
): AvailableCommand[] | null {
  const update = params.update;
  if (!update || typeof update !== "object") return null;
  return commandsFromUpdate(update as Record<string, unknown>);
}

/**
 * Parse raw Grok ACP stdout (also used for debug log lines) and store slash commands.
 * Works even when the SDK drops or fails to validate a notification.
 */
export function ingestSlashCommandsFromAcpLine(
  tabId: SessionId,
  line: string,
): void {
  const trimmed = line.trim();
  if (!trimmed.includes("available_commands")) return;

  let payload: Record<string, unknown> | null = parseAcpLine(trimmed) as
    | Record<string, unknown>
    | null;

  if (!payload) {
    const jsonStart = trimmed.indexOf("{");
    if (jsonStart < 0) return;
    try {
      payload = JSON.parse(trimmed.slice(jsonStart)) as Record<string, unknown>;
    } catch {
      return;
    }
  }

  if (!payload || typeof payload !== "object") return;

  const method = payload.method;
  if (typeof method === "string" && SESSION_NOTIFY_METHODS.has(method)) {
    const params = payload.params;
    if (params && typeof params === "object") {
      const cmds = extractFromParams(params as Record<string, unknown>);
      if (cmds) {
        useSlashCommandsStore.getState().setCommands(tabId, cmds);
      }
    }
    return;
  }

  const update = payload.update;
  if (update && typeof update === "object") {
    const cmds = commandsFromUpdate(update as Record<string, unknown>);
    if (cmds) {
      useSlashCommandsStore.getState().setCommands(tabId, cmds);
    }
  }
}