import { describe, expect, it, beforeEach } from "vitest";
import { useTaskStore, ingestTaskNotification } from "./taskStore";

describe("taskStore", () => {
  beforeEach(() => useTaskStore.setState({ tasksByTab: {}, scheduledByTab: {} }));

  it("adds a background task on task_backgrounded", () => {
    ingestTaskNotification("s1", "x.ai/task_backgrounded", {
      sessionId: "s1",
      update: {
        sessionUpdate: "task_backgrounded",
        task_id: "t1",
        command: "npm run dev",
        cwd: "/r",
        output_file: "/r/l.log",
      },
    });
    const tasks = useTaskStore.getState().getTasks("s1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskId: "t1",
      command: "npm run dev",
      status: "running",
      kind: "task",
    });
  });

  it("flags a monitor task via monitor_description", () => {
    ingestTaskNotification("s1", "x.ai/task_backgrounded", {
      sessionId: "s1",
      update: {
        sessionUpdate: "task_backgrounded",
        task_id: "m1",
        command: "tail -f",
        cwd: "/r",
        output_file: "/r/l.log",
        monitor_description: "watch log",
      },
    });
    expect(useTaskStore.getState().getTasks("s1")[0].kind).toBe("monitor");
  });

  it("marks a task completed on task_completed", () => {
    ingestTaskNotification("s1", "x.ai/task_backgrounded", {
      sessionId: "s1",
      update: { sessionUpdate: "task_backgrounded", task_id: "t1", command: "x", cwd: "/r", output_file: "/l" },
    });
    ingestTaskNotification("s1", "x.ai/task_completed", {
      sessionId: "s1",
      update: {
        sessionUpdate: "task_completed",
        task_snapshot: { taskId: "t1", command: "x", completed: true, exitCode: 0 },
      },
    });
    expect(useTaskStore.getState().getTasks("s1")[0].status).toBe("completed");
  });

  it("keeps completion when task_completed arrives before task_backgrounded", () => {
    ingestTaskNotification("s1", "x.ai/task_completed", {
      sessionId: "s1",
      update: {
        sessionUpdate: "task_completed",
        task_snapshot: { taskId: "late", command: "x", completed: true, exitCode: 0 },
      },
    });
    ingestTaskNotification("s1", "x.ai/task_backgrounded", {
      sessionId: "s1",
      update: { sessionUpdate: "task_backgrounded", task_id: "late", command: "x", cwd: "/r", output_file: "/l" },
    });
    expect(useTaskStore.getState().getTasks("s1")[0].status).toBe("completed");
  });

  it("adds and removes scheduled tasks (replay reconstruction path)", () => {
    ingestTaskNotification("s1", "x.ai/scheduled_task_created", {
      sessionId: "s1",
      update: {
        sessionUpdate: "scheduled_task_created",
        task_id: "sc1",
        prompt: "loop",
        human_schedule: "every 5m",
      },
    });
    expect(useTaskStore.getState().getScheduled("s1")).toHaveLength(1);
    ingestTaskNotification("s1", "x.ai/scheduled_task_deleted", {
      sessionId: "s1",
      update: { sessionUpdate: "scheduled_task_deleted", task_id: "sc1" },
    });
    expect(useTaskStore.getState().getScheduled("s1")).toHaveLength(0);
  });
});
