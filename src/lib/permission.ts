import type {
  PermissionOption,
  PermissionOptionKind,
  RequestPermissionRequest,
} from "@agentclientprotocol/sdk";
import {
  basenameFromPath,
  extractPrimaryPath,
  toolKindLabel,
} from "@/lib/toolPresentation";

export interface PermissionToolSummary {
  title: string;
  kindLabel: string | null;
  path: string | null;
}

export function summarizePermissionTool(
  request: RequestPermissionRequest,
): PermissionToolSummary {
  const { toolCall } = request;
  const path =
    extractPrimaryPath(toolCall.locations, toolCall.rawInput) ?? null;
  const title =
    toolCall.title?.trim() ||
    (path ? basenameFromPath(path) : "Tool execution");
  return {
    title,
    kindLabel: toolKindLabel(toolCall.kind),
    path,
  };
}

const KIND_FALLBACK_LABELS: Record<PermissionOptionKind, string> = {
  allow_once: "Allow once",
  allow_always: "Always allow",
  reject_once: "Deny",
  reject_always: "Always deny",
};

export function permissionOptionLabel(option: PermissionOption): string {
  const trimmed = option.name?.trim();
  if (trimmed) return trimmed;
  return KIND_FALLBACK_LABELS[option.kind] ?? option.kind;
}

export function isAllowOption(kind: PermissionOptionKind): boolean {
  return kind === "allow_once" || kind === "allow_always";
}

export function pickAutoApproveOption(
  options: PermissionOption[],
): PermissionOption | null {
  return (
    options.find((o) => o.kind === "allow_always") ??
    options.find((o) => o.kind === "allow_once") ??
    null
  );
}