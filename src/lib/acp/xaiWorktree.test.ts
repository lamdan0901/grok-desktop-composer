import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeatureCache } from "./featureDetection";
import { forkIntoWorktree } from "./xaiWorktree";

describe("worktree fork pipeline", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
  });

  it("creates the worktree before resuming its session", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ worktreePath: "C:\\repo-worktree" })
      .mockResolvedValueOnce({
        sessionId: "child-2",
        cwd: "C:\\repo-worktree",
      });

    await forkIntoWorktree(
      "tab-1",
      "parent-1",
      "C:\\repo-worktree",
      call,
    );

    expect(call.mock.calls.map(([method]) => method)).toEqual([
      "x.ai/git/worktree/create_from_worktree_sync",
      "x.ai/git/worktree/resume_session",
    ]);
  });
});
