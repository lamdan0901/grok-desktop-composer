import { titleFromPrompt } from "@/lib/tabTitle";
import type { ChatMessage, Session } from "@/lib/types";

const PLACEHOLDER_TITLES = new Set([
  "new thread",
  "resumed thread",
  "new chat",
]);

export function isPlaceholderThreadTitle(title: string): boolean {
  return PLACEHOLDER_TITLES.has(title.trim().toLowerCase());
}

/** False when Grok already supplied a title for this thread. */
export function shouldFetchGrokSessionTitle(session: Session): boolean {
  if (!session.grokSessionId) return false;
  return session.grokTitleSynced !== true;
}

export function grokTitleSyncedFromSummary(summary: string): boolean {
  const trimmed = summary.trim();
  return trimmed.length > 0 && !isPlaceholderThreadTitle(trimmed);
}

export function firstUserMessageText(messages: ChatMessage[]): string | null {
  for (const message of messages) {
    if (message.role === "user") {
      const text = message.content.trim();
      if (text) return text;
      const count = message.attachments?.length ?? 0;
      if (count === 1) return "Image";
      if (count > 1) return `${count} images`;
    }
  }
  return null;
}

/** Derive a short label from the first user message in a transcript. */
export function titleFromMessages(messages: ChatMessage[]): string | null {
  const text = firstUserMessageText(messages);
  if (!text) return null;
  const title = titleFromPrompt(text);
  return isPlaceholderThreadTitle(title) ? null : title;
}

/** Title shown in sidebar and chat header (falls back to stored title). */
export function displayThreadTitle(session: Session): string {
  if (!isPlaceholderThreadTitle(session.title)) {
    return session.title;
  }
  return titleFromMessages(session.messages) ?? session.title;
}

/** Patch stored title when loading messages if the tab still has a placeholder name. */
export function inferredTitleFromMessages(
  session: Session,
  messages: ChatMessage[],
): Partial<Pick<Session, "title">> {
  if (!isPlaceholderThreadTitle(session.title)) {
    return {};
  }
  const title = titleFromMessages(messages);
  return title ? { title } : {};
}