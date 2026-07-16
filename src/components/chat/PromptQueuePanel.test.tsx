// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ingestQueueSnapshot, useQueueStore } from "@/stores/queueStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PromptQueuePanel } from "./PromptQueuePanel";

const { removeQueuedPrompt } = vi.hoisted(() => ({
  removeQueuedPrompt: vi.fn(),
}));

vi.mock("@/lib/acp/xaiQueue", () => ({
  removeQueuedPrompt,
  reorderQueuedPrompt: vi.fn(),
  clearQueuedPrompts: vi.fn(),
  promoteQueuedPrompt: vi.fn(),
}));

describe("PromptQueuePanel", () => {
  beforeEach(() => {
    removeQueuedPrompt.mockReset().mockResolvedValue(true);
    useQueueStore.setState({ bySession: {} });
    useWorkspaceStore.setState({ activeSessionId: "tab-1" } as never);
    ingestQueueSnapshot("tab-1", {
      queue: [
        { id: "q1", text: "First" },
        { id: "q2", text: "Second" },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders authoritative order and sends remove without changing it locally", async () => {
    render(<PromptQueuePanel />);

    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("First"),
      expect.stringContaining("Second"),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Remove First" }));

    await waitFor(() =>
      expect(removeQueuedPrompt).toHaveBeenCalledWith("tab-1", "q1"),
    );
    expect(screen.getByText("First")).toBeTruthy();
  });

  it("shows operational queue errors", async () => {
    removeQueuedPrompt.mockRejectedValueOnce(new Error("Queue update failed"));
    render(<PromptQueuePanel />);

    fireEvent.click(screen.getByRole("button", { name: "Remove First" }));

    expect(await screen.findByText("Queue update failed")).toBeTruthy();
  });
});
