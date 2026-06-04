import { describe, expect, it } from "vitest";
import { collapseCurrentTurnActivity } from "./groupTurnActivity";
import type { ChatMessage } from "./types";

describe("collapseCurrentTurnActivity", () => {
  it("only collapses activity in the current turn", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "first" },
      {
        id: "t1",
        role: "thought",
        content: "old thought",
        turnCollapsed: true,
      },
      { id: "u2", role: "user", content: "second" },
      {
        id: "t2",
        role: "thought",
        content: "new thought",
        streaming: false,
      },
      {
        id: "tool1",
        role: "tool",
        toolCallId: "tc1",
        title: "Shell",
        status: "completed",
      },
    ];

    const next = collapseCurrentTurnActivity(messages);
    expect(next[1]).toMatchObject({ id: "t1", turnCollapsed: true });
    expect(next[3]).toMatchObject({ id: "t2", turnCollapsed: true });
    expect(next[4]).toMatchObject({ id: "tool1", turnCollapsed: true });
  });

  it("skips in-progress thought and tool rows", () => {
    const messages: ChatMessage[] = [
      { id: "u1", role: "user", content: "q" },
      { id: "t1", role: "thought", content: "…", streaming: true },
      {
        id: "tool1",
        role: "tool",
        toolCallId: "tc1",
        title: "Shell",
        status: "running",
      },
    ];

    const next = collapseCurrentTurnActivity(messages);
    expect(next[1]).toMatchObject({ streaming: true });
    expect(next[1]).not.toHaveProperty("turnCollapsed");
    expect(next[2]).toMatchObject({ status: "running" });
    expect(next[2]).not.toHaveProperty("turnCollapsed");
  });
});