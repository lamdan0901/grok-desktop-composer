// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SkillsPanel } from "./SkillsPanel";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useSkillStore } from "@/stores/skillStore";

vi.mock("@/lib/acp/xaiExtensions", () => ({
  listSkills: vi.fn().mockResolvedValue([{ id: "lint", name: "Lint", enabled: true }]),
  setSkillEnabled: vi.fn().mockResolvedValue(true),
  refreshSkills: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/grokExtensions", () => ({
  listGrokSkills: vi.fn().mockResolvedValue([{ id: "lint", path: "C:\\Users\\me\\.grok\\skills\\lint", hasSkillMd: true }]),
  readGrokSkill: vi.fn().mockResolvedValue("# Lint\nUse the linter."),
}));

describe("SkillsPanel", () => {
  beforeEach(() => {
    cleanup();
    useWorkspaceStore.setState({ activeSessionId: "s1" } as never);
    useSkillStore.setState({ skillsByTab: {}, diskById: {}, loadingByTab: {}, errorByTab: {} });
  });

  it("lists skills, previews SKILL.md, and exposes create-skill", async () => {
    render(<SkillsPanel />);
    expect(await screen.findByText("Lint")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View skill instructions" }));
    expect(await screen.findByText(/Use the linter/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create a skill" })).toBeTruthy();
  });

  it("requires confirmation before enabling code supplied by a skill", async () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    render(<SkillsPanel />);
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Disable Lint" })).toBeTruthy());
    fireEvent.click(screen.getByRole("checkbox", { name: "Disable Lint" }));
    expect(window.confirm).toHaveBeenCalled();
  });
});
