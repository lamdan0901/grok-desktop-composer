import { describe, expect, it } from "vitest";
import type { SessionUpdate } from "@agentclientprotocol/sdk";
import { textFromSessionContentChunk } from "./sessionUpdates";

describe("textFromSessionContentChunk", () => {
  it("reads user_message_chunk text", () => {
    const update = {
      sessionUpdate: "user_message_chunk",
      content: { type: "text", text: "Fix the login bug" },
    } as SessionUpdate;

    expect(textFromSessionContentChunk(update)).toBe("Fix the login bug");
  });

  it("reads agent_message_chunk and agent_thought_chunk text", () => {
    expect(
      textFromSessionContentChunk({
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "Hello" },
      } as SessionUpdate),
    ).toBe("Hello");

    expect(
      textFromSessionContentChunk({
        sessionUpdate: "agent_thought_chunk",
        content: { type: "text", text: "Thinking…" },
      } as SessionUpdate),
    ).toBe("Thinking…");
  });

  it("returns null for non-content session updates", () => {
    expect(
      textFromSessionContentChunk({
        sessionUpdate: "tool_call",
        toolCallId: "tc1",
        title: "Shell",
        status: "in_progress",
      } as SessionUpdate),
    ).toBeNull();
  });
});