import { getTabSession } from "@/lib/acp";
import { XAI } from "./xaiMethods";

function grokSid(tabId: string): string {
  const sid = getTabSession(tabId).grokSessionId;
  if (!sid) throw new Error("No grok session bound to this tab");
  return sid;
}

export async function getSubagent(tabId: string, subagentId: string): Promise<unknown> {
  const res = (await getTabSession(tabId).extMethod(XAI.subagentGet.method, {
    subagentId,
  })) as { snapshot: unknown };
  return res.snapshot;
}

export async function listRunningSubagents(tabId: string): Promise<unknown[]> {
  const res = (await getTabSession(tabId).extMethod(XAI.subagentListRunning.method, {
    sessionId: grokSid(tabId),
  })) as { subagents: unknown[] };
  return res.subagents ?? [];
}

export async function cancelSubagent(tabId: string, subagentId: string): Promise<void> {
  await getTabSession(tabId).extMethod(XAI.subagentCancel.method, { subagentId });
}
