// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@/lib/acp";
import { clearFeatureCache } from "@/lib/acp/featureDetection";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { RewindPanel } from "./RewindPanel";

describe("RewindPanel", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
    useWorkspaceStore.setState({ activeSessionId: "tab-1" } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders no restore UI when rewind is unsupported", async () => {
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod: vi.fn().mockRejectedValue({ code: -32601 }),
    } as unknown as acp.TabAcpSession);

    render(<RewindPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Rewind files" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /restore/i })).toBeNull(),
    );
  });

  it("confirms restore and calls rewind execute once", async () => {
    const extMethod = vi
      .fn()
      .mockResolvedValueOnce({ points: [{ id: "p1", label: "Before edit" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ points: [] });
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<RewindPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Rewind files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restore Before edit" }));

    await waitFor(() =>
      expect(extMethod).toHaveBeenCalledWith("x.ai/rewind/execute", {
        sessionId: "grok-1",
        pointId: "p1",
      }),
    );
    expect(
      extMethod.mock.calls.filter(([method]) => method === "x.ai/rewind/execute"),
    ).toHaveLength(1);
  });
});
