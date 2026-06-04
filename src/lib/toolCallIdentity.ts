import type { ChatMessage } from "@/lib/types";

/** Grok may append channel-specific suffixes to the same logical tool call. */
export function canonicalToolCallId(toolCallId: string): string {
  return toolCallId.replace(/-composer_call_[A-Za-z0-9]+$/, "");
}

function pathsMatch(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
  const na = norm(a);
  const nb = norm(b);
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

/** Match tool rows when Grok reuses a call UUID with a new `-composer_call_*` suffix. */
export function findToolMessageIndex(
  messages: ChatMessage[],
  toolCallId: string,
  path?: string,
): number {
  const exact = messages.findIndex(
    (m) => m.role === "tool" && m.toolCallId === toolCallId,
  );
  if (exact >= 0) return exact;

  const base = canonicalToolCallId(toolCallId);
  const related = messages
    .map((m, index) => ({ m, index }))
    .filter(
      ({ m }) =>
        m.role === "tool" && canonicalToolCallId(m.toolCallId) === base,
    );

  if (related.length === 0) return -1;
  if (path) {
    const byPath = related.find(
      ({ m }) =>
        m.role === "tool" &&
        (pathsMatch(m.path, path) || pathsMatch(m.fileDiff?.file, path)),
    );
    if (byPath) return byPath.index;
    const awaitingPath = related.find(
      ({ m }) =>
        m.role === "tool" &&
        !m.path &&
        !m.fileDiff?.file &&
        (m.status === "running" || m.status === "pending"),
    );
    if (awaitingPath) return awaitingPath.index;
    return -1;
  }

  return related[related.length - 1]!.index;
}

/** Keep an existing row's id when updates arrive under a different channel suffix. */
export function resolveToolCallIdForUpsert(
  messages: ChatMessage[],
  toolCallId: string,
  path?: string,
): string {
  const idx = findToolMessageIndex(messages, toolCallId, path);
  if (idx < 0) return toolCallId;
  const existing = messages[idx];
  return existing?.role === "tool" ? existing.toolCallId : toolCallId;
}