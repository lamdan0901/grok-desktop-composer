import { getTabSession } from "@/lib/acp";
import {
  callRequestFeature,
  isNotificationFeatureSeen,
} from "./featureDetection";
import { XAI } from "./xaiMethods";

function grokSessionId(tabId: string): string {
  const id = getTabSession(tabId).grokSessionId;
  if (!id) throw new Error("No grok session bound to this tab");
  return id;
}

async function notifyQueue(
  tabId: string,
  method: string,
  params: Record<string, unknown>,
): Promise<boolean> {
  if (!isNotificationFeatureSeen(tabId, XAI.queueChanged.method)) return false;
  await getTabSession(tabId).extNotification(method, params);
  return true;
}

export function removeQueuedPrompt(tabId: string, queueId: string): Promise<boolean> {
  return notifyQueue(tabId, XAI.queueRemove.method, { queueId });
}

export function reorderQueuedPrompt(
  tabId: string,
  queueId: string,
  position: number,
): Promise<boolean> {
  return notifyQueue(tabId, XAI.queueReorder.method, { queueId, position });
}

export function clearQueuedPrompts(tabId: string): Promise<boolean> {
  return notifyQueue(tabId, XAI.queueClear.method, {
    sessionId: grokSessionId(tabId),
  });
}

export function promoteQueuedPrompt(tabId: string, queueId: string): Promise<boolean> {
  return notifyQueue(tabId, XAI.queueInterject.method, { queueId });
}

export async function interjectActiveTurn(
  tabId: string,
  text: string,
): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.interject, () =>
    getTabSession(tabId).extMethod(XAI.interject.method, {
      sessionId: grokSessionId(tabId),
      text,
    }),
  );
  return result.supported;
}
