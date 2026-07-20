import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTabSession, removeTabSession } from "./tabSession";
import { useSkillStore } from "@/stores/skillStore";
import { useHookStore } from "@/stores/hookStore";
import { useFolderTrustStore } from "@/stores/folderTrustStore";

vi.mock("@/lib/grok", () => ({ startTab: vi.fn(), stopTab: vi.fn() }));
vi.mock("@/lib/syncGrokSessionTitle", () => ({
  refreshTitleAfterTurn: vi.fn(),
  startTitleRefreshWhileTurn: vi.fn(),
  stopTitleRefreshWhileTurn: vi.fn(),
}));
vi.mock("@/lib/syncGrokSessionUsage", () => ({
  refreshUsageAfterTurn: vi.fn(),
}));
vi.mock("./xaiRewind", () => ({ listRewindPoints: vi.fn().mockResolvedValue([]) }));

describe("TabAcpSession extension lifecycle", () => {
  beforeEach(() => {
    useSkillStore.setState({ skillsByTab: {}, diskById: {}, loadingByTab: {}, errorByTab: {} });
    useHookStore.setState({ hooksByTab: {}, loadingByTab: {}, errorByTab: {} });
    useFolderTrustStore.setState({ pendingBySession: {} });
  });

  it("clears extension read-caches when a tab is disposed", async () => {
    useSkillStore.getState().setSkills("tab-1", [{ id: "lint", name: "Lint", enabled: true }]);
    useHookStore.getState().setHooks("tab-1", [{ id: "h1", name: "PreToolUse", enabled: true, trusted: true }]);
    getTabSession("tab-1");
    await removeTabSession("tab-1");
    expect(useSkillStore.getState().skillsByTab["tab-1"]).toBeUndefined();
    expect(useHookStore.getState().hooksByTab["tab-1"]).toBeUndefined();
  });

  it("prepends image-read guidance to every prompt", async () => {
    const prompt = vi.fn().mockResolvedValue({ stopReason: "end_turn" });
    const session = getTabSession("tab-prompt");
    Object.assign(session, {
      connection: { prompt },
      sessionId: "grok-1",
      boundCwd: "C:\\repo",
      state: "ready",
      agentAttached: true,
    });

    await session.sendPrompt("Inspect it", [
      { type: "text", text: "Inspect it" },
      { type: "image", mimeType: "image/png", data: "AAEC" },
    ]);

    expect(prompt).toHaveBeenCalledWith({
      sessionId: "grok-1",
      prompt: [
        {
          type: "text",
          text: "If reading an image file fails, treat that as normal and inspect the image already included in the prompt.",
        },
        { type: "text", text: "Inspect it" },
        { type: "image", mimeType: "image/png", data: "AAEC" },
      ],
    });
  });
});
