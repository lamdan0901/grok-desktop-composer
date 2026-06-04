import { invoke } from "@tauri-apps/api/core";
import type { GrokSessionEntry } from "./types";

export interface GrokSessionMeta {
  title?: string | null;
  modelId?: string | null;
  agentName?: string | null;
  cwd?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  numChatMessages?: number | null;
  headBranch?: string | null;
}

export async function listGrokSessions(
  limit = 30,
  query?: string,
): Promise<GrokSessionEntry[]> {
  return invoke<GrokSessionEntry[]>("list_grok_sessions", {
    limit,
    query: query?.trim() || null,
  });
}

export async function resolveGrokSessionCwd(
  sessionId: string,
): Promise<string | null> {
  return invoke<string | null>("resolve_grok_session_cwd", { sessionId });
}

export async function grokSessionLastActiveMs(
  grokSessionId: string,
  cwd?: string,
): Promise<number | null> {
  return invoke<number | null>("grok_session_last_active_ms", {
    grokSessionId,
    cwd: cwd ?? null,
  });
}

export async function exportGrokSession(
  sessionId: string,
  outputPath: string,
): Promise<void> {
  return invoke("export_grok_session", { sessionId, outputPath });
}

export async function readGrokChatHistory(
  grokSessionId: string,
  cwd?: string,
): Promise<string | null> {
  return invoke<string | null>("read_grok_chat_history", {
    grokSessionId,
    cwd: cwd ?? null,
  });
}

export async function readGrokUpdatesJsonl(
  grokSessionId: string,
  cwd?: string,
): Promise<string | null> {
  return invoke<string | null>("read_grok_updates_jsonl", {
    grokSessionId,
    cwd: cwd ?? null,
  });
}

/** `generated_title` / `session_summary` from Grok's on-disk `summary.json`. */
export async function getGrokSessionTitle(
  grokSessionId: string,
  cwd?: string,
): Promise<string | null> {
  return invoke<string | null>("get_grok_session_title", {
    grokSessionId,
    cwd: cwd ?? null,
  });
}

export async function getGrokSessionMeta(
  grokSessionId: string,
  cwd?: string,
): Promise<GrokSessionMeta | null> {
  return invoke<GrokSessionMeta | null>("get_grok_session_meta", {
    grokSessionId,
    cwd: cwd ?? null,
  });
}