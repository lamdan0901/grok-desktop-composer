import type { ToolCall, ToolCallUpdate } from "@agentclientprotocol/sdk";
import { extractPrimaryPath } from "@/lib/toolPresentation";

export type ComposerWritePayload = {
  path: string;
  content: string;
  variant?: string;
};

function readString(input: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function unwrapContentBlock(block: unknown): Record<string, unknown> | null {
  if (!block || typeof block !== "object") return null;
  const record = block as Record<string, unknown>;
  if (record.type === "content" && record.content && typeof record.content === "object") {
    return record.content as Record<string, unknown>;
  }
  return record;
}

export function extractDiffNewText(update: ToolCallUpdate): string | null {
  const blocks = update.content;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    const diff = unwrapContentBlock(block);
    if (!diff) continue;
    if (diff.type === "diff" && typeof diff.newText === "string") {
      return diff.newText;
    }
  }
  return null;
}

export function extractDiffOldText(update: ToolCallUpdate): string | null {
  const blocks = update.content;
  if (!Array.isArray(blocks)) return null;
  for (const block of blocks) {
    const diff = unwrapContentBlock(block);
    if (!diff) continue;
    if (diff.type === "diff" && typeof diff.oldText === "string") {
      return diff.oldText;
    }
  }
  return null;
}

/** Whether this notification should trigger a disk write (testable without Tauri). */
export function extractComposerWritePayload(
  update: ToolCallUpdate,
): ComposerWritePayload | null {
  const pathFromDiff = (): string | undefined => {
    const blocks = update.content;
    if (!Array.isArray(blocks)) return undefined;
    for (const block of blocks) {
      const unwrapped = unwrapContentBlock(block);
      const p = unwrapped?.path;
      if (typeof p === "string" && p.length > 0) return p;
    }
    return undefined;
  };

  const raw = update.rawInput;
  if (!raw || typeof raw !== "object") {
    const path = extractPrimaryPath(update.locations, undefined) ?? pathFromDiff();
    const content = extractDiffNewText(update);
    if (path && content != null) {
      return { path, content };
    }
    return null;
  }

  const input = raw as Record<string, unknown>;
  const variant =
    typeof input.variant === "string" ? input.variant : undefined;
  const path = extractPrimaryPath(update.locations, raw);
  if (!path) return null;

  if (variant === "CursorWrite" || (!variant && readString(input, "contents", "content"))) {
    const content =
      readString(input, "contents", "content") ?? extractDiffNewText(update);
    if (content == null) return null;
    return { path, content, variant };
  }

  if (variant === "CursorStrReplace") {
    const newString = readString(input, "new_string", "newString");
    if (newString == null) return null;
    return { path, content: newString, variant };
  }

  if (update.kind === "edit") {
    const newText = extractDiffNewText(update);
    if (newText != null) {
      return { path, content: newText, variant };
    }
  }

  return null;
}

export function extractComposerWritePayloadFromCall(
  call: ToolCall,
): ComposerWritePayload | null {
  if (!call.toolCallId) return null;
  return extractComposerWritePayload({
    toolCallId: call.toolCallId,
    rawInput: call.rawInput,
    locations: call.locations,
    kind: call.kind,
    content: (call as ToolCall & { content?: ToolCallUpdate["content"] }).content,
  });
}

/**
 * Avoid applying streaming diff chunks while the tool is still in progress — that
 * wrote partial file content and marked the tool applied before the final update.
 */
export function shouldApplyComposerFileToolNow(
  update: ToolCallUpdate,
  payload: ComposerWritePayload,
): boolean {
  const raw = update.rawInput;
  if (raw && typeof raw === "object") {
    const input = raw as Record<string, unknown>;
    if (payload.variant === "CursorStrReplace") {
      return readString(input, "new_string", "newString") != null;
    }
    if (readString(input, "contents", "content") != null) {
      return true;
    }
    if (payload.variant === "CursorWrite") {
      return extractDiffNewText(update) != null;
    }
  }

  const status = update.status;
  if (status === "in_progress" || status === "pending") {
    return false;
  }
  return true;
}