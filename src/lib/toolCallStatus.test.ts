import { describe, expect, it } from "vitest";
import { mergeToolCallStatus } from "./toolCallStatus";

describe("mergeToolCallStatus", () => {
  it("upgrades failed to completed when the client already applied the edit", () => {
    expect(mergeToolCallStatus("failed", "failed", true)).toBe("completed");
  });

  it("keeps failed when the client did not apply", () => {
    expect(mergeToolCallStatus("failed", "running", false)).toBe("failed");
  });

  it("preserves existing status when the update omits status", () => {
    expect(mergeToolCallStatus(undefined, "completed", false)).toBe("completed");
    expect(mergeToolCallStatus(undefined, "failed", false)).toBe("failed");
  });

  it("defaults to running for new tool rows", () => {
    expect(mergeToolCallStatus(undefined, undefined, false)).toBe("running");
  });
});