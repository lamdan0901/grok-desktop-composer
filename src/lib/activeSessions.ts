import { invoke } from "@tauri-apps/api/core";
import type { ActiveGrokSession, Session } from "@/lib/types";

export interface ActiveSessionsChangedPayload {
  sessions: ActiveGrokSession[];
}

export async function readActiveGrokSessions(): Promise<ActiveGrokSession[]> {
  return invoke<ActiveGrokSession[]>("read_active_grok_sessions");
}

export async function startActiveSessionsWatch(): Promise<void> {
  return invoke("start_active_sessions_watch");
}

/** Grok session IDs this app currently drives via ACP. */
export function getOwnedGrokSessionIds(sessions: Session[]): Set<string> {
  const owned = new Set<string>();
  for (const session of sessions) {
    const grokId = session.grokSessionId;
    if (!grokId) continue;
    const acpLive =
      session.acpState === "ready" || session.acpState === "connecting";
    const turnRunning = session.status === "running";
    if (acpLive || turnRunning) {
      owned.add(grokId);
    }
  }
  return owned;
}

export function getExternallyActiveGrokSessionIds(
  activeSessions: ActiveGrokSession[],
  owned: Set<string>,
): Set<string> {
  const external = new Set<string>();
  for (const entry of activeSessions) {
    if (!owned.has(entry.sessionId)) {
      external.add(entry.sessionId);
    }
  }
  return external;
}

export function isGrokSessionExternallyActive(
  grokSessionId: string | undefined,
  activeSessions: ActiveGrokSession[],
  owned: Set<string>,
): boolean {
  if (!grokSessionId) return false;
  return getExternallyActiveGrokSessionIds(activeSessions, owned).has(
    grokSessionId,
  );
}