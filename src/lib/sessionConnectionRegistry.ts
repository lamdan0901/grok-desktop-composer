/** Tracks live ACP agent processes (after the user sends a message). */
const connectedKeys = new Set<string>();

export function sessionConnectionKey(
  sessionId: string,
  cwd: string,
  grokSessionId?: string,
): string {
  return `${sessionId}:${cwd}:${grokSessionId ?? "new"}`;
}

const inFlight = new Set<string>();

export function tryBeginSessionConnect(sessionId: string): boolean {
  if (inFlight.has(sessionId)) return false;
  inFlight.add(sessionId);
  return true;
}

export function endSessionConnect(sessionId: string): void {
  inFlight.delete(sessionId);
}

export function isSessionConnectionTracked(key: string): boolean {
  return connectedKeys.has(key);
}

export function markSessionConnectionTracked(key: string): void {
  connectedKeys.add(key);
}

export function unmarkSessionConnectionTracked(key: string): void {
  connectedKeys.delete(key);
}

/** Drop all connection keys for a thread so hooks can reconnect after restart. */
export function clearSessionConnectionKeys(sessionId: string): void {
  for (const key of [...connectedKeys]) {
    if (key.startsWith(`${sessionId}:`)) {
      connectedKeys.delete(key);
    }
  }
}

export function pruneStaleSessionConnectionKeys(activeKeys: Set<string>): void {
  for (const key of [...connectedKeys]) {
    if (!activeKeys.has(key)) {
      connectedKeys.delete(key);
    }
  }
}