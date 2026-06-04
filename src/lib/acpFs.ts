import { invoke } from "@tauri-apps/api/core";
import type {
  ReadTextFileRequest,
  WriteTextFileRequest,
} from "@agentclientprotocol/sdk";
import { getTabBoundCwd } from "@/lib/acp/tabSession";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";
import type { SessionId } from "@/lib/types";

/** Strip Windows extended-length prefix so Rust/Tauri paths resolve consistently. */
export function normalizeDiskPath(path: string): string {
  if (path.startsWith("\\\\?\\")) return path.slice(4);
  return path;
}

function resolveProjectCwd(acpSessionId: string, tabId: SessionId): string {
  const { sessions, projects } = useWorkspaceStore.getState();
  const byGrok = sessions.find((s) => s.grokSessionId === acpSessionId);
  if (byGrok) return getSessionCwd(byGrok, projects);
  const byTab = sessions.find((s) => s.id === tabId);
  return getSessionCwd(byTab, projects);
}

export function projectCwdForTab(tabId: SessionId): string {
  const bound = getTabBoundCwd(tabId);
  if (bound?.trim()) return bound;
  const { sessions, projects } = useWorkspaceStore.getState();
  const session = sessions.find((s) => s.id === tabId);
  return getSessionCwd(session, projects);
}

export async function writeProjectFile(
  tabId: SessionId,
  path: string,
  content: string,
): Promise<void> {
  const root = projectCwdForTab(tabId);
  if (!root.trim()) {
    throw new Error("No project directory for this session");
  }
  await invoke("write_text_file", {
    path: normalizeDiskPath(path),
    root,
    content,
  });
}

export async function readProjectFile(
  tabId: SessionId,
  path: string,
): Promise<string> {
  const root = projectCwdForTab(tabId);
  if (!root.trim()) {
    throw new Error("No project directory for this session");
  }
  return invoke<string>("read_text_file", {
    path: normalizeDiskPath(path),
    root,
    line: null,
    limit: null,
  });
}

export async function acpReadTextFile(
  tabId: SessionId,
  params: ReadTextFileRequest,
): Promise<string> {
  const root = resolveProjectCwd(params.sessionId, tabId);
  return invoke<string>("read_text_file", {
    path: normalizeDiskPath(params.path),
    root,
    line: params.line ?? null,
    limit: params.limit ?? null,
  });
}

export async function acpWriteTextFile(
  tabId: SessionId,
  params: WriteTextFileRequest,
): Promise<void> {
  const root = resolveProjectCwd(params.sessionId, tabId);
  return invoke("write_text_file", {
    path: normalizeDiskPath(params.path),
    root,
    content: params.content,
  });
}