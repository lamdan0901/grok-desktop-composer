import { describe, expect, it } from "vitest";
import {
  extractComposerWritePayload,
  extractComposerWritePayloadFromCall,
  shouldApplyComposerFileToolNow,
} from "./composerFileToolLogic";

const PROJECT = "C:\\Users\\test\\desktop-composer";
const TARGET = `${PROJECT}\\test-write.txt`;

describe("extractComposerWritePayload", () => {
  it("parses real tool_call line (Write, no variant)", () => {
    const payload = extractComposerWritePayloadFromCall({
      toolCallId: "call-test",
      title: "Write",
      rawInput: {
        path: TARGET,
        contents: "hello from real log",
      },
    });
    expect(payload).toEqual({
      path: TARGET,
      content: "hello from real log",
      variant: undefined,
    });
  });

  it("parses real tool_call_update with CursorWrite", () => {
    const payload = extractComposerWritePayload({
      toolCallId: "call-test",
      kind: "edit",
      locations: [{ path: TARGET }],
      rawInput: {
        variant: "CursorWrite",
        path: TARGET,
        contents: "hello from real log",
      },
    });
    expect(payload).toEqual({
      path: TARGET,
      content: "hello from real log",
      variant: "CursorWrite",
    });
  });

  it("parses diff-only completed update", () => {
    const payload = extractComposerWritePayload({
      toolCallId: "call-test",
      kind: "edit",
      content: [
        {
          type: "diff",
          path: TARGET,
          oldText: null,
          newText: "from diff block",
        },
      ],
    });
    expect(payload).toEqual({
      path: TARGET,
      content: "from diff block",
      variant: undefined,
    });
  });

  it("returns null when path and content are missing", () => {
    expect(
      extractComposerWritePayload({
        toolCallId: "call-test",
        title: "Read",
        rawInput: { path: TARGET },
      }),
    ).toBeNull();
  });
});

describe("shouldApplyComposerFileToolNow", () => {
  it("defers diff-only updates while in progress", () => {
    const payload = {
      path: TARGET,
      content: "partial",
    };
    expect(
      shouldApplyComposerFileToolNow(
        {
          toolCallId: "call-test",
          kind: "edit",
          status: "in_progress",
          content: [
            {
              type: "diff",
              path: TARGET,
              oldText: "",
              newText: "partial",
            },
          ],
        },
        payload,
      ),
    ).toBe(false);
  });

  it("applies diff-only updates when completed", () => {
    const payload = {
      path: TARGET,
      content: "final",
    };
    expect(
      shouldApplyComposerFileToolNow(
        {
          toolCallId: "call-test",
          kind: "edit",
          status: "completed",
          content: [
            {
              type: "diff",
              path: TARGET,
              oldText: "",
              newText: "final",
            },
          ],
        },
        payload,
      ),
    ).toBe(true);
  });

  it("applies CursorStrReplace when rawInput has new_string", () => {
    const payload = {
      path: TARGET,
      content: "new",
      variant: "CursorStrReplace",
    };
    expect(
      shouldApplyComposerFileToolNow(
        {
          toolCallId: "call-test",
          status: "in_progress",
          rawInput: {
            variant: "CursorStrReplace",
            path: TARGET,
            old_string: "old",
            new_string: "new",
          },
        },
        payload,
      ),
    ).toBe(true);
  });
});