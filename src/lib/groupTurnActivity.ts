import { isTodoToolTitle } from "@/lib/todos";
import type { ChatMessage } from "@/lib/types";

export type DisplayListItem =
  | { kind: "message"; message: ChatMessage }
  | {
      kind: "activity";
      id: string;
      items: Array<Extract<ChatMessage, { role: "thought" | "tool" }>>;
    };

function isActivityMessage(
  message: ChatMessage,
): message is Extract<ChatMessage, { role: "thought" | "tool" }> {
  if (message.role === "thought") return true;
  if (message.role === "tool") {
    return !isTodoToolTitle(message.title);
  }
  return false;
}

export function groupMessagesForDisplay(messages: ChatMessage[]): DisplayListItem[] {
  const items: DisplayListItem[] = [];
  let activityRun: Extract<ChatMessage, { role: "thought" | "tool" }>[] = [];

  const flushActivity = () => {
    if (activityRun.length === 0) return;
    items.push({
      kind: "activity",
      id: activityRun[0]!.id,
      items: activityRun,
    });
    activityRun = [];
  };

  for (const message of messages) {
    if (isActivityMessage(message)) {
      activityRun.push(message);
      continue;
    }
    flushActivity();
    items.push({ kind: "message", message });
  }

  flushActivity();
  return items;
}

export function isActivityLive(
  items: Array<Extract<ChatMessage, { role: "thought" | "tool" }>>,
): boolean {
  return items.some(
    (m) =>
      (m.role === "thought" && m.streaming) ||
      (m.role === "tool" &&
        (m.status === "running" || m.status === "pending")),
  );
}

export function isActivityTurnCollapsed(
  items: Array<Extract<ChatMessage, { role: "thought" | "tool" }>>,
): boolean {
  return items.length > 0 && items.every((m) => m.turnCollapsed === true);
}

/** Index of the last user message, or -1 when the transcript has none yet. */
export function findLastUserMessageIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return i;
  }
  return -1;
}

/** Collapse completed thought/tool rows in the current turn only (after last user). */
export function collapseCurrentTurnActivity(
  messages: ChatMessage[],
): ChatMessage[] {
  const turnStart = findLastUserMessageIndex(messages);
  return messages.map((m, i) => {
    if (i <= turnStart) return m;
    if (m.role !== "thought" && m.role !== "tool") return m;
    if (m.role === "thought" && m.streaming) return m;
    if (
      m.role === "tool" &&
      (m.status === "running" || m.status === "pending")
    ) {
      return m;
    }
    return { ...m, turnCollapsed: true };
  });
}

/** Mark completed thought/tool rows collapsed (e.g. restored transcripts). */
export function markTurnActivityCollapsed(
  messages: ChatMessage[],
): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "thought" && m.role !== "tool") return m;
    if (m.role === "thought" && m.streaming) return m;
    if (
      m.role === "tool" &&
      (m.status === "running" || m.status === "pending")
    ) {
      return m;
    }
    return { ...m, turnCollapsed: true };
  });
}

export function activitySectionLabel(
  items: Array<Extract<ChatMessage, { role: "thought" | "tool" }>>,
  live: boolean,
): string {
  if (live) return "Working…";

  let thoughts = 0;
  let tools = 0;
  for (const m of items) {
    if (m.role === "thought") thoughts += 1;
    else tools += 1;
  }

  const parts: string[] = [];
  if (thoughts > 0) {
    parts.push(`${thoughts} thought${thoughts === 1 ? "" : "s"}`);
  }
  if (tools > 0) {
    parts.push(`${tools} command${tools === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Activity";
}