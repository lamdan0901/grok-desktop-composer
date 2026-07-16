// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { SessionHistoryPanel } from "./SessionHistoryPanel";

const { listGrokSessions, renameSession } = vi.hoisted(() => ({
  listGrokSessions: vi.fn(),
  renameSession: vi.fn(),
}));

vi.mock("@/lib/grok", () => ({
  listGrokSessions,
  resolveGrokSessionCwd: vi.fn(),
}));
vi.mock("@/lib/acp/xaiSession", () => ({
  renameSession,
  deleteSession: vi.fn(),
  forkSession: vi.fn(),
}));

describe("SessionHistoryPanel actions", () => {
  beforeEach(() => {
    listGrokSessions.mockReset().mockResolvedValue([
      { id: "history-1", summary: "Old title", cwd: "C:\\repo" },
    ]);
    renameSession.mockReset().mockResolvedValue(true);
    useWorkspaceStore.setState({
      projects: [{ id: "p1", cwd: "C:\\repo", name: "repo" }],
      sessions: [{
        id: "tab-1",
        projectId: "p1",
        title: "Open tab",
        grokSessionId: "open-1",
        status: "idle",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      }],
      activeSessionId: "tab-1",
      activeProjectId: "p1",
    });
    vi.stubGlobal("prompt", vi.fn().mockReturnValue("New title"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renames through grok before updating the history row", async () => {
    render(<SessionHistoryPanel open onClose={vi.fn()} />);
    await screen.findByText("Old title");

    fireEvent.click(screen.getByRole("button", { name: "Actions for Old title" }));
    fireEvent.click(screen.getByText("Rename session"));

    await waitFor(() =>
      expect(renameSession).toHaveBeenCalledWith(
        "tab-1",
        "history-1",
        "New title",
      ),
    );
    expect(await screen.findByText("New title")).toBeTruthy();
  });
});
