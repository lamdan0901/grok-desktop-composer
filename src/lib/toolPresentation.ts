import type { ToolCallLocation, ToolCallStatus, ToolKind } from "@agentclientprotocol/sdk";
import type { AgentNodeStatus, ToolCallDisplayStatus } from "@/lib/types";

export function mapAcpToolStatus(
  status?: ToolCallStatus | null,
): ToolCallDisplayStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "in_progress":
      return "running";
    case "pending":
    default:
      return "pending";
  }
}

export function mapAgentStatusFromTool(
  status: ToolCallDisplayStatus,
): AgentNodeStatus {
  switch (status) {
    case "completed":
      return "done";
    case "failed":
      return "failed";
    case "running":
      return "running";
    default:
      return "idle";
  }
}

export function extractPrimaryPath(
  locations?: Array<ToolCallLocation> | null,
  rawInput?: unknown,
): string | undefined {
  const fromLoc = locations?.[0]?.path;
  if (fromLoc) return fromLoc;
  if (rawInput && typeof rawInput === "object") {
    const input = rawInput as Record<string, unknown>;
    for (const key of ["path", "file", "file_path", "filePath", "target"]) {
      const value = input[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  return undefined;
}

export function basenameFromPath(path: string): string {
  const parts = path.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

const STANDARD_TOOL_KINDS = new Set<ToolKind>([
  "read",
  "edit",
  "delete",
  "move",
  "search",
  "execute",
  "think",
  "fetch",
  "switch_mode",
]);

/** Leading tool label from an ACP title (e.g. `Read 'path'` → `Read`). */
export function toolNameFromTitle(title: string): string {
  const trimmed = title.trim();
  const match = trimmed.match(/^([A-Za-z][\w-]*)/);
  return match?.[1] ?? trimmed;
}

const SUBAGENT_TOOL_NAMES = new Set([
  "task",
  "mcp_task",
  "generalpurpose",
  "code-reviewer",
  "best-of-n-runner",
  "cursor-guide",
]);

export function isSubagentTool(title: string, kind?: ToolKind | string | null): boolean {
  if (kind && STANDARD_TOOL_KINDS.has(kind as ToolKind)) {
    return false;
  }

  const name = toolNameFromTitle(title).toLowerCase();
  if (SUBAGENT_TOOL_NAMES.has(name)) return true;
  if (name === "task" || /^task[:-]/i.test(title.trim())) return true;
  if (/\bsubagent\b/i.test(title)) return true;

  return false;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function toolKindLabel(kind?: ToolKind | string | null): string | null {
  if (!kind) return null;
  return kind.replace(/_/g, " ");
}