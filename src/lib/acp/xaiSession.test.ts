import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeatureCache } from "./featureDetection";
import { deleteSession, forkSession, renameSession } from "./xaiSession";

describe("plain session actions", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
  });

  it("uses plain session/fork without a worktree field", async () => {
    const extMethod = vi.fn().mockResolvedValue({
      sessionId: "child-1",
      title: "Fork",
    });

    await forkSession("tab-1", "parent-1", extMethod);

    expect(extMethod).toHaveBeenCalledWith("x.ai/session/fork", {
      sessionId: "parent-1",
    });
    expect(extMethod.mock.calls[0][1]).not.toHaveProperty("worktree");
  });

  it("returns false for unsupported rename and delete", async () => {
    const extMethod = vi.fn().mockRejectedValue({ code: -32601 });

    await expect(renameSession("tab-1", "s1", "New", extMethod)).resolves.toBe(false);
    await expect(deleteSession("tab-1", "s1", extMethod)).resolves.toBe(false);
  });
});
