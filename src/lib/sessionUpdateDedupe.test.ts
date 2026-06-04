import { describe, expect, it, beforeEach } from "vitest";
import {
  clearSessionNotificationDedupe,
  shouldSkipDuplicateSessionNotification,
} from "./sessionUpdateDedupe";

const SESSION = "session-dedupe-test";

describe("shouldSkipDuplicateSessionNotification", () => {
  beforeEach(() => {
    clearSessionNotificationDedupe(SESSION);
  });

  it("does not drop tool_call_update when only content differs", () => {
    const base = {
      update: {
        sessionUpdate: "tool_call_update",
        toolCallId: "call-1",
        status: "",
        title: "Write",
        locations: [{ path: "a.ts" }],
      },
    };

    expect(
      shouldSkipDuplicateSessionNotification(SESSION, base, "session/update"),
    ).toBe(false);

    const withDiff = {
      update: {
        ...base.update,
        content: [
          {
            type: "diff",
            path: "a.ts",
            oldText: "old",
            newText: "new",
          },
        ],
      },
    };

    expect(
      shouldSkipDuplicateSessionNotification(SESSION, withDiff, "session/update"),
    ).toBe(false);
  });
});