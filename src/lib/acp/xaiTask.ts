import { getTabSession } from "@/lib/acp";
import { XAI } from "./xaiMethods";
import { callRequestFeature } from "./featureDetection";
import { useTaskStore, type BackgroundTask } from "@/stores/taskStore";

function grokSid(tabId: string): string {
  const sid = getTabSession(tabId).grokSessionId;
  if (!sid) throw new Error("No grok session bound to this tab");
  return sid;
}

/** Snapshot the live task list from grok and merge into the store. */
export async function listTasks(tabId: string): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.taskList, () =>
    getTabSession(tabId).extMethod(XAI.taskList.method, { sessionId: grokSid(tabId) }),
  );
  if (!result.supported) return false;
  const res = result.value as { tasks: Array<Record<string, unknown>> };
  const tasks: BackgroundTask[] = (res.tasks ?? []).map((t) => ({
    taskId: String(t.taskId ?? ""),
    command: String(t.displayCommand ?? t.command ?? ""),
    cwd: typeof t.cwd === "string" ? t.cwd : undefined,
    outputFile: typeof t.outputFile === "string" ? t.outputFile : undefined,
    kind: t.kind === "monitor" ? "monitor" : "task",
    status: t.completed
      ? typeof t.exitCode === "number" && t.exitCode !== 0
        ? "failed"
        : "completed"
      : "running",
    exitCode: typeof t.exitCode === "number" ? t.exitCode : undefined,
  }));
  useTaskStore.getState().setTasks(tabId, tasks);
  return true;
}

export async function killTask(tabId: string, taskId: string): Promise<void> {
  const result = await callRequestFeature(tabId, XAI.taskKill, () =>
    getTabSession(tabId).extMethod(XAI.taskKill.method, { sessionId: grokSid(tabId), taskId }),
  );
  if (!result.supported) return;
  await listTasks(tabId);
}

export async function deleteScheduledTask(tabId: string, taskId: string): Promise<void> {
  const result = await callRequestFeature(tabId, XAI.schedulerDelete, () =>
    getTabSession(tabId).extMethod(XAI.schedulerDelete.method, {
      sessionId: grokSid(tabId),
      taskId,
    }),
  );
  if (!result.supported) return;
}
