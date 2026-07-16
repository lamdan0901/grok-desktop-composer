import { describe, expect, it } from "vitest";
import { routeExtNotification } from "./extNotificationRouter";

describe("routeExtNotification", () => {
  it("consumes a dedicated task_backgrounded notification", () => {
    const consumed = routeExtNotification("s1", "x.ai/task_backgrounded", {
      sessionId: "s1",
      update: {
        sessionUpdate: "task_backgrounded",
        tool_call_id: "tc1",
        task_id: "t1",
        command: "npm run dev",
        cwd: "/repo",
        output_file: "/repo/.grok/logs/t1.log",
      },
    });
    expect(consumed).toBe(true);
  });

  it("does NOT consume the generic session/update envelope", () => {
    const consumed = routeExtNotification("s1", "x.ai/session/update", {
      sessionId: "s1",
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hi" } },
    });
    expect(consumed).toBe(false);
  });

  it("consumes scheduled_task_created", () => {
    expect(
      routeExtNotification("s1", "x.ai/scheduled_task_created", {
        sessionId: "s1",
        update: {
          sessionUpdate: "scheduled_task_created",
          task_id: "sc1",
          prompt: "loop",
          human_schedule: "every 5m",
        },
      }),
    ).toBe(true);
  });
});
