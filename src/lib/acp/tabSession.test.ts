import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTabSession, removeTabSession } from "./tabSession";
import { useSkillStore } from "@/stores/skillStore";
import { useHookStore } from "@/stores/hookStore";
import { useFolderTrustStore } from "@/stores/folderTrustStore";

vi.mock("@/lib/grok", () => ({ startTab: vi.fn(), stopTab: vi.fn() }));

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
});
