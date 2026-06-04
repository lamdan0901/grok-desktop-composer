import type { SessionId } from "@/lib/types";
import { canonicalToolCallId } from "@/lib/toolCallIdentity";

/** Extension methods only — standard `session/update` is handled by `sessionUpdate`. */
export const GROK_EXTENSION_NOTIFY_METHODS = new Set([
  "x.ai/session/update",
  "x.ai/session_notification",
  "_x.ai/session_notification",
]);

const recentBySession = new Map<SessionId, Map<string, number>>();
const MAX_KEYS_PER_SESSION = 512;
const KEY_TTL_MS = 120_000;

function pruneSession(sessionId: SessionId, keys: Map<string, number>): void {
  const now = Date.now();
  for (const [key, at] of keys) {
    if (now - at > KEY_TTL_MS) keys.delete(key);
  }
  while (keys.size > MAX_KEYS_PER_SESSION) {
    const first = keys.keys().next().value;
    if (first === undefined) break;
    keys.delete(first);
  }
  if (keys.size === 0) recentBySession.delete(sessionId);
}

function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function textFromContentBlock(content: unknown): string | null {
  if (!content || typeof content !== "object") return null;
  const block = content as Record<string, unknown>;
  if (block.type === "text" && typeof block.text === "string") {
    return block.text;
  }
  return null;
}

function chunkTextKey(kind: string, text: string): string {
  return `${kind}:text:${hashText(text)}`;
}

function streamChunkText(
  params: Record<string, unknown>,
): { kind: string; text: string } | null {
  const update = params.update;
  if (!update || typeof update !== "object") return null;

  const u = update as Record<string, unknown>;
  const kind = u.sessionUpdate;
  if (kind !== "agent_message_chunk" && kind !== "agent_thought_chunk") {
    return null;
  }

  const text = textFromContentBlock(u.content);
  if (!text) return null;
  return { kind: String(kind), text };
}

function buildDedupeKey(
  params: Record<string, unknown>,
  method?: string,
): string | null {
  const meta = params._meta as Record<string, unknown> | undefined;
  if (typeof meta?.eventId === "string" && meta.eventId.length > 0) {
    return `event:${meta.eventId}`;
  }

  const update = params.update;
  if (!update || typeof update !== "object") {
    return method ? `method:${method}` : null;
  }

  const u = update as Record<string, unknown>;
  const kind = u.sessionUpdate;
  if (typeof kind !== "string") return null;

  const chunkId = meta?.chunkId ?? meta?.chunk_id;
  if (chunkId != null) {
    return `${kind}:chunk:${String(chunkId)}`;
  }

  if (kind === "agent_message_chunk" || kind === "agent_thought_chunk") {
    const text = textFromContentBlock(u.content);
    if (text) return chunkTextKey(kind, text);
  }

  if (kind === "tool_call" || kind === "tool_call_update") {
    const toolCallId = u.toolCallId ?? u.tool_call_id;
    if (toolCallId) {
      const status = String(u.status ?? "");
      const payload = hashText(
        JSON.stringify({
          title: u.title,
          kind: u.kind,
          content: u.content,
          rawInput: u.rawInput,
          locations: u.locations,
        }),
      );
      return `${kind}:${canonicalToolCallId(String(toolCallId))}:${status}:${payload}`;
    }
  }

  if (method) return `${kind}:${method}`;
  return `${kind}:${hashText(JSON.stringify(u))}`;
}

/**
 * Drop a notification we already applied (e.g. Grok standard + extension duplicate).
 */
export function shouldSkipDuplicateSessionNotification(
  sessionId: SessionId,
  params: Record<string, unknown>,
  method?: string,
): boolean {
  const key = buildDedupeKey(params, method);
  const chunkText = streamChunkText(params);
  if (!key && !chunkText) return false;

  let keys = recentBySession.get(sessionId);
  if (!keys) {
    keys = new Map();
    recentBySession.set(sessionId, keys);
  }

  pruneSession(sessionId, keys);

  if (key && keys.has(key)) return true;
  if (chunkText && keys.has(chunkTextKey(chunkText.kind, chunkText.text))) {
    return true;
  }

  if (key) keys.set(key, Date.now());
  if (chunkText) {
    keys.set(chunkTextKey(chunkText.kind, chunkText.text), Date.now());
  }
  return false;
}

export function clearSessionNotificationDedupe(sessionId: SessionId): void {
  recentBySession.delete(sessionId);
}