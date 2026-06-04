import type { ToolCall, ToolCallUpdate } from "@agentclientprotocol/sdk";
import {
  extractComposerWritePayload,
  extractComposerWritePayloadFromCall,
  extractDiffOldText,
  shouldApplyComposerFileToolNow,
} from "@/lib/acp/composerFileToolLogic";
import {
  clearComposerFileToolApplied,
  isComposerFileToolApplied,
  markComposerFileToolApplied,
} from "@/lib/acp/composerFileToolApplied";
import { applyStrReplaceToContent } from "@/lib/acp/fileReplace";
import {
  findToolMessageIndex,
  resolveToolCallIdForUpsert,
} from "@/lib/toolCallIdentity";
import {
  projectCwdForTab,
  readProjectFile,
  writeProjectFile,
} from "@/lib/acpFs";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { SessionId } from "@/lib/types";

function readString(input: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function readBoolean(input: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

function markComposerFileToolCompleted(
  sessionId: SessionId,
  toolCallId: string,
  path: string,
): void {
  markComposerFileToolApplied(sessionId, toolCallId);
  const store = useWorkspaceStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  const messages = session?.messages ?? [];
  const resolvedId = resolveToolCallIdForUpsert(messages, toolCallId, path);
  const idx = findToolMessageIndex(messages, resolvedId, path);
  const title =
    idx >= 0 && messages[idx]?.role === "tool"
      ? messages[idx].title
      : `Edit \`${path}\``;
  store.upsertToolCallMessage(sessionId, {
    toolCallId: resolvedId,
    title,
    path,
    status: "completed",
  });
}

async function strReplaceAlreadyOnDisk(
  sessionId: SessionId,
  path: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): Promise<boolean> {
  try {
    const current = await readProjectFile(sessionId, path);
    const recheck = applyStrReplaceToContent(current, oldString, newString, {
      replaceAll,
    });
    return recheck.status === "noop";
  } catch {
    return false;
  }
}

/**
 * When the app advertises ACP `fs.writeTextFile`, Grok delegates file mutations to the
 * client via Composer tool notifications (`CursorWrite` / `CursorStrReplace`) instead of
 * calling `fs/write_text_file` directly. Persist those edits to the project on disk.
 */
export async function applyComposerFileTool(
  sessionId: SessionId,
  update: ToolCallUpdate,
): Promise<boolean> {
  const toolCallId = update.toolCallId;
  if (!toolCallId || isComposerFileToolApplied(sessionId, toolCallId)) {
    return false;
  }

  const payload = extractComposerWritePayload(update);
  if (!payload) return false;
  if (!shouldApplyComposerFileToolNow(update, payload)) {
    return false;
  }

  const { path, content, variant } = payload;
  const root = projectCwdForTab(sessionId);
  if (!root.trim()) {
    useWorkspaceStore.getState().appendError(
      sessionId,
      "No project folder for this thread — reopen the project and try again.",
    );
    return false;
  }

  const raw = update.rawInput;
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  try {
    if (variant === "CursorStrReplace") {
      const oldString = readString(input, "old_string", "oldString") ?? "";
      const newString = content;
      const replaceAll = readBoolean(input, "replace_all", "replaceAll");

      let fileContent = "";
      try {
        fileContent = await readProjectFile(sessionId, path);
      } catch {
        // New file — start from empty buffer.
      }

      const result = applyStrReplaceToContent(
        fileContent,
        oldString,
        newString,
        { replaceAll },
      );

      if (result.status === "noop") {
        console.warn(
          `[composer-fs] StrReplace already applied for ${path}, skipping client write`,
        );
        markComposerFileToolCompleted(sessionId, toolCallId, path);
        return true;
      }

      if (result.status === "error") {
        if (
          await strReplaceAlreadyOnDisk(
            sessionId,
            path,
            oldString,
            newString,
            replaceAll,
          )
        ) {
          markComposerFileToolCompleted(sessionId, toolCallId, path);
          return true;
        }
        const diffOld = extractDiffOldText(update);
        console.warn(`[composer-fs] StrReplace failed for ${path}: ${result.message}`);
        useWorkspaceStore.getState().appendError(
          sessionId,
          `Failed to edit ${path}: ${result.message}`,
        );
        if (diffOld != null) {
          markComposerFileToolApplied(sessionId, toolCallId);
        }
        return false;
      }

      try {
        await writeProjectFile(sessionId, path, result.content);
      } catch (writeErr) {
        if (
          await strReplaceAlreadyOnDisk(
            sessionId,
            path,
            oldString,
            newString,
            replaceAll,
          )
        ) {
          markComposerFileToolCompleted(sessionId, toolCallId, path);
          return true;
        }
        throw writeErr;
      }
      markComposerFileToolCompleted(sessionId, toolCallId, path);
      return true;
    }

    await writeProjectFile(sessionId, path, content);
    markComposerFileToolCompleted(sessionId, toolCallId, path);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[composer-fs] failed to apply edit", path, err);
    if (variant === "CursorStrReplace") {
      const oldString = readString(input, "old_string", "oldString") ?? "";
      const newString = content;
      const replaceAll = readBoolean(input, "replace_all", "replaceAll");
      if (
        await strReplaceAlreadyOnDisk(
          sessionId,
          path,
          oldString,
          newString,
          replaceAll,
        )
      ) {
        markComposerFileToolCompleted(sessionId, toolCallId, path);
        return true;
      }
    }
    useWorkspaceStore.getState().appendError(
      sessionId,
      `Failed to write ${path}: ${message}`,
    );
  }

  return false;
}

export function applyComposerFileToolFromCall(
  sessionId: SessionId,
  call: ToolCall,
): void {
  const payload = extractComposerWritePayloadFromCall(call);
  if (!payload || !call.toolCallId) return;
  void applyComposerFileTool(sessionId, {
    toolCallId: call.toolCallId,
    rawInput: call.rawInput,
    locations: call.locations,
    kind: call.kind,
    content: (call as ToolCall & { content?: ToolCallUpdate["content"] }).content,
  });
}

export function clearComposerFileToolDedupe(sessionId: SessionId): void {
  clearComposerFileToolApplied(sessionId);
}

export { isComposerFileToolApplied };