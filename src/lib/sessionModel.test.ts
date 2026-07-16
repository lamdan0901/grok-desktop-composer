import { describe, expect, it } from "vitest";
import { parseReasoningEfforts } from "./sessionModel";

describe("parseReasoningEfforts", () => {
  it("returns [] when the model does not support effort", () => {
    expect(parseReasoningEfforts({ supportsReasoningEffort: false })).toEqual([]);
  });

  it("maps the model-declared effort list preserving order and default", () => {
    const meta = {
      supportsReasoningEffort: true,
      reasoningEfforts: [
        { id: "low", value: "low", label: "Low", default: false },
        { id: "high", value: "high", label: "High", default: true },
      ],
    };
    expect(parseReasoningEfforts(meta)).toEqual([
      { value: "low", label: "Low", isDefault: false },
      { value: "high", label: "High", isDefault: true },
    ]);
  });

  it("accepts bare-string entries without inventing missing levels", () => {
    const meta = { supportsReasoningEffort: true, reasoningEfforts: ["minimal", "xhigh"] };
    expect(parseReasoningEfforts(meta).map((e) => e.value)).toEqual(["minimal", "xhigh"]);
  });
});
