import { describe, expect, it, vi, beforeEach } from "vitest";
import * as acp from "@/lib/acp";
import { listMcpServers, upsertMcpServer } from "./xaiMcp";
import { useMcpStore } from "@/stores/mcpStore";
import { clearFeatureCache } from "./featureDetection";

describe("xaiMcp wrappers", () => {
  beforeEach(() => {
    useMcpStore.setState({ serversByTab: {} });
    clearFeatureCache("tabA");
  });

  it("lists servers scoped to the tab's grok session and caches them", async () => {
    const extMethod = vi.fn().mockResolvedValue({
      servers: [{ name: "s1", source: "local", type: "stdio", command: "x" }],
    });
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);

    const servers = await listMcpServers("tabA");
    expect(extMethod).toHaveBeenCalledWith("x.ai/mcp/list", { sessionId: "grok-1" });
    expect(servers).toHaveLength(1);
    expect(useMcpStore.getState().getServers("tabA")).toHaveLength(1);
  });

  it("upsert sends the snake_case mutation DTO with flattened config", async () => {
    const extMethod = vi.fn().mockResolvedValue({});
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);

    await upsertMcpServer("tabA", "playwright", {
      type: "stdio",
      command: "npx",
      args: ["@playwright/mcp"],
    });
    expect(extMethod).toHaveBeenCalledWith("x.ai/mcp/upsert", {
      session_id: "grok-1",
      server_name: "playwright",
      type: "stdio",
      command: "npx",
      args: ["@playwright/mcp"],
    });
  });
});
