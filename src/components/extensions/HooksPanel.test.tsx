// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HooksPanel } from "./HooksPanel";
import { useHookStore } from "@/stores/hookStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

vi.mock("@/lib/acp/xaiExtensions", () => ({
  listHooks: vi.fn().mockResolvedValue([{ id: "pre-tool", name: "PreToolUse", enabled: true, trusted: true }]),
  runHookAction: vi.fn().mockResolvedValue(true),
}));

describe("HooksPanel", () => {
  beforeEach(() => {
    cleanup();
    useWorkspaceStore.setState({ activeSessionId: "s1" } as never);
    useHookStore.setState({ hooksByTab: {}, loadingByTab: {}, errorByTab: {} });
  });

  it("confirms before enabling a hook and renders trust state", async () => {
    render(<HooksPanel />);
    expect(await screen.findByText("PreToolUse")).toBeTruthy();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    fireEvent.click(screen.getByRole("button", { name: "Enable PreToolUse" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("run code"));
    expect(screen.getByText(/Trusted/)).toBeTruthy();
  });
});
