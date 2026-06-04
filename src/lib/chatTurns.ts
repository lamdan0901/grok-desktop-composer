import { normalizeStreamText } from "@/lib/acp/appendTextChunk";
import type { ChatMessage, SessionStatus } from "@/lib/types";

export type ChatTurn = {
  id: string;
  messages: ChatMessage[];
};

/** Split transcript into turns; each turn begins at a user message. */
export function splitMessagesIntoTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let current: ChatMessage[] = [];

  const flush = () => {
    if (current.length === 0) return;
    turns.push({ id: current[0]!.id, messages: current });
    current = [];
  };

  for (const message of messages) {
    if (message.role === "user" && current.length > 0) {
      flush();
    }
    current.push(message);
  }
  flush();
  return turns;
}

/** Main assistant reply text for a turn (excludes thought/tool/system/error). */
export function extractTurnAssistantRawText(messages: ChatMessage[]): string {
  const parts: string[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const text = normalizeStreamText(message.content);
    if (text.trim()) parts.push(text);
  }
  return parts.join("\n\n");
}

export function isTurnResponseStreaming(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) =>
      (m.role === "assistant" && m.streaming) ||
      (m.role === "thought" && m.streaming) ||
      (m.role === "tool" &&
        (m.status === "running" || m.status === "pending")),
  );
}

const ACTIVE_SESSION_STATUSES: ReadonlySet<SessionStatus> = new Set([
  "running",
  "awaiting_permission",
]);

/** True while this turn still has streaming content or the session agent is busy. */
export function isTurnAgentActive(
  messages: ChatMessage[],
  options?: { sessionStatus?: SessionStatus },
): boolean {
  if (isTurnResponseStreaming(messages)) return true;
  const status = options?.sessionStatus;
  return status != null && ACTIVE_SESSION_STATUSES.has(status);
}