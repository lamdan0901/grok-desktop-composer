/** Who initiates the call. */
export type XaiDirection = "gui->agent" | "agent->gui";

/** JSON-RPC message kind. */
export type XaiKind = "request" | "notification";

/**
 * Whether a method's effects re-arrive during `session/load` replay.
 * `replayed` state (e.g. scheduled tasks) is reconstructed from the replayed
 * stream rather than a live query. `none` means no replay reconstruction.
 */
export type XaiReplayBehavior = "none" | "replayed";

export interface XaiMethodEntry {
  method: string;
  direction: XaiDirection;
  kind: XaiKind;
  replayBehavior: XaiReplayBehavior;
  payloadCase: "camelCase" | "snake_case" | "mixed";
}

function entry(
  method: string,
  direction: XaiDirection,
  kind: XaiKind,
  replayBehavior: XaiReplayBehavior = "none",
  payloadCase: XaiMethodEntry["payloadCase"] = "camelCase",
): XaiMethodEntry {
  return { method, direction, kind, replayBehavior, payloadCase };
}

/**
 * Single source of truth for `x.ai/*` methods. Direction/kind confusion caused
 * the contract errors caught in review; encoding them once prevents recurrence.
 * Verified against grok source (crates/codegen/xai-grok-shell + xai-grok-pager).
 */
export const XAI = {
  // ── Reverse requests (agent -> gui) ────────────────────────────────
  askUserQuestion: entry("x.ai/ask_user_question", "agent->gui", "request"),
  exitPlanMode: entry("x.ai/exit_plan_mode", "agent->gui", "request"),
  mcpSdkCall: entry("x.ai/mcp/sdk_call", "agent->gui", "request"),

  // ── MCP (gui -> agent requests) ────────────────────────────────────
  mcpList: entry("x.ai/mcp/list", "gui->agent", "request"),
  mcpUpsert: entry("x.ai/mcp/upsert", "gui->agent", "request", "none", "snake_case"),
  mcpToggle: entry("x.ai/mcp/toggle", "gui->agent", "request", "none", "snake_case"),
  mcpToggleTool: entry("x.ai/mcp/toggle_tool", "gui->agent", "request", "none", "snake_case"),
  mcpDelete: entry("x.ai/mcp/delete", "gui->agent", "request", "none", "snake_case"),
  mcpAuthStatus: entry("x.ai/mcp/auth_status", "gui->agent", "request", "none", "snake_case"),
  mcpAuthTrigger: entry("x.ai/mcp/auth_trigger", "gui->agent", "request", "none", "snake_case"),

  // ── MCP status notifications (agent -> gui) ────────────────────────
  mcpServersUpdated: entry("x.ai/mcp/servers_updated", "agent->gui", "notification"),
  mcpServerStatus: entry("x.ai/mcp/server_status", "agent->gui", "notification"),
  mcpToolsChanged: entry("x.ai/mcp/tools_changed", "agent->gui", "notification"),
  mcpInitProgress: entry("x.ai/mcp/init_progress", "agent->gui", "notification"),

  // ── Subagent (gui -> agent requests) ───────────────────────────────
  subagentGet: entry("x.ai/subagent/get", "gui->agent", "request"),
  subagentListRunning: entry("x.ai/subagent/list_running", "gui->agent", "request"),
  subagentCancel: entry("x.ai/subagent/cancel", "gui->agent", "request"),

  // ── Tasks / scheduler (gui -> agent requests) ──────────────────────
  taskList: entry("x.ai/task/list", "gui->agent", "request"),
  taskKill: entry("x.ai/task/kill", "gui->agent", "request"),
  schedulerDelete: entry("x.ai/scheduler/delete", "gui->agent", "request"),

  // ── Rewind (gui -> agent requests) ────────────────────────────────
  rewindPoints: entry("x.ai/rewind/points", "gui->agent", "request"),
  rewindExecute: entry("x.ai/rewind/execute", "gui->agent", "request"),

  // ── Plain session actions (gui -> agent requests) ─────────────────
  sessionFork: entry("x.ai/session/fork", "gui->agent", "request"),
  sessionDelete: entry("x.ai/session/delete", "gui->agent", "request"),
  sessionRename: entry("x.ai/session/rename", "gui->agent", "request"),

  // ── Git worktree session fork (gui -> agent requests) ─────────────
  gitWorktreeCreateFromSync: entry(
    "x.ai/git/worktree/create_from_worktree_sync",
    "gui->agent",
    "request",
  ),
  gitWorktreeResumeSession: entry(
    "x.ai/git/worktree/resume_session",
    "gui->agent",
    "request",
  ),

  // ── Prompt queue / interject ──────────────────────────────────────
  queueChanged: entry(
    "x.ai/queue/changed",
    "agent->gui",
    "notification",
    "none",
    "mixed",
  ),
  queueRemove: entry("x.ai/queue/remove", "gui->agent", "notification"),
  queueReorder: entry("x.ai/queue/reorder", "gui->agent", "notification"),
  queueClear: entry("x.ai/queue/clear", "gui->agent", "notification"),
  queueInterject: entry("x.ai/queue/interject", "gui->agent", "notification"),
  interject: entry("x.ai/interject", "gui->agent", "request"),

  // ── Task / scheduler / monitor notifications (agent -> gui) ────────
  // Scheduled-task events replay on session/load so the pane is reconstructed.
  taskBackgrounded: entry("x.ai/task_backgrounded", "agent->gui", "notification", "none", "snake_case"),
  taskCompleted: entry("x.ai/task_completed", "agent->gui", "notification", "none", "snake_case"),
  monitorEvent: entry("x.ai/monitor_event", "agent->gui", "notification", "none", "snake_case"),
  scheduledTaskCreated: entry("x.ai/scheduled_task_created", "agent->gui", "notification", "replayed", "snake_case"),
  scheduledTaskFired: entry("x.ai/scheduled_task_fired", "agent->gui", "notification", "replayed", "snake_case"),
  scheduledTaskDeleted: entry("x.ai/scheduled_task_deleted", "agent->gui", "notification", "replayed", "snake_case"),
  scheduledTaskInjectPrompt: entry("x.ai/scheduled_task_inject_prompt", "agent->gui", "notification", "replayed", "snake_case"),
} as const;

/** All dedicated agent->gui notification methods (NOT the generic envelope). */
export const XAI_DEDICATED_NOTIFICATIONS: readonly string[] = Object.values(XAI)
  .filter((e) => e.direction === "agent->gui" && e.kind === "notification")
  .map((e) => e.method);
