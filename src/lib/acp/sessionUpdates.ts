import type {
  AvailableCommand,
  ContentBlock,
  SessionNotification,
  SessionUpdate,
  ToolCall,
  ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import {
  applyComposerFileTool,
  applyComposerFileToolFromCall,
} from "@/lib/acp/applyComposerFileTool";
import {
  isAgentOutputSuppressed,
  isSilentSessionAttach,
} from "@/lib/agentOutputGuard";
import {
  beginHistoryReplay,
  cancelHistoryReplay,
  isHistoryReplay,
  touchHistoryReplay,
} from "@/lib/historyReplay";
import type { SessionId } from "@/lib/types";
import { readPlanFile, watchPlanFile } from "@/lib/grok";
import {
  extractPlanContentFromUpdate,
  fileUriToPath,
  planEntriesToMarkdown,
  syncPlanFromDisk,
} from "@/lib/plan";
import {
  isTodoWriteTool,
  parseTodosFromToolPayload,
} from "@/lib/todos";
import {
  extractFileDiffFromToolCall,
  extractFileDiffFromToolUpdate,
  mergeFileDiffSources,
} from "@/lib/fileDiff";
import { isComposerFileToolApplied } from "@/lib/acp/composerFileToolApplied";
import {
  extractPrimaryPath,
  isSubagentTool,
  mapAcpToolStatus,
  mapAgentStatusFromTool,
} from "@/lib/toolPresentation";
import { mergeToolCallStatus } from "@/lib/toolCallStatus";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";
import { useTodoStore } from "@/stores/todoStore";
import { shouldSkipDuplicateSessionNotification } from "@/lib/sessionUpdateDedupe";
import {
  findToolMessageIndex,
  resolveToolCallIdForUpsert,
} from "@/lib/toolCallIdentity";
import { usePlanStore } from "@/stores/planStore";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Extract plain text from ACP content chunks (user, assistant, or thought). */
export function textFromSessionContentChunk(
  update: SessionUpdate,
): string | null {
  if (
    update.sessionUpdate !== "user_message_chunk" &&
    update.sessionUpdate !== "agent_message_chunk" &&
    update.sessionUpdate !== "agent_thought_chunk"
  ) {
    return null;
  }
  const block: ContentBlock = update.content;
  if (block.type === "text") {
    return block.text;
  }
  return null;
}

function asSessionUpdate(raw: unknown): SessionUpdate | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  if (typeof u.sessionUpdate !== "string") return null;
  return raw as SessionUpdate;
}

/** Merge file diff payloads before duplicate notification filtering. */
function persistToolFileDiffFromParams(
  sessionId: SessionId,
  params: Record<string, unknown>,
): void {
  if (isHistoryReplay(sessionId) || isSilentSessionAttach(sessionId)) return;
  const notification = notificationFromParams(params);
  if (!notification) return;

  const update = notification.update;
  const store = useWorkspaceStore.getState();

  const mergeAndUpsert = (
    toolCallId: string,
    title: string,
    incoming: ReturnType<typeof extractFileDiffFromToolUpdate>,
  ) => {
    if (!incoming) return;
    const session = store.sessions.find((s) => s.id === sessionId);
    const messages = session?.messages ?? [];
    const resolvedId = resolveToolCallIdForUpsert(
      messages,
      toolCallId,
      incoming.file,
    );
    const idx = findToolMessageIndex(messages, resolvedId, incoming.file);
    const existing =
      idx >= 0 && messages[idx]?.role === "tool" ? messages[idx] : undefined;
    const fileDiff = mergeFileDiffSources(
      existing?.role === "tool" ? existing.fileDiff : undefined,
      incoming,
    );
    store.upsertToolCallMessage(sessionId, {
      toolCallId: resolvedId,
      title: existing?.role === "tool" ? existing.title : title,
      path: incoming.file,
      fileDiff,
    });
  };

  if (update.sessionUpdate === "tool_call") {
    const call = update as ToolCall;
    if (!call.toolCallId) return;
    mergeAndUpsert(
      call.toolCallId,
      String(call.title ?? "Tool"),
      extractFileDiffFromToolCall(call),
    );
  } else if (update.sessionUpdate === "tool_call_update") {
    const u = update as ToolCallUpdate;
    if (!u.toolCallId) return;
    mergeAndUpsert(
      u.toolCallId,
      resolveToolTitle(
        sessionId,
        u.toolCallId,
        u.title,
        extractFileDiffFromToolUpdate(u)?.file,
      ),
      extractFileDiffFromToolUpdate(u),
    );
  }
}

/** Persist Write/Edit tool payloads before duplicate notification filtering. */
function persistComposerFileToolFromParams(
  sessionId: SessionId,
  params: Record<string, unknown>,
): void {
  if (isHistoryReplay(sessionId) || isSilentSessionAttach(sessionId)) return;
  const update = params.update;
  if (!update || typeof update !== "object") return;
  const u = update as Record<string, unknown>;
  const kind = u.sessionUpdate;
  if (kind === "tool_call") {
    applyComposerFileToolFromCall(sessionId, u as ToolCall);
  } else if (kind === "tool_call_update") {
    void applyComposerFileTool(sessionId, u as ToolCallUpdate);
  }
}

function notificationFromParams(
  params: SessionNotification | Record<string, unknown>,
): SessionNotification | null {
  if (!params || typeof params !== "object") return null;
  if ("update" in params) {
    const update = asSessionUpdate(
      (params as SessionNotification).update,
    );
    if (!update) return null;
    return { sessionId: (params as SessionNotification).sessionId, update };
  }
  return null;
}

function grokDeltaFields(
  update: Record<string, unknown>,
): { toolCallId: string; title: string } | null {
  if (update.sessionUpdate !== "tool_call_delta_chunk") return null;
  const toolCallId =
    (update.tool_call_id as string) ?? (update.toolCallId as string);
  const title =
    (update.name as string) ?? (update.title as string) ?? "Tool";
  if (!toolCallId) return null;
  return { toolCallId, title: String(title) };
}

function syncSubagentNode(
  sessionId: SessionId,
  toolCallId: string,
  title: string,
  kind?: string,
  path?: string,
  status?: ReturnType<typeof mapAcpToolStatus>,
): void {
  if (!isSubagentTool(title, kind)) return;
  const store = useWorkspaceStore.getState();
  const displayStatus = status ?? "running";
  store.upsertAgentNode(sessionId, {
    id: toolCallId,
    title,
    kind,
    path,
    status: mapAgentStatusFromTool(displayStatus),
  });
  if (status) {
    store.setAgentNodeStatus(
      sessionId,
      toolCallId,
      mapAgentStatusFromTool(status),
    );
  }
}

function applyTodoWriteFromRaw(
  sessionId: SessionId,
  raw: Record<string, unknown>,
  title?: string | null,
): boolean {
  if (!isTodoWriteTool(title, raw)) return false;
  const parsed = parseTodosFromToolPayload(raw);
  if (!parsed) return false;
  useTodoStore.getState().setTodos(sessionId, parsed.todos, parsed.merge);
  return true;
}

function applyToolCall(sessionId: SessionId, call: ToolCall): void {
  const raw = call as ToolCall & Record<string, unknown>;
  if (applyTodoWriteFromRaw(sessionId, raw, call.title)) return;

  const store = useWorkspaceStore.getState();
  const incomingId = call.toolCallId ?? newId();
  const title = call.title ?? incomingId;
  const path = extractPrimaryPath(call.locations, call.rawInput);
  const fileDiff = extractFileDiffFromToolCall(call) ?? undefined;
  const session = store.sessions.find((s) => s.id === sessionId);
  const toolCallId = resolveToolCallIdForUpsert(
    session?.messages ?? [],
    incomingId,
    path ?? fileDiff?.file,
  );
  const status = mergeToolCallStatus(
    mapAcpToolStatus(call.status),
    undefined,
    isComposerFileToolApplied(sessionId, toolCallId),
  );

  store.upsertToolCallMessage(sessionId, {
    toolCallId,
    title: String(title),
    kind: call.kind,
    path,
    status,
    fileDiff,
  });
  syncSubagentNode(sessionId, toolCallId, String(title), call.kind, path, status);
}

function resolveToolTitle(
  sessionId: SessionId,
  toolCallId: string,
  incoming?: string | null,
  path?: string,
): string {
  if (incoming) return incoming;
  const session = useWorkspaceStore
    .getState()
    .sessions.find((s) => s.id === sessionId);
  const messages = session?.messages ?? [];
  const resolvedId = resolveToolCallIdForUpsert(messages, toolCallId, path);
  const idx = findToolMessageIndex(messages, resolvedId, path);
  const fromMessage =
    idx >= 0 && messages[idx]?.role === "tool" ? messages[idx] : undefined;
  if (fromMessage?.role === "tool") return fromMessage.title;
  const fromNode = session?.agentNodes.find((n) => n.id === toolCallId);
  return fromNode?.title ?? "Tool";
}

function applyToolCallUpdate(sessionId: SessionId, update: ToolCallUpdate): void {
  const raw = update as ToolCallUpdate & Record<string, unknown>;
  const incomingId = update.toolCallId;
  if (!incomingId) return;

  const incomingDiff = extractFileDiffFromToolUpdate(update);
  const path =
    extractPrimaryPath(update.locations, update.rawInput) ??
    incomingDiff?.file;
  const title = resolveToolTitle(
    sessionId,
    incomingId,
    update.title,
    path,
  );
  if (applyTodoWriteFromRaw(sessionId, raw, title)) return;

  const store = useWorkspaceStore.getState();
  const session = store.sessions.find((s) => s.id === sessionId);
  const messages = session?.messages ?? [];
  const toolCallId = resolveToolCallIdForUpsert(
    messages,
    incomingId,
    path,
  );
  const idx = findToolMessageIndex(messages, toolCallId, path);
  const existingTool =
    idx >= 0 && messages[idx]?.role === "tool" ? messages[idx] : undefined;
  const status = mergeToolCallStatus(
    update.status ? mapAcpToolStatus(update.status) : undefined,
    existingTool?.role === "tool" ? existingTool.status : undefined,
    isComposerFileToolApplied(sessionId, toolCallId),
  );
  const fileDiff = mergeFileDiffSources(
    existingTool?.role === "tool" ? existingTool.fileDiff : undefined,
    incomingDiff ?? undefined,
  );

  store.upsertToolCallMessage(sessionId, {
    toolCallId,
    title,
    kind: update.kind ?? undefined,
    path,
    status,
    fileDiff,
  });

  if (status) {
    syncSubagentNode(
      sessionId,
      toolCallId,
      title,
      update.kind ?? undefined,
      path,
      status,
    );
  }
}

/**
 * Replay `updates.jsonl` from disk into the workspace transcript.
 */
export function replayUpdatesJsonl(
  workspaceSessionId: SessionId,
  raw: string,
): void {
  beginHistoryReplay(workspaceSessionId);
  const store = () => useWorkspaceStore.getState();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      if (row.method !== "session/update") continue;
      const params = row.params;
      if (!params || typeof params !== "object") continue;
      applySessionNotification(
        workspaceSessionId,
        params as SessionNotification | Record<string, unknown>,
      );
    } catch {
      continue;
    }
  }

  store().finalizeAssistantStream(workspaceSessionId);
  store().finalizeThoughts(workspaceSessionId);
  store().setSessionStatus(workspaceSessionId, "idle");
  cancelHistoryReplay(workspaceSessionId);
}

/**
 * Apply agent session stream updates to the active session transcript.
 */
export function applySessionNotification(
  sessionId: SessionId,
  params: SessionNotification | Record<string, unknown>,
  sourceMethod?: string,
): void {
  const rawParams = params as Record<string, unknown>;
  persistComposerFileToolFromParams(sessionId, rawParams);
  persistToolFileDiffFromParams(sessionId, rawParams);
  if (
    shouldSkipDuplicateSessionNotification(
      sessionId,
      rawParams,
      sourceMethod,
    )
  ) {
    return;
  }

  const notification = notificationFromParams(params);
  if (!notification) return;

  if (isSilentSessionAttach(sessionId)) return;

  const update = notification.update;
  const store = useWorkspaceStore.getState();
  const raw = update as SessionUpdate & Record<string, unknown>;

  if (
    isAgentOutputSuppressed(sessionId) &&
    (update.sessionUpdate === "agent_message_chunk" ||
      update.sessionUpdate === "agent_thought_chunk")
  ) {
    return;
  }

  const delta = grokDeltaFields(raw);
  if (delta) {
    store.upsertToolCallMessage(sessionId, {
      toolCallId: delta.toolCallId,
      title: delta.title,
      status: "running",
    });
    syncSubagentNode(sessionId, delta.toolCallId, delta.title);
    return;
  }

  const finishReplay = () => {
    store.finalizeAssistantStream(sessionId);
    store.finalizeThoughts(sessionId);
    store.setSessionStatus(sessionId, "idle");
  };

  switch (update.sessionUpdate) {
    case "user_message_chunk": {
      const text = textFromSessionContentChunk(update);
      if (!text) break;
      if (isHistoryReplay(sessionId)) {
        store.finalizeAssistantStream(sessionId);
        store.appendHistoryUserMessage(sessionId, text);
        touchHistoryReplay(sessionId, finishReplay);
      }
      break;
    }
    case "agent_message_chunk": {
      const text = textFromSessionContentChunk(update);
      if (!text) break;
      store.appendAssistantChunk(sessionId, text);
      if (isHistoryReplay(sessionId)) {
        touchHistoryReplay(sessionId, finishReplay);
      }
      break;
    }
    case "agent_thought_chunk": {
      const text = textFromSessionContentChunk(update);
      if (!text) break;
      store.appendThoughtChunk(sessionId, text);
      if (isHistoryReplay(sessionId)) {
        touchHistoryReplay(sessionId, finishReplay);
      }
      break;
    }
    case "tool_call":
      applyToolCall(sessionId, update);
      break;
    case "tool_call_update":
      applyToolCallUpdate(sessionId, update);
      break;
    case "plan":
      applyPlanUpdate(sessionId, raw);
      break;
    case "plan_update":
      applyPlanUpdate(sessionId, raw);
      break;
    case "plan_removed":
      usePlanStore.getState().clearPlan(sessionId);
      if (
        useWorkspaceStore.getState().sessions.find((s) => s.id === sessionId)
          ?.status === "plan_review"
      ) {
        store.setSessionStatus(sessionId, "idle");
      }
      break;
    case "config_option_update":
      if ("configOptions" in update && Array.isArray(update.configOptions)) {
        useSessionConfigStore
          .getState()
          .setConfigOptions(sessionId, update.configOptions);
      }
      break;
    case "available_commands_update": {
      const rawList =
        update.availableCommands ??
        (raw.available_commands as AvailableCommand[] | undefined);
      if (Array.isArray(rawList) && rawList.length > 0) {
        useSlashCommandsStore.getState().setCommands(sessionId, rawList);
      }
      break;
    }
    default:
      break;
  }
}

function applyPlanUpdate(
  sessionId: SessionId,
  raw: SessionUpdate & Record<string, unknown>,
): void {
  const store = useWorkspaceStore.getState();
  store.setSessionStatus(sessionId, "plan_review");

  const extracted = extractPlanContentFromUpdate(raw);
  if (extracted.markdown?.trim()) {
    usePlanStore.getState().setPlan(sessionId, {
      content: extracted.markdown,
    });
  } else if (extracted.fileUri) {
    const path = fileUriToPath(extracted.fileUri);
    if (path) {
      usePlanStore.getState().setPlan(sessionId, { path });
      void readPlanFile(path).then((content) => {
        usePlanStore.getState().setPlan(sessionId, { path, content });
        if (content.trim()) {
          void watchPlanFile(sessionId, path);
        }
      });
    }
  } else if (Array.isArray(raw.entries)) {
    usePlanStore.getState().setPlan(sessionId, {
      content: planEntriesToMarkdown(
        raw.entries as Parameters<typeof planEntriesToMarkdown>[0],
      ),
    });
  }

  const session = store.sessions.find((s) => s.id === sessionId);
  const project = store.projects.find((p) => p.id === session?.projectId);
  if (session?.grokSessionId && project?.cwd) {
    void syncPlanFromDisk(sessionId, project.cwd, session.grokSessionId);
  }
}

function newId(): string {
  return crypto.randomUUID();
}