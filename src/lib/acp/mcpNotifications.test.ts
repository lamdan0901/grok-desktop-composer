import { describe, expect, it, beforeEach } from "vitest";
import { routeMcpNotification } from "./mcpNotifications";
import { useMcpStore } from "@/stores/mcpStore";

describe("routeMcpNotification", () => {
  beforeEach(() => useMcpStore.setState({ serversByTab: {} }));

  it("replaces the catalog on servers_updated", () => {
    const consumed = routeMcpNotification("tabA", "x.ai/mcp/servers_updated", {
      mcpServers: [{ name: "s1", source: "local", type: "stdio", command: "x" }],
    });
    expect(consumed).toBe(true);
    expect(useMcpStore.getState().getServers("tabA")).toHaveLength(1);
  });

  it("applies a per-server status delta", () => {
    useMcpStore.getState().setServers("tabA", [
      {
        name: "s1",
        source: "local",
        type: "stdio",
        command: "x",
        session: { enabled: true, status: "ready", tools: [], authRequired: false },
      },
    ]);
    routeMcpNotification("tabA", "x.ai/mcp/server_status", { name: "s1", status: "unavailable" });
    expect(useMcpStore.getState().getServers("tabA")[0].session?.status).toBe("unavailable");
  });

  it("returns false for a non-MCP method", () => {
    expect(routeMcpNotification("tabA", "x.ai/task_backgrounded", {})).toBe(false);
  });
});
