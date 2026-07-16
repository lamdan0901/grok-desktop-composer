import { getTabSession } from "@/lib/acp";
import { callRequestFeature } from "./featureDetection";
import { XAI } from "./xaiMethods";

export type SkillEntry = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  source?: string;
  path?: string;
};

export type HookEntry = {
  id: string;
  name: string;
  event?: string;
  enabled: boolean;
  source?: string;
  trusted: boolean;
};

function grokSessionId(tabId: string): string {
  const value = getTabSession(tabId).grokSessionId;
  if (!value) throw new Error("No grok session bound to this tab");
  return value;
}

function records(value: unknown, key: string): Record<string, unknown>[] {
  const rows = value && typeof value === "object" && Array.isArray((value as Record<string, unknown>)[key])
    ? (value as Record<string, unknown[]>)[key]
    : [];
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
}

export function normalizeSkills(value: unknown): SkillEntry[] {
  return records(value, "skills").flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    if (!id) return [];
    return [{
      id,
      name: typeof row.name === "string" ? row.name : id,
      description: typeof row.description === "string" ? row.description : undefined,
      enabled: row.enabled !== false,
      source: typeof row.source === "string" ? row.source : undefined,
      path: typeof row.path === "string" ? row.path : undefined,
    }];
  });
}

export function normalizeHooks(value: unknown): HookEntry[] {
  return records(value, "hooks").flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : typeof row.name === "string" ? row.name : "";
    if (!id) return [];
    return [{
      id,
      name: typeof row.name === "string" ? row.name : id,
      event: typeof row.event === "string" ? row.event : undefined,
      enabled: row.enabled !== false,
      source: typeof row.source === "string" ? row.source : undefined,
      trusted: row.trusted === true,
    }];
  });
}

export async function listSkills(tabId: string): Promise<SkillEntry[] | null> {
  const result = await callRequestFeature(tabId, XAI.skillsList, () =>
    getTabSession(tabId).extMethod(XAI.skillsList.method, { sessionId: grokSessionId(tabId) }),
  );
  return result.supported ? normalizeSkills(result.value) : null;
}

export async function setSkillEnabled(tabId: string, skillId: string, enabled: boolean): Promise<boolean> {
  const entry = enabled ? XAI.skillsEnable : XAI.skillsDisable;
  const result = await callRequestFeature(tabId, entry, () =>
    getTabSession(tabId).extMethod(entry.method, { session_id: grokSessionId(tabId), skill_id: skillId }),
  );
  return result.supported;
}

export async function refreshSkills(tabId: string): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.skillsRefresh, () =>
    getTabSession(tabId).extMethod(XAI.skillsRefresh.method, { sessionId: grokSessionId(tabId) }),
  );
  return result.supported;
}

export async function listHooks(tabId: string): Promise<HookEntry[] | null> {
  const result = await callRequestFeature(tabId, XAI.hooksList, () =>
    getTabSession(tabId).extMethod(XAI.hooksList.method, { sessionId: grokSessionId(tabId) }),
  );
  return result.supported ? normalizeHooks(result.value) : null;
}

export async function runHookAction(tabId: string, hookId: string, action: string): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.hooksAction, () =>
    getTabSession(tabId).extMethod(XAI.hooksAction.method, {
      session_id: grokSessionId(tabId),
      hook_id: hookId,
      action,
    }),
  );
  return result.supported;
}
