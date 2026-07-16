// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as acp from "@/lib/acp";
import { McpServersPanel } from "./McpServersPanel";
import { useMcpStore } from "@/stores/mcpStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { clearFeatureCache } from "@/lib/acp/featureDetection";

function mockSession(extMethod: ReturnType<typeof vi.fn>) {
  vi.spyOn(acp, "getTabSession").mockReturnValue({
    grokSessionId: "grok-1",
    extMethod,
  } as unknown as acp.TabAcpSession);
}

describe("McpServersPanel", () => {
  beforeEach(() => {
    useMcpStore.setState({ serversByTab: {} });
    useWorkspaceStore.setState({ activeSessionId: "s1" } as never);
    clearFeatureCache("s1");
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("confirms then sends a snake_case upsert DTO when adding a server", async () => {
    const extMethod = vi.fn().mockResolvedValue({ servers: [] });
    mockSession(extMethod);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<McpServersPanel />);
    await waitFor(() => expect(screen.getByLabelText("Add MCP server")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Server name"), {
      target: { value: "playwright" },
    });
    fireEvent.change(screen.getByLabelText("Command"), { target: { value: "npx" } });
    fireEvent.change(screen.getByLabelText("Arguments"), {
      target: { value: "@playwright/mcp" },
    });
    fireEvent.click(screen.getByText("Add server"));

    await waitFor(() =>
      expect(extMethod).toHaveBeenCalledWith("x.ai/mcp/upsert", {
        session_id: "grok-1",
        server_name: "playwright",
        type: "stdio",
        command: "npx",
        args: ["@playwright/mcp"],
      }),
    );
    expect(window.confirm).toHaveBeenCalled();
  });

  it("renders nothing when the list method is unsupported", async () => {
    const extMethod = vi
      .fn()
      .mockRejectedValue({ code: -32601, message: "Method not found" });
    mockSession(extMethod);

    const { container } = render(<McpServersPanel />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
