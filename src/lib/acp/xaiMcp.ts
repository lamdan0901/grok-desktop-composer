import { getTabSession } from "@/lib/acp";
import { XAI } from "./xaiMethods";
import { callRequestFeature } from "./featureDetection";
import { useMcpStore, type McpServerEntry } from "@/stores/mcpStore";

function grokSid(tabId: string): string {
  const sid = getTabSession(tabId).grokSessionId;
  if (!sid) throw new Error("No grok session bound to this tab");
  return sid;
}

/** List MCP servers scoped to this tab's session and refresh the read-cache. */
export async function listMcpServers(tabId: string): Promise<McpServerEntry[] | null> {
  const result = await callRequestFeature(tabId, XAI.mcpList, () =>
    getTabSession(tabId).extMethod(XAI.mcpList.method, { sessionId: grokSid(tabId) }),
  );
  if (!result.supported) return null;
  const res = result.value as { servers: McpServerEntry[] };
  const servers = res.servers ?? [];
  useMcpStore.getState().setServers(tabId, servers);
  return servers;
}

/** Config for a stdio or http server (flattened onto the request per grok's wire). */
export type McpServerConfigInput =
  | { type: "stdio"; command: string; args?: string[]; env?: { name: string; value: string }[] }
  | { type: "http"; url: string };

export async function upsertMcpServer(
  tabId: string,
  serverName: string,
  config: McpServerConfigInput,
): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.mcpUpsert, () =>
    getTabSession(tabId).extMethod(XAI.mcpUpsert.method, {
      session_id: grokSid(tabId),
      server_name: serverName,
      ...config,
    }),
  );
  if (!result.supported) return false;
  await listMcpServers(tabId);
  return true;
}

export async function toggleMcpServer(
  tabId: string,
  serverName: string,
  enabled: boolean,
): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.mcpToggle, () =>
    getTabSession(tabId).extMethod(XAI.mcpToggle.method, {
      session_id: grokSid(tabId),
      server_name: serverName,
      enabled,
    }),
  );
  if (!result.supported) return false;
  await listMcpServers(tabId);
  return true;
}

export async function toggleMcpTool(
  tabId: string,
  serverName: string,
  toolName: string,
  enabled: boolean,
): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.mcpToggleTool, () =>
    getTabSession(tabId).extMethod(XAI.mcpToggleTool.method, {
      session_id: grokSid(tabId),
      server_name: serverName,
      tool_name: toolName,
      enabled,
    }),
  );
  if (!result.supported) return false;
  await listMcpServers(tabId);
  return true;
}

export async function deleteMcpServer(tabId: string, serverName: string): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.mcpDelete, () =>
    getTabSession(tabId).extMethod(XAI.mcpDelete.method, {
      session_id: grokSid(tabId),
      server_name: serverName,
    }),
  );
  if (!result.supported) return false;
  await listMcpServers(tabId);
  return true;
}

export async function triggerMcpAuth(
  tabId: string,
  serverName: string,
): Promise<{ status: string; error?: string } | null> {
  const result = await callRequestFeature(tabId, XAI.mcpAuthTrigger, () =>
    getTabSession(tabId).extMethod(XAI.mcpAuthTrigger.method, {
      session_id: grokSid(tabId),
      server_name: serverName,
    }),
  );
  if (!result.supported) return null;
  const res = result.value as { status: string; error?: string };
  await listMcpServers(tabId);
  return res;
}
