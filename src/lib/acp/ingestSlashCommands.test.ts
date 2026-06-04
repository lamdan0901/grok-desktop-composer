import { describe, expect, it, beforeEach } from "vitest";
import { ingestSlashCommandsFromAcpLine } from "./ingestSlashCommands";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";

describe("ingestSlashCommandsFromAcpLine", () => {
  beforeEach(() => {
    useSlashCommandsStore.setState({ bySession: {}, statusBySession: {} });
  });

  it("stores commands from session/update notification lines", () => {
    const line = JSON.stringify({
      method: "session/update",
      params: {
        sessionId: "grok-id",
        update: {
          sessionUpdate: "available_commands_update",
          availableCommands: [
            { name: "compact", description: "Compact", input: null },
          ],
        },
      },
    });

    ingestSlashCommandsFromAcpLine("tab-1", line);
    expect(useSlashCommandsStore.getState().bySession["tab-1"]).toHaveLength(1);
  });
});