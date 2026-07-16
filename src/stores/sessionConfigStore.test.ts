import { beforeEach, describe, expect, it } from "vitest";
import { useSessionConfigStore } from "./sessionConfigStore";
import type { SessionModelState } from "@/lib/sessionModel";

const models: SessionModelState = {
  currentModelId: "fast",
  availableModels: [
    {
      modelId: "fast",
      meta: {
        supportsReasoningEffort: true,
        reasoningEfforts: [{ value: "low", label: "Low", default: true }],
      },
    },
    {
      modelId: "smart",
      meta: {
        supportsReasoningEffort: true,
        reasoningEfforts: [
          { value: "high", label: "High", default: false },
          { value: "xhigh", label: "Xhigh", default: true },
        ],
      },
    },
  ],
};

describe("sessionConfigStore effort options", () => {
  beforeEach(() =>
    useSessionConfigStore.setState({ bySession: {}, modelsBySession: {} }),
  );

  it("returns the selected model's effort menu", () => {
    useSessionConfigStore.getState().setSessionModels("s1", models);
    expect(
      useSessionConfigStore.getState().getEffortOptions("s1").map((e) => e.value),
    ).toEqual(["low"]);
  });

  it("switches the menu when currentModelId changes", () => {
    useSessionConfigStore.getState().setSessionModels("s1", models);
    useSessionConfigStore.getState().setCurrentModel("s1", "smart");
    expect(
      useSessionConfigStore.getState().getEffortOptions("s1").map((e) => e.value),
    ).toEqual(["high", "xhigh"]);
  });

  it("returns [] for a session with no model state", () => {
    expect(useSessionConfigStore.getState().getEffortOptions("nope")).toEqual([]);
  });

  it("tracks the selected model's current reasoning effort", () => {
    useSessionConfigStore.getState().setSessionModels("s1", models);
    expect(useSessionConfigStore.getState().getCurrentEffort("s1")).toBeUndefined();

    useSessionConfigStore.getState().setCurrentEffort("s1", "low");

    expect(useSessionConfigStore.getState().getCurrentEffort("s1")).toBe("low");
    expect(
      useSessionConfigStore
        .getState()
        .modelsBySession.s1.availableModels[0]?.meta?.reasoningEffort,
    ).toBe("low");
  });
});
