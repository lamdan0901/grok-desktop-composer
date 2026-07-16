import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeatureCache } from "./featureDetection";
import { listHooks, listSkills, runHookAction, setSkillEnabled } from "./xaiExtensions";

const extMethod = vi.fn();
vi.mock("@/lib/acp", () => ({
  getTabSession: () => ({ grokSessionId: "grok-1", extMethod }),
}));

describe("Phase 3 extension requests", () => {
  beforeEach(() => {
    extMethod.mockReset();
    clearFeatureCache("tab-1");
  });

  it("lists and normalizes skills", async () => {
    extMethod.mockResolvedValue({ skills: [{ id: "lint", name: "Lint", enabled: true }] });
    await expect(listSkills("tab-1")).resolves.toEqual([
      { id: "lint", name: "Lint", enabled: true, description: undefined, source: undefined, path: undefined },
    ]);
    expect(extMethod).toHaveBeenCalledWith("x.ai/skills/list", { sessionId: "grok-1" });
  });

  it("uses the enable endpoint and hides it after method_not_found", async () => {
    extMethod.mockRejectedValue({ code: -32601, message: "Method not found" });
    await expect(setSkillEnabled("tab-1", "lint", true)).resolves.toBe(false);
    await expect(setSkillEnabled("tab-1", "lint", true)).resolves.toBe(false);
    expect(extMethod).toHaveBeenCalledTimes(1);
  });

  it("lists hooks and sends action payload through grok", async () => {
    extMethod.mockResolvedValueOnce({ hooks: [{ id: "pre-tool", name: "PreToolUse", trusted: true }] });
    await expect(listHooks("tab-1")).resolves.toEqual([
      { id: "pre-tool", name: "PreToolUse", event: undefined, enabled: true, source: undefined, trusted: true },
    ]);
    extMethod.mockResolvedValue({ ok: true });
    await expect(runHookAction("tab-1", "pre-tool", "disable")).resolves.toBe(true);
    expect(extMethod).toHaveBeenCalledWith("x.ai/hooks/action", {
      session_id: "grok-1",
      hook_id: "pre-tool",
      action: "disable",
    });
  });
});
