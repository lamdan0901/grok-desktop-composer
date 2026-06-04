import type { SessionId } from "@/lib/types";

/** While set, ignore agent thought/message stream (e.g. during model switch reconnect). */
const suppressed = new Set<SessionId>();

/** While set, ignore all session/update transcript writes (silent loadSession attach). */
const silentAttach = new Set<SessionId>();

export function suppressAgentOutput(sessionId: SessionId): void {
  suppressed.add(sessionId);
}

export function releaseAgentOutput(sessionId: SessionId): void {
  suppressed.delete(sessionId);
}

export function isAgentOutputSuppressed(sessionId: SessionId): boolean {
  return suppressed.has(sessionId);
}

export function beginSilentSessionAttach(sessionId: SessionId): void {
  silentAttach.add(sessionId);
  suppressed.add(sessionId);
}

export function endSilentSessionAttach(sessionId: SessionId): void {
  silentAttach.delete(sessionId);
  suppressed.delete(sessionId);
}

export function isSilentSessionAttach(sessionId: SessionId): boolean {
  return silentAttach.has(sessionId);
}