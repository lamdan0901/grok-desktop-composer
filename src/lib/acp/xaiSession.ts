import { getTabSession } from "@/lib/acp";
import { callRequestFeature } from "./featureDetection";
import { XAI } from "./xaiMethods";

type Call = (method: string, params: Record<string, unknown>) => Promise<unknown>;
export interface ForkedSession {
  sessionId: string;
  cwd?: string;
  title?: string;
}

const callFor = (tabId: string): Call =>
  (method, params) => getTabSession(tabId).extMethod(method, params);

async function requestBoolean(
  tabId: string,
  entry: typeof XAI.sessionRename | typeof XAI.sessionDelete,
  call: Call,
  params: Record<string, unknown>,
): Promise<boolean> {
  const result = await callRequestFeature(tabId, entry, () =>
    call(entry.method, params),
  );
  return result.supported;
}

export async function renameSession(
  tabId: string,
  sessionId: string,
  title: string,
  call: Call = callFor(tabId),
): Promise<boolean> {
  return requestBoolean(tabId, XAI.sessionRename, call, { sessionId, title });
}

export async function deleteSession(
  tabId: string,
  sessionId: string,
  call: Call = callFor(tabId),
): Promise<boolean> {
  return requestBoolean(tabId, XAI.sessionDelete, call, { sessionId });
}

export async function forkSession(
  tabId: string,
  sessionId: string,
  call: Call = callFor(tabId),
): Promise<ForkedSession | null> {
  const result = await callRequestFeature(tabId, XAI.sessionFork, () =>
    call(XAI.sessionFork.method, { sessionId }),
  );
  if (!result.supported) return null;
  if (!result.value || typeof result.value !== "object") {
    throw new Error("Grok returned an invalid forked session");
  }
  const value = result.value as Record<string, unknown>;
  const childId =
    typeof value.sessionId === "string"
      ? value.sessionId
      : typeof value.id === "string"
        ? value.id
        : "";
  if (!childId) throw new Error("Grok returned a fork without a session id");
  return {
    sessionId: childId,
    cwd: typeof value.cwd === "string" ? value.cwd : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
  };
}
