import { getTabSession } from "@/lib/acp";
import { callRequestFeature } from "./featureDetection";
import { XAI } from "./xaiMethods";

type Call = (method: string, params: Record<string, unknown>) => Promise<unknown>;

const callFor = (tabId: string): Call =>
  (method, params) => getTabSession(tabId).extMethod(method, params);

export async function forkIntoWorktree(
  tabId: string,
  parentSessionId: string,
  worktreePath: string,
  call: Call = callFor(tabId),
): Promise<{ sessionId: string; cwd: string } | null> {
  const created = await callRequestFeature(
    tabId,
    XAI.gitWorktreeCreateFromSync,
    () =>
      call(XAI.gitWorktreeCreateFromSync.method, {
        sessionId: parentSessionId,
        worktreePath,
      }),
  );
  if (!created.supported) return null;
  const createdPath =
    created.value &&
    typeof created.value === "object" &&
    typeof (created.value as { worktreePath?: unknown }).worktreePath === "string"
      ? (created.value as { worktreePath: string }).worktreePath
      : "";
  if (!createdPath) throw new Error("Grok did not return the created worktree path");

  const resumed = await callRequestFeature(
    tabId,
    XAI.gitWorktreeResumeSession,
    () =>
      call(XAI.gitWorktreeResumeSession.method, {
        sessionId: parentSessionId,
        worktreePath: createdPath,
      }),
  );
  if (!resumed.supported) return null;
  if (!resumed.value || typeof resumed.value !== "object") {
    throw new Error("Grok returned an invalid worktree session");
  }
  const value = resumed.value as Record<string, unknown>;
  if (typeof value.sessionId !== "string" || typeof value.cwd !== "string") {
    throw new Error("Grok returned an incomplete worktree session");
  }
  return { sessionId: value.sessionId, cwd: value.cwd };
}
