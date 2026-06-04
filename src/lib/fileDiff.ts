import type { ToolCall, ToolCallUpdate } from "@agentclientprotocol/sdk";
import { parseDiffFromFile, type FileDiffMetadata } from "@pierre/diffs";
import { parsePatch } from "diff";
import { extractDiffNewText } from "@/lib/acp/composerFileToolLogic";
import { extractPrimaryPath, toolNameFromTitle } from "@/lib/toolPresentation";
import type { FileDiffSource } from "@/lib/types";

export type { FileDiffSource };

function readString(
  input: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function pathFromFileToolTitle(title?: string | null): string | undefined {
  if (!title) return undefined;
  const match = title.match(/^(?:Edit|Write)\s+`([^`]+)`/i);
  const path = match?.[1]?.trim();
  return path && path.length > 0 ? path : undefined;
}

function unwrapContentBlock(block: unknown): Record<string, unknown> | null {
  if (!block || typeof block !== "object") return null;
  const record = block as Record<string, unknown>;
  if (record.type === "content" && record.content && typeof record.content === "object") {
    return record.content as Record<string, unknown>;
  }
  return record;
}

function pathFromDiffBlocks(
  content: ToolCallUpdate["content"],
): string | undefined {
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    const unwrapped = unwrapContentBlock(block);
    if (!unwrapped) continue;
    const path = unwrapped.path;
    if (typeof path === "string" && path.length > 0) return path;
  }
  return undefined;
}

function diffFromContentBlocks(
  content: ToolCallUpdate["content"],
): { before: string; after: string; path?: string } | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    const unwrapped = unwrapContentBlock(block);
    if (!unwrapped) continue;
    if (unwrapped.type !== "diff" || typeof unwrapped.newText !== "string") {
      continue;
    }
    const path =
      typeof unwrapped.path === "string" && unwrapped.path.length > 0
        ? unwrapped.path
        : undefined;
    const before =
      typeof unwrapped.oldText === "string" ? unwrapped.oldText : "";
    const after = unwrapped.newText;
    // Completed notifications often repeat the same text (no visible change).
    if (before === after) continue;

    return { before, after, path };
  }
  return null;
}

/** Tool cards that represent file writes/edits and may show a diff when expanded. */
export function isFileDiffTool(title: string, kind?: string): boolean {
  if (kind === "edit") return true;
  const name = toolNameFromTitle(title).toLowerCase();
  return (
    name === "write" ||
    name === "strreplace" ||
    name === "edit" ||
    name === "cursorwrite" ||
    name === "cursorstrreplace"
  );
}

export function extractFileDiffFromToolUpdate(
  update: ToolCallUpdate,
): FileDiffSource | null {
  const fromBlocks = diffFromContentBlocks(update.content);
  const path =
    extractPrimaryPath(update.locations, update.rawInput) ??
    fromBlocks?.path ??
    pathFromDiffBlocks(update.content) ??
    pathFromFileToolTitle(update.title);
  if (!path) return null;

  if (fromBlocks) {
    return { file: path, before: fromBlocks.before, after: fromBlocks.after };
  }

  const raw = update.rawInput;
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const variant =
    typeof input.variant === "string" ? input.variant : undefined;

  const strReplaceBefore = readString(input, "old_string", "oldString");
  const strReplaceAfter = readString(input, "new_string", "newString");
  if (strReplaceAfter != null && strReplaceBefore != null) {
    return { file: path, before: strReplaceBefore, after: strReplaceAfter };
  }

  if (variant === "CursorStrReplace") {
    const before = strReplaceBefore ?? "";
    const after = strReplaceAfter;
    if (after != null) return { file: path, before, after };
  }

  if (
    variant === "CursorWrite" ||
    (!variant && readString(input, "contents", "content"))
  ) {
    const after =
      readString(input, "contents", "content") ?? extractDiffNewText(update);
    if (after != null) {
      const before = readString(input, "old_string", "oldString") ?? "";
      return { file: path, before, after };
    }
  }

  if (update.kind === "edit") {
    const after = extractDiffNewText(update);
    if (after != null) return { file: path, before: "", after };
  }

  return null;
}

export function extractFileDiffFromToolCall(
  call: ToolCall,
): FileDiffSource | null {
  if (!call.toolCallId) return null;
  return extractFileDiffFromToolUpdate({
    toolCallId: call.toolCallId,
    rawInput: call.rawInput,
    locations: call.locations,
    kind: call.kind,
    content: (call as ToolCall & { content?: ToolCallUpdate["content"] })
      .content,
  });
}

function fileNameFromPath(file: string): string {
  const parts = file.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || file;
}

function fileDiffFromContent(
  file: string,
  before: string,
  after: string,
): FileDiffMetadata {
  const name = fileNameFromPath(file);
  if (!before && !after) {
    return parseDiffFromFile({ name, contents: "" }, { name, contents: "" });
  }
  return parseDiffFromFile(
    { name, contents: before },
    { name, contents: after },
  );
}

function fileDiffFromPatch(file: string, patch: string): FileDiffMetadata {
  try {
    const parsed = parsePatch(patch)[0];
    if (parsed?.hunks?.length) {
      const before: string[] = [];
      const after: string[] = [];
      for (const hunk of parsed.hunks) {
        for (const line of hunk.lines) {
          if (line.startsWith("-")) before.push(line.slice(1));
          else if (line.startsWith("+")) after.push(line.slice(1));
          else if (line.startsWith(" ")) {
            before.push(line.slice(1));
            after.push(line.slice(1));
          }
        }
      }
      if (before.length > 0 || after.length > 0) {
        return fileDiffFromContent(
          file,
          before.join("\n"),
          after.join("\n"),
        );
      }
    }
  } catch {
    /* fall through to parseDiffFromFile with empty before */
  }
  return fileDiffFromContent(file, "", patch);
}

/** Hide git-style "\\ No newline at end of file" rows in the UI. */
function stripNoNewlineMarkers(meta: FileDiffMetadata): FileDiffMetadata {
  if (meta.hunks.length === 0) return meta;
  return {
    ...meta,
    hunks: meta.hunks.map((hunk) => ({
      ...hunk,
      noEOFCRDeletions: false,
      noEOFCRAdditions: false,
    })),
  };
}

/** Resolve Pierre diff metadata for the viewer (tool edits or git patch). */
export function resolveFileDiffMetadata(source: FileDiffSource): FileDiffMetadata {
  const meta =
    typeof source.patch === "string" && source.patch.length > 0
      ? fileDiffFromPatch(source.file, source.patch)
      : fileDiffFromContent(
          source.file,
          source.before ?? "",
          source.after ?? "",
        );
  return stripNoNewlineMarkers(meta);
}

function isNoOpDiff(before: string, after: string): boolean {
  return before.length > 0 && before === after;
}

export function mergeFileDiffSources(
  existing: FileDiffSource | undefined,
  incoming: FileDiffSource | undefined,
): FileDiffSource | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const inBefore = incoming.before ?? "";
  const inAfter = incoming.after ?? "";
  if (isNoOpDiff(inBefore, inAfter)) {
    return existing;
  }

  return {
    file: incoming.file || existing.file,
    before: incoming.before ?? existing.before,
    after: incoming.after ?? existing.after,
    patch: incoming.patch ?? existing.patch,
  };
}

/** Whether the diff viewer has something meaningful to render. */
export function hasFileDiffContent(fileDiff?: FileDiffSource): boolean {
  if (!fileDiff) return false;
  if (typeof fileDiff.patch === "string" && fileDiff.patch.length > 0) {
    return true;
  }
  const before = fileDiff.before ?? "";
  const after = fileDiff.after ?? "";
  if (after.length === 0 && before.length === 0) return false;
  return before !== after;
}