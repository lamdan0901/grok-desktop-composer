import { describe, expect, it } from "vitest";
import { formatPlanComments } from "./planComments";

describe("formatPlanComments", () => {
  it("formats comments deterministically", () => {
    expect(
      formatPlanComments([
        { id: "c2", line: 12, text: "Use the shared helper." },
        { id: "c1", line: 3, text: "Add a test." },
      ]),
    ).toBe("Line 3: Add a test.\nLine 12: Use the shared helper.");
  });

  it("returns an empty string for no comments", () => {
    expect(formatPlanComments([])).toBe("");
  });
});
