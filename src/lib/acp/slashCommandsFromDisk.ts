import { readGrokUpdatesJsonl } from "@/lib/sessions";
import type { SessionId } from "@/lib/types";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";
import { ingestSlashCommandsFromAcpLine } from "./ingestSlashCommands";

/**
 * Load the last `available_commands_update` from Grok's on-disk `updates.jsonl`
 * without starting the ACP agent.
 */
export async function tryLoadSlashCommandsFromDisk(
  tabId: SessionId,
  grokSessionId: string,
  cwd: string,
): Promise<boolean> {
  if (useSlashCommandsStore.getState().isCached(tabId)) return true;

  try {
    const raw = await readGrokUpdatesJsonl(grokSessionId, cwd);
    if (!raw?.trim()) return false;

    for (const line of raw.split(/\r?\n/)) {
      if (!line.includes("available_commands")) continue;
      ingestSlashCommandsFromAcpLine(tabId, line);
    }

    return useSlashCommandsStore.getState().isCached(tabId);
  } catch {
    return false;
  }
}