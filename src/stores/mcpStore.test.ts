import { describe, expect, it, beforeEach } from "vitest";
import { useMcpStore } from "./mcpStore";

const server = {
  name: "playwright",
  source: "local" as const,
  type: "stdio" as const,
  command: "npx",
  args: ["@playwright/mcp"],
  session: { enabled: true, status: "ready" as const, tools: [], authRequired: false },
};

describe("mcpStore (read-cache)", () => {
  beforeEach(() => useMcpStore.setState({ serversByTab: {}, initializationByTab: {} }));

  it("stores servers per tab", () => {
    useMcpStore.getState().setServers("tabA", [server]);
    expect(useMcpStore.getState().getServers("tabA")).toHaveLength(1);
    expect(useMcpStore.getState().getServers("tabB")).toHaveLength(0);
  });

  it("applies a per-server status delta without dropping config", () => {
    useMcpStore.getState().setServers("tabA", [server]);
    useMcpStore.getState().applyServerStatus("tabA", {
      name: "playwright",
      status: "unavailable",
    });
    const updated = useMcpStore.getState().getServers("tabA")[0];
    expect(updated.session?.status).toBe("unavailable");
    expect(updated.command).toBe("npx"); // config preserved
  });

  it("tracks initialization progress, failures, completion, and reset", () => {
    useMcpStore.getState().setInitializationProgress("tabA", 4, 0);
    useMcpStore.getState().setInitializationProgress("tabA", 4, 2);
    useMcpStore.getState().applyInitializationServerStatus(
      "tabA",
      "github",
      "unavailable",
    );
    useMcpStore.getState().completeInitialization("tabA");

    expect(useMcpStore.getState().getInitialization("tabA")).toEqual({
      phase: "complete",
      total: 4,
      connected: 2,
      failures: { github: "unavailable" },
    });

    useMcpStore.getState().clearInitialization("tabA");
    expect(useMcpStore.getState().getInitialization("tabA")).toBeUndefined();
  });
});
