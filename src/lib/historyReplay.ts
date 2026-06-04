import type { SessionId } from "@/lib/types";

const replaying = new Set<SessionId>();
const endTimers = new Map<SessionId, ReturnType<typeof setTimeout>>();

const END_DEBOUNCE_MS = 400;

export function isHistoryReplay(sessionId: SessionId): boolean {
  return replaying.has(sessionId);
}

export function beginHistoryReplay(sessionId: SessionId): void {
  replaying.add(sessionId);
  clearEndTimer(sessionId);
}

export function scheduleEndHistoryReplay(
  sessionId: SessionId,
  onEnd: () => void,
): void {
  clearEndTimer(sessionId);
  endTimers.set(
    sessionId,
    setTimeout(() => {
      endTimers.delete(sessionId);
      replaying.delete(sessionId);
      onEnd();
    }, END_DEBOUNCE_MS),
  );
}

/** Extend the replay window while history chunks are still arriving. */
export function touchHistoryReplay(
  sessionId: SessionId,
  onEnd: () => void,
): void {
  if (!replaying.has(sessionId)) return;
  scheduleEndHistoryReplay(sessionId, onEnd);
}

export function cancelHistoryReplay(sessionId: SessionId): void {
  replaying.delete(sessionId);
  clearEndTimer(sessionId);
}

function clearEndTimer(sessionId: SessionId): void {
  const timer = endTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    endTimers.delete(sessionId);
  }
}