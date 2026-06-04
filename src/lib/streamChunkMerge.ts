import remend from "remend";
import { appendAcpTextChunk, normalizeStreamText } from "@/lib/acp/appendTextChunk";
import type { ChatMessage } from "@/lib/types";

/** Merge streamed ACP text chunks (spec: concatenate; see `appendAcpTextChunk`). */
export function mergeStreamChunk(existing: string, chunk: string): string {
  return appendAcpTextChunk(existing, chunk);
}

/**
 * Prepare assistant markdown for display.
 * While streaming, heal incomplete markdown like OpenCode (`remend` in `markdown-stream.ts`).
 */
export function formatAssistantDisplayText(
  text: string,
  streaming = false,
): string {
  const normalized = normalizeStreamText(text);
  if (!streaming) return normalized;
  return remend(normalized, { linkMode: "text-only" });
}

/** One-word assistant bubble from a mistaken per-chunk UI split. */
export function isAssistantStreamFragment(content: string): boolean {
  const text = normalizeStreamText(content).trim();
  if (!text || text.length > 80) return false;
  if (text.includes("\n")) return false;
  return !/\s/.test(text);
}

/**
 * Merge consecutive assistant bubbles that are single-token stream fragments.
 */
export function coalesceAssistantStreamFragments(
  messages: ChatMessage[],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  let fragmentRun: ChatMessage | null = null;

  const flushRun = () => {
    if (fragmentRun) {
      out.push(fragmentRun);
      fragmentRun = null;
    }
  };

  for (const message of messages) {
    if (message.role !== "assistant") {
      flushRun();
      out.push(message);
      continue;
    }

    if (!isAssistantStreamFragment(message.content)) {
      flushRun();
      out.push(message);
      continue;
    }

    if (!fragmentRun) {
      fragmentRun = { ...message };
      continue;
    }

    fragmentRun = {
      ...fragmentRun,
      content: mergeStreamChunk(fragmentRun.content, message.content),
      streaming: message.streaming || fragmentRun.streaming,
    };
  }

  flushRun();
  return out;
}