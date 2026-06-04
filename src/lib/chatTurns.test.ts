import { describe, expect, it } from "vitest";
import {
  extractTurnAssistantRawText,
  isTurnAgentActive,
  isTurnResponseStreaming,
  splitMessagesIntoTurns,
} from "./chatTurns";
import type { ChatMessage } from "./types";

function user(content: string, id = "u1"): ChatMessage {
  return { id, role: "user", content };
}

function assistant(content: string, id = "a1"): ChatMessage {
  return { id, role: "assistant", content, streaming: false };
}

describe("splitMessagesIntoTurns", () => {
  it("splits on user messages", () => {
    const turns = splitMessagesIntoTurns([
      user("hi", "u1"),
      assistant("hello", "a1"),
      user("again", "u2"),
      assistant("sure", "a2"),
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]!.messages.map((m) => m.id)).toEqual(["u1", "a1"]);
    expect(turns[1]!.messages.map((m) => m.id)).toEqual(["u2", "a2"]);
  });
});

describe("extractTurnAssistantRawText", () => {
  it("joins assistant bubbles and skips thought/tool", () => {
    const text = extractTurnAssistantRawText([
      user("q"),
      { id: "t1", role: "thought", content: "thinking" },
      {
        id: "tool1",
        role: "tool",
        toolCallId: "tc1",
        title: "Shell",
        status: "completed",
      },
      assistant("Part one", "a1"),
      assistant("Part two", "a2"),
    ]);
    expect(text).toBe("Part one\n\nPart two");
  });
});

describe("isTurnResponseStreaming", () => {
  it("is true while assistant or activity is in flight", () => {
    expect(
      isTurnResponseStreaming([
        user("q"),
        { id: "a1", role: "assistant", content: "…", streaming: true },
      ]),
    ).toBe(true);
    expect(
      isTurnResponseStreaming([
        user("q"),
        {
          id: "tool1",
          role: "tool",
          toolCallId: "tc1",
          title: "Shell",
          status: "running",
        },
      ]),
    ).toBe(true);
  });
});

describe("isTurnAgentActive", () => {
  it("stays true between tool bursts while the session is running", () => {
    expect(
      isTurnAgentActive(
        [
          user("q"),
          {
            id: "tool1",
            role: "tool",
            toolCallId: "tc1",
            title: "Shell",
            status: "completed",
          },
        ],
        { sessionStatus: "running" },
      ),
    ).toBe(true);
  });

  it("is false for older turns even when the session is running", () => {
    expect(
      isTurnAgentActive(
        [
          user("q"),
          {
            id: "tool1",
            role: "tool",
            toolCallId: "tc1",
            title: "Shell",
            status: "completed",
          },
        ],
        { sessionStatus: undefined },
      ),
    ).toBe(false);
  });
});