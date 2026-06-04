import { canonicalToolCallId } from "@/lib/toolCallIdentity";
import type { SessionId } from "@/lib/types";

const appliedBySession = new Map<SessionId, Set<string>>();

function appliedSet(sessionId: SessionId): Set<string> {
  let set = appliedBySession.get(sessionId);
  if (!set) {
    set = new Set();
    appliedBySession.set(sessionId, set);
  }
  return set;
}

function appliedKey(toolCallId: string): string {
  return canonicalToolCallId(toolCallId);
}

export function markComposerFileToolApplied(
  sessionId: SessionId,
  toolCallId: string,
): void {
  appliedSet(sessionId).add(appliedKey(toolCallId));
}

export function isComposerFileToolApplied(
  sessionId: SessionId,
  toolCallId: string,
): boolean {
  return appliedSet(sessionId).has(appliedKey(toolCallId));
}

export function clearComposerFileToolApplied(sessionId: SessionId): void {
  appliedBySession.delete(sessionId);
}