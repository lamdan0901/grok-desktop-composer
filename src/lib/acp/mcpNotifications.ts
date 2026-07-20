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
        const status = params.status as McpServerStatus | undefined;
        useMcpStore.getState().applyServerStatus(tabId, {
          name,
          status,
        });
        useMcpStore.getState().applyInitializationServerStatus(tabId, name, status);
      }
      return true;
    }
    case XAI.mcpToolsChanged.method:
      markNotificationSeen(tabId, method);
      // Uniform "refetch" trigger — re-read the full catalog (best-effort).
      listMcpServers(tabId).catch(() => undefined);
      return true;
    case XAI.mcpInitProgress.method: {
      markNotificationSeen(tabId, method);
      const { total, connected } = params;
      if (
        typeof total === "number" &&
        Number.isSafeInteger(total) &&
        total >= 0 &&
        typeof connected === "number" &&
        Number.isSafeInteger(connected) &&
        connected >= 0
      ) {
        useMcpStore.getState().setInitializationProgress(tabId, total, connected);
      }
      return true;
    }
    case XAI.mcpInitialized.method:
      markNotificationSeen(tabId, method);
      useMcpStore.getState().completeInitialization(tabId);
      return true;
    default:
      return false;
  }
}
