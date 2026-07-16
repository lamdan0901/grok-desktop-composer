import type { SessionId } from "@/lib/types";
import { XAI } from "./xaiMethods";
import { ingestQueueSnapshot } from "@/stores/queueStore";
import { ingestTaskNotification } from "@/stores/taskStore";
import { markNotificationSeen } from "./featureDetection";

/**
 * Route a dedicated (non-generic) ext-notification to its store. Returns true
 * when consumed; false means the caller should fall through to the generic
 * session-update path (applySessionNotification).
 *
 * Dedicated methods carry a SessionNotification envelope:
 *   { sessionId, update: { sessionUpdate: "<tag>", ...fields }, _meta? }
 */
export function routeExtNotification(
  sessionId: SessionId,
  method: string,
  params: unknown,
): boolean {
  switch (method) {
    case XAI.queueChanged.method:
      markNotificationSeen(sessionId, method);
      ingestQueueSnapshot(sessionId, params);
      return true;
    case XAI.taskBackgrounded.method:
    case XAI.taskCompleted.method:
    case XAI.monitorEvent.method:
    case XAI.scheduledTaskCreated.method:
    case XAI.scheduledTaskFired.method:
    case XAI.scheduledTaskDeleted.method:
    case XAI.scheduledTaskInjectPrompt.method:
      markNotificationSeen(sessionId, method);
      ingestTaskNotification(sessionId, method, params as Record<string, unknown>);
      return true;
    default:
      return false;
  }
}
