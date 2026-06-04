import { isTauri } from "@tauri-apps/api/core";
import { MAX_SIDEBAR_RESTORE_SESSIONS } from "@/lib/constants";
import { pathsEqual } from "@/lib/pathUtils";
import { parseGrokSessionTimestamp } from "@/lib/relativeTime";
import { listGrokSessions, resolveGrokSessionCwd } from "@/lib/sessions";
import { grokTitleSyncedFromSummary } from "@/lib/threadTitle";
import type { Session } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspaceStore";

function newSessionId(): string {
  return crypto.randomUUID();
}

/**
 * When persisted open tabs were lost, rebuild sidebar threads from on-disk
 * Grok sessions for already-open projects (does not change the active tab).
 */
export async function hydrateSidebarSessionsFromDisk(): Promise<void> {
  if (!isTauri()) return;

  const { projects, sessions } = useWorkspaceStore.getState();
  if (sessions.length > 0 || projects.length === 0) return;

  let entries;
  try {
    entries = await listGrokSessions(100);
  } catch {
    return;
  }

  const newSessions: Session[] = [];
  const seenGrok = new Set<string>();

  for (const entry of entries) {
    if (newSessions.length >= MAX_SIDEBAR_RESTORE_SESSIONS) break;
    if (seenGrok.has(entry.id)) continue;
    seenGrok.add(entry.id);

    let cwd = entry.cwd;
    if (!cwd) {
      try {
        cwd = (await resolveGrokSessionCwd(entry.id)) ?? undefined;
      } catch {
        continue;
      }
    }
    if (!cwd) continue;

    const project = projects.find((p) => pathsEqual(p.cwd, cwd));
    if (!project) continue;

    const title = entry.summary?.trim() || "Resumed thread";
    if (title.toLowerCase() === "new thread") continue;

    const lastActiveAt = parseGrokSessionTimestamp(
      entry.updated ?? entry.created,
    );

    newSessions.push({
      id: newSessionId(),
      projectId: project.id,
      title,
      grokTitleSynced: grokTitleSyncedFromSummary(title),
      grokSessionId: entry.id,
      sessionCwd: cwd,
      resumeOnConnect: false,
      expectsTranscript: true,
      transcriptRestore: undefined,
      status: "idle",
      messages: [],
      acpState: "disconnected",
      agentNodes: [],
      lastActiveAt: lastActiveAt ?? Date.now(),
    });
  }

  if (newSessions.length === 0) return;

  useWorkspaceStore.setState((state) => ({
    sessions: [...state.sessions, ...newSessions],
  }));
}