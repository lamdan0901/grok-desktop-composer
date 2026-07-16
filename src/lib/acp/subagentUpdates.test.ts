import { describe, expect, it, beforeEach } from "vitest";
import { applySubagentUpdate } from "./subagentUpdates";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function seedSession(id: string) {
  useWorkspaceStore.setState({
    projects: [{ id: "p", cwd: "/r", name: "r" }],
    sessions: [
      {
        id,
        projectId: "p",
        title: "t",
        status: "running",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      },
    ],
    activeSessionId: id,
  } as never);
}

describe("applySubagentUpdate", () => {
  beforeEach(() => seedSession("s1"));

  it("creates an agent node on subagent_spawned", () => {
    const consumed = applySubagentUpdate("s1", {
      sessionUpdate: "subagent_spawned",
      subagent_id: "sub-1",
      parent_session_id: "s1",
      child_session_id: "child-1",
      subagent_type: "explore",
      description: "find files",
    });
    expect(consumed).toBe(true);
    const node = useWorkspaceStore.getState().sessions[0].agentNodes[0];
    expect(node.subagentId).toBe("sub-1");
    expect(node.title).toBe("find files");
    expect(node.status).toBe("running");
  });

  it("marks the node done on subagent_finished(completed)", () => {
    applySubagentUpdate("s1", {
      sessionUpdate: "subagent_spawned",
      subagent_id: "sub-1",
      parent_session_id: "s1",
      child_session_id: "child-1",
      subagent_type: "explore",
      description: "find files",
    });
    applySubagentUpdate("s1", {
      sessionUpdate: "subagent_finished",
      subagent_id: "sub-1",
      child_session_id: "child-1",
      status: "completed",
      output: "done",
    });
    const node = useWorkspaceStore.getState().sessions[0].agentNodes[0];
    expect(node.status).toBe("done");
    expect(node.output).toBe("done");
  });

  it("returns false for a non-subagent update", () => {
    expect(applySubagentUpdate("s1", { sessionUpdate: "agent_message_chunk" })).toBe(false);
  });
});
