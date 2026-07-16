import type {
  Client,
  ReadTextFileRequest,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionNotification,
  WriteTextFileRequest,
} from "@agentclientprotocol/sdk";
import { acpReadTextFile, acpWriteTextFile } from "@/lib/acpFs";
import type { SessionId } from "@/lib/types";
import { isPlanPermissionRequest } from "@/lib/plan";
import { pickAutoApproveOption } from "@/lib/permission";
import { GROK_EXTENSION_NOTIFY_METHODS } from "@/lib/sessionUpdateDedupe";
import { applySessionNotification } from "./sessionUpdates";
import { handleReverseExtMethod } from "./reverseExtMethod";
import { routeExtNotification } from "./extNotificationRouter";
import { usePermissionStore } from "@/stores/permissionStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function createClientHandler(sessionId: SessionId): Client {
  const store = () => useWorkspaceStore.getState();

  return {
    async sessionUpdate(params: SessionNotification) {
      applySessionNotification(sessionId, params, "session/update");
    },

    async extNotification(method, params) {
      if (routeExtNotification(sessionId, method, params)) return;
      if (!GROK_EXTENSION_NOTIFY_METHODS.has(method)) return;
      applySessionNotification(sessionId, params, method);
    },

    async extMethod(method, params) {
      return (await handleReverseExtMethod(
        sessionId,
        method,
        params,
      )) as Record<string, unknown>;
    },

    async requestPermission(
      params: RequestPermissionRequest,
    ): Promise<RequestPermissionResponse> {
      const { settings } = useSettingsStore.getState();

      if (settings.alwaysApprove) {
        const allow = pickAutoApproveOption(params.options);
        if (allow) {
          return {
            outcome: {
              outcome: "selected",
              optionId: allow.optionId,
            },
          };
        }
      }

      if (isPlanPermissionRequest(params)) {
        store().setSessionStatus(sessionId, "plan_review");
      } else {
        store().setSessionStatus(sessionId, "awaiting_permission");
      }

      try {
        return await usePermissionStore
          .getState()
          .waitForDecision(sessionId, params);
      } finally {
        const session = store().sessions.find((s) => s.id === sessionId);
        if (session?.status === "awaiting_permission") {
          store().setSessionStatus(sessionId, "running");
        }
      }
    },

    async readTextFile(params: ReadTextFileRequest) {
      const content = await acpReadTextFile(sessionId, params);
      return { content };
    },

    async writeTextFile(params: WriteTextFileRequest) {
      await acpWriteTextFile(sessionId, params);
      return {};
    },
  };
}