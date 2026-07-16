import type { SessionId, AgentNodeStatus } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function statusFromFinished(status: string): AgentNodeStatus {
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "failed";
  return "done";
}

/**
 * Apply a subagent lifecycle update (generic-envelope `sessionUpdate` tag).
 * Returns true if the update was a subagent event (consumed), false otherwise.
 */
export function applySubagentUpdate(
  sessionId: SessionId,
  update: Record<string, unknown>,
): boolean {
  const kind = update.sessionUpdate;
  const store = useWorkspaceStore.getState();

  if (kind === "subagent_spawned") {
    const subagentId = String(update.subagent_id ?? "");
    if (!subagentId) return true;
    store.upsertAgentNode(sessionId, {
      id: subagentId,
      title: String(update.description ?? update.subagent_type ?? "Subagent"),
      status: "running",
      kind: String(update.subagent_type ?? "subagent"),
    });
    patchNode(sessionId, subagentId, {
      subagentId,
      childSessionId: String(update.child_session_id ?? ""),
      subagentType: String(update.subagent_type ?? ""),
    });
    return true;
  }

  if (kind === "subagent_progress") {
    const subagentId = String(update.subagent_id ?? "");
    if (!subagentId) return true;
    patchNode(sessionId, subagentId, {
      contextUsagePct:
        typeof update.context_usage_pct === "number" ? update.context_usage_pct : undefined,
    });
    store.setAgentNodeStatus(sessionId, subagentId, "running");
    return true;
  }

  if (kind === "subagent_finished") {
    const subagentId = String(update.subagent_id ?? "");
    if (!subagentId) return true;
    store.setAgentNodeStatus(
      sessionId,
      subagentId,
      statusFromFinished(String(update.status ?? "completed")),
    );
    if (typeof update.output === "string") {
      patchNode(sessionId, subagentId, { output: update.output });
    }
    return true;
  }

  return false;
}

/** Patch extra AgentNode fields not covered by upsertAgentNode's shape. */
function patchNode(
  sessionId: SessionId,
  nodeId: string,
  patch: Record<string, unknown>,
): void {
  useWorkspaceStore.setState((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            agentNodes: s.agentNodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
          }
        : s,
    ),
  }));
}
