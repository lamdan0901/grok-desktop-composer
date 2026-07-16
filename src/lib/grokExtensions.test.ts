import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listGrokSkills, readGrokSkill } from "./grokExtensions";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("grok skill disk bridge", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("normalizes the Rust response", async () => {
    vi.mocked(invoke).mockResolvedValue([{ id: "lint", path: "C:\\skills\\lint", has_skill_md: true }]);
    await expect(listGrokSkills()).resolves.toEqual([
      { id: "lint", path: "C:\\skills\\lint", hasSkillMd: true },
    ]);
  });

  it("rejects traversal before invoking Tauri", async () => {
    await expect(() => readGrokSkill("../secret")).toThrow("Invalid skill id");
    expect(invoke).not.toHaveBeenCalled();
  });
});
