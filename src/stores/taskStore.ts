import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export type TaskStatus = "running" | "completed" | "failed";
export type TaskKind = "task" | "monitor";

export interface BackgroundTask {
  taskId: string;
  command: string;
  description?: string;
  cwd?: string;
  outputFile?: string;
  kind: TaskKind;
  status: TaskStatus;
  exitCode?: number;
  lineCount?: number;
}
export interface ScheduledTask {
  taskId: string;
  prompt: string;
  humanSchedule: string;
  nextFireAt?: string;
}

interface TaskState {
  tasksByTab: Record<SessionId, BackgroundTask[]>;
  scheduledByTab: Record<SessionId, ScheduledTask[]>;
  getTasks: (tabId: SessionId) => BackgroundTask[];
  getScheduled: (tabId: SessionId) => ScheduledTask[];
  setTasks: (tabId: SessionId, tasks: BackgroundTask[]) => void;
  clearTab: (tabId: SessionId) => void;
}

const EMPTY_TASKS: BackgroundTask[] = [];
const EMPTY_SCHEDULED: ScheduledTask[] = [];

export const useTaskStore = create<TaskState>((set, get) => ({
  tasksByTab: {},
  scheduledByTab: {},
  getTasks: (tabId) => get().tasksByTab[tabId] ?? EMPTY_TASKS,
  getScheduled: (tabId) => get().scheduledByTab[tabId] ?? EMPTY_SCHEDULED,
  setTasks: (tabId, tasks) => set((s) => ({ tasksByTab: { ...s.tasksByTab, [tabId]: tasks } })),
  clearTab: (tabId) =>
    set((s) => {
      const { [tabId]: _t, ...tasks } = s.tasksByTab;
      const { [tabId]: _s, ...scheduled } = s.scheduledByTab;
      return { tasksByTab: tasks, scheduledByTab: scheduled };
    }),
}));

function upsertTask(tabId: SessionId, task: BackgroundTask): void {
  useTaskStore.setState((s) => {
    const list = s.tasksByTab[tabId] ?? [];
    const idx = list.findIndex((t) => t.taskId === task.taskId);
    const next =
      idx >= 0
        ? list.map((t) => (t.taskId === task.taskId ? { ...t, ...task } : t))
        : [...list, task];
    return { tasksByTab: { ...s.tasksByTab, [tabId]: next } };
  });
}

function patchTask(tabId: SessionId, taskId: string, patch: Partial<BackgroundTask>): void {
  useTaskStore.setState((s) => {
    const list = s.tasksByTab[tabId] ?? [];
    return {
      tasksByTab: {
        ...s.tasksByTab,
        [tabId]: list.map((t) => (t.taskId === taskId ? { ...t, ...patch } : t)),
      },
    };
  });
}

function upsertScheduled(tabId: SessionId, task: ScheduledTask): void {
  useTaskStore.setState((s) => {
    const list = s.scheduledByTab[tabId] ?? [];
    const idx = list.findIndex((t) => t.taskId === task.taskId);
    const next =
      idx >= 0
        ? list.map((t) => (t.taskId === task.taskId ? { ...t, ...task } : t))
        : [...list, task];
    return { scheduledByTab: { ...s.scheduledByTab, [tabId]: next } };
  });
}

function removeScheduled(tabId: SessionId, taskId: string): void {
  useTaskStore.setState((s) => {
    const list = s.scheduledByTab[tabId] ?? [];
    return {
      scheduledByTab: { ...s.scheduledByTab, [tabId]: list.filter((t) => t.taskId !== taskId) },
    };
  });
}

/**
 * Ingest a dedicated task/scheduler/monitor ext-notification. Each carries a
 * SessionNotification envelope: fields live on `params.update`.
 */
export function ingestTaskNotification(
  sessionId: SessionId,
  _method: string,
  params: Record<string, unknown>,
): void {
  const update = (params.update ?? {}) as Record<string, unknown>;
  const tag = update.sessionUpdate;

  if (tag === "task_backgrounded") {
    const taskId = String(update.task_id ?? "");
    if (!taskId) return;
    const existing = useTaskStore.getState().getTasks(sessionId).find((t) => t.taskId === taskId);
    const monitor =
      typeof update.monitor_description === "string" && update.monitor_description.trim();
    upsertTask(sessionId, {
      taskId,
      command: String(update.command ?? ""),
      description: typeof update.description === "string" ? update.description : undefined,
      cwd: typeof update.cwd === "string" ? update.cwd : undefined,
      outputFile: typeof update.output_file === "string" ? update.output_file : undefined,
      kind: monitor ? "monitor" : "task",
      status: existing?.status ?? "running",
    });
    return;
  }

  if (tag === "task_completed") {
    const snap = (update.task_snapshot ?? {}) as Record<string, unknown>;
    const taskId = String(snap.taskId ?? "");
    if (!taskId) return;
    const exitCode = typeof snap.exitCode === "number" ? snap.exitCode : undefined;
    const existing = useTaskStore.getState().getTasks(sessionId).find((t) => t.taskId === taskId);
    upsertTask(sessionId, {
      taskId,
      command: existing?.command ?? String(snap.displayCommand ?? snap.command ?? "Task"),
      kind: existing?.kind ?? "task",
      status: exitCode !== undefined && exitCode !== 0 ? "failed" : "completed",
      exitCode,
    });
    return;
  }

  if (tag === "monitor_event") {
    // A monitor emits stdout lines; ensure the row exists and bump its line count.
    const taskId = String(update.task_id ?? "");
    if (!taskId) return;
    const existing = useTaskStore.getState().getTasks(sessionId).find((t) => t.taskId === taskId);
    if (existing) {
      patchTask(sessionId, taskId, { lineCount: (existing.lineCount ?? 0) + 1 });
    } else {
      upsertTask(sessionId, {
        taskId,
        command: String(update.description ?? "monitor"),
        kind: "monitor",
        status: "running",
        lineCount: 1,
      });
    }
    return;
  }

  if (tag === "scheduled_task_created" || tag === "scheduled_task_fired") {
    upsertScheduled(sessionId, {
      taskId: String(update.task_id ?? ""),
      prompt: String(update.prompt ?? ""),
      humanSchedule: String(update.human_schedule ?? ""),
      nextFireAt: typeof update.next_fire_at === "string" ? update.next_fire_at : undefined,
    });
    return;
  }

  if (tag === "scheduled_task_deleted") {
    removeScheduled(sessionId, String(update.task_id ?? ""));
    return;
  }

  // scheduled_task_inject_prompt: advisory; no store change needed.
}
