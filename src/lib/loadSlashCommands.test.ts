import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadSlashCommandsForSession } from "./loadSlashCommands";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";

const dispose = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/acp", () => ({
  getTabSession: vi.fn(() => ({
    isReady: true,
    dispose,
  })),
}));

vi.mock("@/lib/ensureAcpForSend", () => ({
  ensureAcpForSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/acp/slashCommandsFromDisk", () => ({
  tryLoadSlashCommandsFromDisk: vi.fn().mockResolvedValue(false),
}));

describe("loadSlashCommandsForSession", () => {
  beforeEach(() => {
    useSlashCommandsStore.setState({ bySession: {}, statusBySession: {} });
    vi.clearAllMocks();
  });

  it("does not reconnect when commands are already cached", async () => {
    const { ensureAcpForSend } = await import("@/lib/ensureAcpForSend");
    useSlashCommandsStore.getState().setCommands("tab-1", [
      { name: "help", description: "Help", input: null },
    ]);

    await loadSlashCommandsForSession("tab-1", "/proj");
    expect(ensureAcpForSend).not.toHaveBeenCalled();
    expect(dispose).not.toHaveBeenCalled();
  });

  it("disposes stale ready agent before connecting", async () => {
    const { ensureAcpForSend } = await import("@/lib/ensureAcpForSend");

    const load = loadSlashCommandsForSession("tab-1", "/proj");
    useSlashCommandsStore.getState().setCommands("tab-1", [
      { name: "compact", description: "Compact", input: null },
    ]);
    await load;

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(ensureAcpForSend).toHaveBeenCalledTimes(1);
  });
});