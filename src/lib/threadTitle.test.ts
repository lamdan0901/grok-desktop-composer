import { describe, expect, it } from "vitest";
import type { Session } from "@/lib/types";
import {
  grokTitleSyncedFromSummary,
  shouldFetchGrokSessionTitle,
} from "./threadTitle";

function session(partial: Partial<Session>): Session {
  return {
    id: "s1",
    projectId: "p1",
    title: "New thread",
    status: "idle",
    messages: [],
    acpState: "disconnected",
    agentNodes: [],
    ...partial,
  };
}

describe("shouldFetchGrokSessionTitle", () => {
  it("returns false when Grok title was already synced", () => {
    expect(
      shouldFetchGrokSessionTitle(
        session({ grokSessionId: "g1", grokTitleSynced: true, title: "My task" }),
      ),
    ).toBe(false);
  });

  it("returns true for placeholders still awaiting Grok", () => {
    expect(
      shouldFetchGrokSessionTitle(
        session({ grokSessionId: "g1", title: "New thread" }),
      ),
    ).toBe(true);
  });
});

describe("grokTitleSyncedFromSummary", () => {
  it("treats real summaries as synced", () => {
    expect(grokTitleSyncedFromSummary("Fix diff viewer")).toBe(true);
    expect(grokTitleSyncedFromSummary("New thread")).toBe(false);
  });
});