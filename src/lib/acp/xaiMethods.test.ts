import { describe, expect, it } from "vitest";
import { XAI } from "./xaiMethods";

describe("xaiMethods contract table", () => {
  it("declares mcp/list as a gui->agent request that is not replayed", () => {
    expect(XAI.mcpList).toEqual({
      method: "x.ai/mcp/list",
      direction: "gui->agent",
      kind: "request",
      replayBehavior: "none",
      payloadCase: "camelCase",
    });
  });

  it("declares scheduled_task_created as an agent->gui notification that replays", () => {
    expect(XAI.scheduledTaskCreated.method).toBe("x.ai/scheduled_task_created");
    expect(XAI.scheduledTaskCreated.direction).toBe("agent->gui");
    expect(XAI.scheduledTaskCreated.kind).toBe("notification");
    expect(XAI.scheduledTaskCreated.replayBehavior).toBe("replayed");
  });

  it("declares exit_plan_mode as an agent->gui request", () => {
    expect(XAI.exitPlanMode.direction).toBe("agent->gui");
    expect(XAI.exitPlanMode.kind).toBe("request");
  });

  it("records the real casing for MCP mutations and session updates", () => {
    expect(XAI.mcpToggle.payloadCase).toBe("snake_case");
    expect(XAI.taskBackgrounded.payloadCase).toBe("snake_case");
  });

  it("has a unique method string per entry", () => {
    const methods = Object.values(XAI).map((e) => e.method);
    expect(new Set(methods).size).toBe(methods.length);
  });
});
