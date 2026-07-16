import { XAI } from "./xaiMethods";
import { useMcpStore, type McpServerEntry, type McpServerStatus } from "@/stores/mcpStore";
import { listMcpServers } from "./xaiMcp";
import { markNotificationSeen } from "./featureDetection";

/** Route an MCP status notification into the read-cache. Returns true if consumed. */
export function routeMcpNotification(
  tabId: string,
  method: string,
  params: Record<string, unknown>,
): boolean {
  switch (method) {
    case XAI.mcpServersUpdated.method: {
      markNotificationSeen(tabId, method);
      const servers = (params.mcpServers as McpServerEntry[]) ?? [];
      useMcpStore.getState().setServers(tabId, servers);
      return true;
    }
    case XAI.mcpServerStatus.method: {
      markNotificationSeen(tabId, method);
      const name = params.name as string | undefined;
      if (name) {
        useMcpStore.getState().applyServerStatus(tabId, {
          name,
          status: params.status as McpServerStatus | undefined,
        });
      }
      return true;
    }
    case XAI.mcpToolsChanged.method:
      markNotificationSeen(tabId, method);
      // Uniform "refetch" trigger — re-read the full catalog (best-effort).
      listMcpServers(tabId).catch(() => undefined);
      return true;
    case XAI.mcpInitProgress.method:
      markNotificationSeen(tabId, method);
      return true; // consumed; progress is advisory, no state change needed
    default:
      return false;
  }
}
