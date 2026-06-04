import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  canonicalToolCallId,
  findToolMessageIndex,
  resolveToolCallIdForUpsert,
} from "./toolCallIdentity";

function toolMessage(
  toolCallId: string,
  path?: string,
): Extract<ChatMessage, { role: "tool" }> {
  return {
    id: "m1",
    role: "tool",
    toolCallId,
    title: "Write",
    path,
    status: "running",
  };
}

describe("canonicalToolCallId", () => {
  it("strips composer channel suffix", () => {
    expect(
      canonicalToolCallId("call-abc-composer_call_zVG2x"),
    ).toBe("call-abc");
  });
});

describe("findToolMessageIndex", () => {
  it("matches updates that reuse the call UUID with a new suffix", () => {
    const messages: ChatMessage[] = [
      toolMessage("call-abc-composer_call_zVG2x", "a.ts"),
    ];
    expect(
      findToolMessageIndex(
        messages,
        "call-abc-composer_call_1GL9i",
        "a.ts",
      ),
    ).toBe(0);
  });

  it("merges into a running write row before path is known", () => {
    const messages: ChatMessage[] = [toolMessage("call-abc-composer_call_zVG2x")];
    expect(
      findToolMessageIndex(
        messages,
        "call-abc-composer_call_1GL9i",
        "a.ts",
      ),
    ).toBe(0);
  });

  it("does not merge different files on the same call UUID", () => {
    const messages: ChatMessage[] = [
      toolMessage("call-abc-composer_call_a", "a.ts"),
    ];
    expect(
      findToolMessageIndex(
        messages,
        "call-abc-composer_call_b",
        "b.ts",
      ),
    ).toBe(-1);
  });
});

describe("resolveToolCallIdForUpsert", () => {
  it("reuses the existing row id when suffix differs", () => {
    const messages: ChatMessage[] = [
      toolMessage("call-abc-composer_call_zVG2x", "a.ts"),
    ];
    expect(
      resolveToolCallIdForUpsert(
        messages,
        "call-abc-composer_call_1GL9i",
        "a.ts",
      ),
    ).toBe("call-abc-composer_call_zVG2x");
  });
});