import type { ToolCallDisplayStatus } from "@/lib/types";

/**
 * Merge ACP tool status with an existing transcript row.
 * Client-side file apply can succeed (or be a noop) while the agent still reports failed.
 */
export function mergeToolCallStatus(
  incoming: ToolCallDisplayStatus | undefined,
  existing: ToolCallDisplayStatus | undefined,
  clientApplied: boolean,
): ToolCallDisplayStatus {
  if (incoming === "failed" && clientApplied) return "completed";
  if (incoming != null) return incoming;
  if (existing != null) return existing;
  return "running";
}