import { invoke } from "@tauri-apps/api/core";

export interface CliReadyResult {
  ready: boolean;
  version: string | null;
  grokPath: string;
  authenticated: boolean;
  error: string | null;
}

export interface AuthCheckResult {
  authenticated: boolean;
  message: string | null;
}

export interface GrokModelsResult {
  defaultModel: string;
  models: string[];
}

export interface AcpLinePayload {
  tabId: string;
  line: string;
}

export interface TabErrorPayload {
  tabId: string;
  message: string;
}

export async function checkCliReady(): Promise<CliReadyResult> {
  return invoke<CliReadyResult>("check_cli_ready");
}

export async function grokVersion(): Promise<string> {
  return invoke<string>("grok_version");
}

export async function checkAuth(): Promise<AuthCheckResult> {
  return invoke<AuthCheckResult>("check_auth");
}

export async function listGrokModels(): Promise<GrokModelsResult> {
  return invoke<GrokModelsResult>("list_grok_models");
}

export async function runGrokLogin(oauth = true): Promise<void> {
  return invoke("run_grok_login", { oauth });
}

export async function runGrokLogout(): Promise<void> {
  return invoke("run_grok_logout");
}

export async function startTab(
  tabId: string,
  cwd?: string,
): Promise<void> {
  return invoke("start_tab", { tabId, cwd: cwd ?? null });
}

export async function stopTab(tabId: string): Promise<void> {
  return invoke("stop_tab", { tabId });
}

export async function restartTab(tabId: string): Promise<void> {
  return invoke("restart_tab", { tabId });
}

export async function acpWrite(tabId: string, line: string): Promise<void> {
  return invoke("acp_write", { tabId, line });
}

export async function listRunningTabs(): Promise<string[]> {
  return invoke<string[]>("list_running_tabs");
}

export interface PlanChangedPayload {
  tabId: string;
  path: string;
  content: string;
}

export async function resolvePlanPath(
  cwd: string,
  grokSessionId: string,
): Promise<string> {
  return invoke<string>("resolve_plan_path", { cwd, grokSessionId });
}

export async function readPlanFile(path: string): Promise<string> {
  return invoke<string>("read_plan_file", { path });
}

export async function watchPlanFile(
  tabId: string,
  path: string,
): Promise<void> {
  return invoke("watch_plan_file", { tabId, path });
}

export async function unwatchPlanFile(tabId: string): Promise<void> {
  return invoke("unwatch_plan_file", { tabId });
}

export type { GrokSessionEntry } from "./types";
export type { GrokSessionMeta } from "./sessions";
export {
  exportGrokSession,
  getGrokSessionMeta,
  getGrokSessionTitle,
  listGrokSessions,
  resolveGrokSessionCwd,
} from "./sessions";