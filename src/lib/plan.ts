import type { PlanEntry } from "@agentclientprotocol/sdk";
import type { PermissionOption, RequestPermissionRequest } from "@agentclientprotocol/sdk";
import { getTabSession } from "@/lib/acp";
import { ensureAcpForSend } from "@/lib/ensureAcpForSend";
import { readPlanFile, resolvePlanPath, unwatchPlanFile, watchPlanFile } from "@/lib/grok";
import { isAllowOption } from "@/lib/permission";
import { usePermissionStore } from "@/stores/permissionStore";
import { usePlanStore } from "@/stores/planStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { SessionId } from "@/lib/types";

const APPROVE_PROMPT =
  "Approve the plan and proceed with implementation.";
const REVISE_PREFIX = "Please revise the plan";

export function planEntriesToMarkdown(entries: PlanEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((entry) => {
    const box =
      entry.status === "completed"
        ? "x"
        : entry.status === "in_progress"
          ? "→"
          : " ";
    const priority =
      entry.priority !== "medium" ? ` (${entry.priority})` : "";
    return `- [${box}]${priority} ${entry.content}`;
  });
  return lines.join("\n");
}

export function isPlanPermissionRequest(
  request: RequestPermissionRequest,
): boolean {
  const title = request.toolCall.title?.toLowerCase() ?? "";
  const kind = request.toolCall.kind?.toLowerCase() ?? "";
  return (
    title.includes("plan") ||
    kind.includes("plan") ||
    kind === "create_plan"
  );
}

export function pickPlanApproveOption(
  options: PermissionOption[],
): PermissionOption | null {
  const named = options.find((o) => {
    const name = o.name?.toLowerCase() ?? "";
    return (
      isAllowOption(o.kind) &&
      (name.includes("approve") ||
        name.includes("build") ||
        name.includes("proceed"))
    );
  });
  return (
    named ??
    options.find((o) => o.kind === "allow_once") ??
    options.find((o) => o.kind === "allow_always") ??
    null
  );
}

export function pickPlanReviseOption(
  options: PermissionOption[],
): PermissionOption | null {
  const named = options.find((o) => {
    const name = o.name?.toLowerCase() ?? "";
    return (
      !isAllowOption(o.kind) &&
      (name.includes("revise") ||
        name.includes("reject") ||
        name.includes("rewrite"))
    );
  });
  return (
    named ??
    options.find((o) => o.kind === "reject_once") ??
    options.find((o) => o.kind === "reject_always") ??
    null
  );
}

export async function syncPlanFromDisk(
  sessionId: SessionId,
  cwd: string,
  grokSessionId: string,
): Promise<void> {
  const path = await resolvePlanPath(cwd, grokSessionId);
  const content = await readPlanFile(path);
  usePlanStore.getState().setPlan(sessionId, { path, content });
  await watchPlanFile(sessionId, path);
}

export function clearPlanWatch(sessionId: SessionId): void {
  usePlanStore.getState().clearPlan(sessionId);
  void unwatchPlanFile(sessionId);
}

export async function approvePlan(
  sessionId: SessionId,
  cwd: string,
): Promise<void> {
  const workspace = useWorkspaceStore.getState();
  const pending = usePermissionStore.getState().pendingBySession[sessionId];

  if (pending && isPlanPermissionRequest(pending.request)) {
    const option = pickPlanApproveOption(pending.request.options);
    if (option) {
      usePermissionStore.getState().respond(sessionId, option);
      exitPlanReview(sessionId);
      return;
    }
  }

  workspace.addUserMessage(sessionId, APPROVE_PROMPT);
  workspace.setSessionStatus(sessionId, "running");

  const grokSessionId = workspace.sessions.find((s) => s.id === sessionId)
    ?.grokSessionId;
  try {
    await ensureAcpForSend(sessionId, cwd, grokSessionId);
    await getTabSession(sessionId).sendPrompt(APPROVE_PROMPT);
    workspace.finalizeAssistantStream(sessionId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to approve plan";
    workspace.appendError(sessionId, message);
    workspace.finalizeAssistantStream(sessionId);
  } finally {
    exitPlanReview(sessionId);
  }
}

export async function revisePlan(
  sessionId: SessionId,
  cwd: string,
  feedback: string,
): Promise<void> {
  const trimmed = feedback.trim();
  const prompt = trimmed
    ? `${REVISE_PREFIX}: ${trimmed}`
    : `${REVISE_PREFIX}.`;

  const workspace = useWorkspaceStore.getState();
  const pending = usePermissionStore.getState().pendingBySession[sessionId];

  if (pending && isPlanPermissionRequest(pending.request)) {
    const option = pickPlanReviseOption(pending.request.options);
    if (option) {
      usePermissionStore.getState().respond(sessionId, option);
      if (trimmed) {
        workspace.addUserMessage(sessionId, prompt);
        workspace.setSessionStatus(sessionId, "running");
        try {
          const grokSessionId = workspace.sessions.find(
            (s) => s.id === sessionId,
          )?.grokSessionId;
          await ensureAcpForSend(sessionId, cwd, grokSessionId);
          await getTabSession(sessionId).sendPrompt(prompt);
          workspace.finalizeAssistantStream(sessionId);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to send revision";
          workspace.appendError(sessionId, message);
          workspace.finalizeAssistantStream(sessionId);
        }
      } else {
        workspace.setSessionStatus(sessionId, "running");
      }
      return;
    }
  }

  workspace.addUserMessage(sessionId, prompt);
  workspace.setSessionStatus(sessionId, "running");

  const grokSessionId = workspace.sessions.find((s) => s.id === sessionId)
    ?.grokSessionId;
  try {
    await ensureAcpForSend(sessionId, cwd, grokSessionId);
    await getTabSession(sessionId).sendPrompt(prompt);
    workspace.finalizeAssistantStream(sessionId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to request plan revision";
    workspace.appendError(sessionId, message);
    workspace.finalizeAssistantStream(sessionId);
  }
}

function exitPlanReview(sessionId: SessionId): void {
  clearPlanWatch(sessionId);
  const session = useWorkspaceStore.getState().sessions.find(
    (s) => s.id === sessionId,
  );
  if (session?.status === "plan_review") {
    useWorkspaceStore.getState().setSessionStatus(sessionId, "idle");
  }
}

export function extractPlanContentFromUpdate(
  update: Record<string, unknown>,
): { markdown?: string; fileUri?: string } {
  if (update.sessionUpdate === "plan_update") {
    const plan = update.plan as Record<string, unknown> | undefined;
    if (!plan) return {};
    if (typeof plan.content === "string") {
      return { markdown: plan.content };
    }
    if (typeof plan.uri === "string") {
      return { fileUri: plan.uri };
    }
    if (Array.isArray(plan.entries)) {
      return {
        markdown: planEntriesToMarkdown(plan.entries as PlanEntry[]),
      };
    }
  }

  if (update.sessionUpdate === "plan") {
    if (Array.isArray(update.entries)) {
      return {
        markdown: planEntriesToMarkdown(update.entries as PlanEntry[]),
      };
    }
    const plan = update.plan as Record<string, unknown> | undefined;
    if (plan) {
      if (typeof plan.content === "string") {
        return { markdown: plan.content };
      }
      if (typeof plan.uri === "string") {
        return { fileUri: plan.uri };
      }
      if (Array.isArray(plan.entries)) {
        return {
          markdown: planEntriesToMarkdown(plan.entries as PlanEntry[]),
        };
      }
    }
  }

  return {};
}

export function fileUriToPath(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  try {
    const url = new URL(uri);
    let path = decodeURIComponent(url.pathname);
    if (/^\/[A-Za-z]:/.test(path)) {
      path = path.slice(1);
    }
    return path.replace(/\//g, "\\");
  } catch {
    return null;
  }
}