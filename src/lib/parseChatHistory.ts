import { markTurnActivityCollapsed } from "./groupTurnActivity";
import type { ChatMessage } from "./types";

type HistoryLine = Record<string, unknown>;

function newId(): string {
  return crypto.randomUUID();
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") return b.text;
      return "";
    })
    .join("");
}

function extractUserQuery(text: string): string | null {
  const match = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  if (match?.[1]) return match[1].trim();
  if (
    text.includes("<user_info>") ||
    text.includes("<agent_skills>") ||
    text.includes("<rules>")
  ) {
    return null;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function reasoningText(line: HistoryLine): string {
  const summary = line.summary;
  if (!Array.isArray(summary)) return "";
  return summary
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const s = item as Record<string, unknown>;
      if (s.type === "summary_text" && typeof s.text === "string") {
        return s.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function pathFromToolArgs(argsRaw: unknown): string | undefined {
  if (typeof argsRaw !== "string" || !argsRaw.trim()) return undefined;
  try {
    const args = JSON.parse(argsRaw) as Record<string, unknown>;
    const path =
      (typeof args.path === "string" && args.path) ||
      (typeof args.file_path === "string" && args.file_path) ||
      (typeof args.target_directory === "string" && args.target_directory) ||
      undefined;
    return path;
  } catch {
    return undefined;
  }
}

interface PendingTool {
  messageIndex: number;
}

/**
 * Parse Grok `chat_history.jsonl` into transcript messages for the UI.
 */
export function parseChatHistoryJsonl(raw: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const pendingTools = new Map<string, PendingTool>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: HistoryLine;
    try {
      entry = JSON.parse(trimmed) as HistoryLine;
    } catch {
      continue;
    }

    const type = entry.type;
    if (type === "system") continue;

    if (type === "user") {
      const query = extractUserQuery(textContent(entry.content));
      if (!query) continue;
      messages.push({ id: newId(), role: "user", content: query });
      continue;
    }

    if (type === "reasoning") {
      const content = reasoningText(entry);
      if (!content.trim()) continue;
      messages.push({
        id: newId(),
        role: "thought",
        content,
        streaming: false,
      });
      continue;
    }

    if (type === "assistant") {
      const toolCalls = entry.tool_calls;
      if (Array.isArray(toolCalls)) {
        for (const call of toolCalls) {
          if (!call || typeof call !== "object") continue;
          const tc = call as Record<string, unknown>;
          const toolCallId =
            (typeof tc.id === "string" && tc.id) || newId();
          const title =
            (typeof tc.name === "string" && tc.name) || "Tool";
          const path = pathFromToolArgs(tc.arguments);
          messages.push({
            id: newId(),
            role: "tool",
            toolCallId,
            title,
            path,
            status: "running",
          });
          pendingTools.set(toolCallId, {
            messageIndex: messages.length - 1,
          });
        }
      }

      const content =
        typeof entry.content === "string" ? entry.content.trim() : "";
      if (content.length > 0) {
        messages.push({
          id: newId(),
          role: "assistant",
          content,
          streaming: false,
        });
      }
      continue;
    }

    if (type === "tool_result") {
      const toolCallId =
        typeof entry.tool_call_id === "string" ? entry.tool_call_id : "";
      if (!toolCallId) continue;
      const pending = pendingTools.get(toolCallId);
      if (pending != null) {
        const existing = messages[pending.messageIndex];
        if (existing?.role === "tool") {
          messages[pending.messageIndex] = {
            ...existing,
            status: "completed",
          };
        }
        pendingTools.delete(toolCallId);
      } else {
        messages.push({
          id: newId(),
          role: "tool",
          toolCallId,
          title: "Tool",
          status: "completed",
        });
      }
    }
  }

  for (const [, pending] of pendingTools) {
    const existing = messages[pending.messageIndex];
    if (existing?.role === "tool" && existing.status === "running") {
      messages[pending.messageIndex] = { ...existing, status: "completed" };
    }
  }

  return markTurnActivityCollapsed(messages);
}