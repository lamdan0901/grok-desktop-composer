import { invoke } from "@tauri-apps/api/core";

export const GROK_SUBSCRIPTION_USAGE_URL = "https://grok.com/?_s=usage";
export const CONTEXT_COMPACT_THRESHOLD_PCT = 85;

export interface SessionSignals {
  turnCount: number;
  userMessageCount: number;
  toolCallCount: number;
  contextWindowUsage: number;
  contextTokensUsed: number;
  contextWindowTokens: number;
  compactionCount: number;
  sessionDurationSeconds: number;
  primaryModelId: string | null;
  modelsUsed: string[];
  toolsUsed: string[];
  errorCount: number;
}

export interface SignalsChangedPayload {
  tabId: string;
  signals: SessionSignals;
}

export async function resolveSignalsPath(
  cwd: string,
  grokSessionId: string,
): Promise<string | null> {
  return invoke<string | null>("resolve_signals_path", { cwd, grokSessionId });
}

export async function resolveSignalsPathById(
  grokSessionId: string,
): Promise<string | null> {
  return invoke<string | null>("resolve_signals_path_by_id", { grokSessionId });
}

export async function readSessionSignals(
  cwd: string,
  grokSessionId: string,
): Promise<SessionSignals> {
  return invoke<SessionSignals>("read_session_signals", { cwd, grokSessionId });
}

export async function readSessionSignalsAtPath(
  path: string,
): Promise<SessionSignals> {
  return invoke<SessionSignals>("read_session_signals_at_path", { path });
}

export async function watchSessionSignals(
  tabId: string,
  path: string,
): Promise<void> {
  return invoke("watch_session_signals", { tabId, path });
}

/** Watch `signals.json` and `summary.json` for live usage + title updates. */
export async function watchGrokSession(
  tabId: string,
  cwd: string,
  grokSessionId: string,
): Promise<void> {
  return invoke("watch_grok_session", { tabId, cwd, grokSessionId });
}

export async function unwatchSessionSignals(tabId: string): Promise<void> {
  return invoke("unwatch_session_signals", { tabId });
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}k`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatIsoTimestamp(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export type ContextUsageLevel = "normal" | "warn" | "critical";

const CONTEXT_WARN_THRESHOLD_PCT = 70;

export function contextUsageLevel(usagePct: number): ContextUsageLevel {
  if (usagePct >= CONTEXT_COMPACT_THRESHOLD_PCT) return "critical";
  if (usagePct >= CONTEXT_WARN_THRESHOLD_PCT) return "warn";
  return "normal";
}

/** True when signals carry enough context fields to show the usage bar. */
export function hasContextUsageData(
  signals: SessionSignals | null | undefined,
): boolean {
  if (!signals) return false;
  return (
    signals.contextWindowTokens > 0 ||
    signals.contextTokensUsed > 0 ||
    signals.contextWindowUsage > 0
  );
}

/** Ignore transient empty reads while signals.json is being rewritten. */
export function shouldAcceptSignalsUpdate(
  prev: SessionSignals | undefined,
  next: SessionSignals,
): boolean {
  if (!prev) return true;
  if (
    hasContextUsageData(prev) &&
    !hasContextUsageData(next) &&
    next.turnCount <= prev.turnCount
  ) {
    return false;
  }
  return true;
}

export function contextBarClass(usagePct: number): string {
  const level = contextUsageLevel(usagePct);
  if (level === "critical") return "usage-bar__fill--critical";
  if (level === "warn") return "usage-bar__fill--warn";
  return "";
}