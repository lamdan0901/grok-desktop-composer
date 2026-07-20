// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@/lib/acp";
import { clearFeatureCache } from "@/lib/acp/featureDetection";
import { useRewindStore } from "@/stores/rewindStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { RewindPanel } from "./RewindPanel";

describe("RewindPanel", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
    useWorkspaceStore.setState({ activeSessionId: "tab-1" } as never);
    useRewindStore.setState({
      pointsBySession: {},
      loadingBySession: {},
      errorBySession: {},
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hides rewind when the request is unsupported", async () => {
    const extMethod = vi.fn().mockRejectedValue({ code: -32601 });
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);

    render(<RewindPanel />);

    await waitFor(() => expect(extMethod).toHaveBeenCalledOnce());
    expect(screen.queryByRole("button", { name: "Rewind files" })).toBeNull();
  });

  it("hides rewind when the current thread has no points", async () => {
    const extMethod = vi.fn().mockResolvedValue({ points: [] });
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);

    render(<RewindPanel />);

    await waitFor(() =>
      expect(extMethod).toHaveBeenCalledWith("x.ai/rewind/points", {
        sessionId: "grok-1",
      }),
    );
    expect(screen.queryByRole("button", { name: "Rewind files" })).toBeNull();
  });

  it("shows an aligned trigger and Todo-style content when points exist", async () => {
    const extMethod = vi.fn().mockResolvedValue({
      points: [{ id: "p1", label: "Before edit", fileCount: 2 }],
    });
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);

    render(<RewindPanel />);

    const button = await screen.findByRole("button", { name: "Rewind files" });
    expect(button.className).toContain("rewind-panel__trigger");
    expect(button.textContent).toContain("1");

    fireEvent.click(button);

    expect(button.className).toContain("todo-panel__toggle");
    expect(screen.getByText("Before edit · 2 files")).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Rewind files" }));
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

  it("shows operational restore errors", async () => {
    const extMethod = vi
      .fn()
      .mockResolvedValueOnce({ points: [{ id: "p1", label: "Before edit" }] })
      .mockRejectedValueOnce(new Error("Restore failed"));
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<RewindPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Rewind files" }));
    fireEvent.click(await screen.findByRole("button", { name: "Restore Before edit" }));

    expect(await screen.findByText("Restore failed")).toBeTruthy();
  });
});
