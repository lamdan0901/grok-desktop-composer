import { beforeEach, describe, expect, it, vi } from "vitest";
import { tryLoadSlashCommandsFromDisk } from "./slashCommandsFromDisk";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";

vi.mock("@/lib/sessions", () => ({
  readGrokUpdatesJsonl: vi.fn(),
}));

describe("tryLoadSlashCommandsFromDisk", () => {
  beforeEach(() => {
    useSlashCommandsStore.setState({ bySession: {}, statusBySession: {} });
    vi.clearAllMocks();
  });

  it("loads commands from updates.jsonl lines", async () => {
    const { readGrokUpdatesJsonl } = await import("@/lib/sessions");
    vi.mocked(readGrokUpdatesJsonl).mockResolvedValue(
      JSON.stringify({
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "available_commands_update",
            availableCommands: [
              { name: "compact", description: "Compact", input: null },
            ],
          },
        },
      }),
    );

    const ok = await tryLoadSlashCommandsFromDisk(
      "tab-1",
      "grok-sess",
      "/proj",
    );
    expect(ok).toBe(true);
    expect(useSlashCommandsStore.getState().bySession["tab-1"]).toHaveLength(1);
  });
});