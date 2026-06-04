import { normalizeProjectPath, pathsEqual } from "./pathUtils";
import { grokTitleSyncedFromSummary } from "@/lib/threadTitle";
import type { Project, Session, SessionSnapshot } from "./types";

function folderBaseName(cwd: string): string {
  const parts = cwd.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || cwd;
}

export function orderedProjectCwds(
  lastProjectPaths: string[],
  openTabs: SessionSnapshot[],
): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = normalizeProjectPath(trimmed);
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(trimmed);
  };

  for (const cwd of lastProjectPaths) push(cwd);
  for (const tab of openTabs) push(tab.cwd);
  return ordered;
}

/** Most recently used project folder (first in `lastProjectPaths` when recorded via pushRecentProject). */
export function resolveLastActiveProjectCwd(
  lastProjectPaths: string[],
  openTabs: SessionSnapshot[] = [],
): string | undefined {
  const recent = lastProjectPaths[0]?.trim();
  if (recent) return recent;
  const fromTab = openTabs[0]?.cwd?.trim();
  if (fromTab) return fromTab;
  const cwds = orderedProjectCwds(lastProjectPaths, openTabs);
  return cwds[cwds.length - 1];
}

export function buildProjectsFromPersisted(
  lastProjectPaths: string[],
  openTabs: SessionSnapshot[],
  newId: () => string,
): Project[] {
  const cwds = orderedProjectCwds(lastProjectPaths, openTabs);
  return cwds.map((cwd) => ({
    id: newId(),
    cwd,
    name: folderBaseName(cwd),
  }));
}

export function findProjectForCwd(
  projects: Project[],
  cwd: string | undefined,
): Project | undefined {
  if (!cwd) return undefined;
  return projects.find((p) => pathsEqual(p.cwd, cwd));
}

export function buildWorkspaceFromPersisted(
  lastProjectPaths: string[],
  openTabs: SessionSnapshot[],
  newId: () => string,
): { projects: Project[]; sessions: Session[] } {
  const cwds = orderedProjectCwds(lastProjectPaths, openTabs);
  const projects: Project[] = cwds.map((cwd) => ({
    id: newId(),
    cwd,
    name: folderBaseName(cwd),
  }));

  const projectByCwd = new Map(
    projects.map((p) => [normalizeProjectPath(p.cwd), p]),
  );

  const sessions: Session[] = [];
  for (const snap of openTabs) {
    const project = projectByCwd.get(normalizeProjectPath(snap.cwd));
    if (!project) continue;
    const title = snap.title || "Resumed thread";
    const hasGrok = Boolean(snap.grokSessionId);
    const isNewThread = title.trim().toLowerCase() === "new thread";
    if (isNewThread && !hasGrok) continue;
    const expectsTranscript = hasGrok && !isNewThread;
    sessions.push({
      id: newId(),
      projectId: project.id,
      title,
      grokTitleSynced:
        snap.grokTitleSynced ?? grokTitleSyncedFromSummary(title),
      grokSessionId: snap.grokSessionId,
      sessionCwd: snap.cwd,
      resumeOnConnect: expectsTranscript,
      expectsTranscript,
      transcriptRestore: expectsTranscript ? "idle" : undefined,
      status: "idle",
      messages: [],
      acpState: "disconnected",
      agentNodes: [],
      lastActiveAt: snap.lastActiveAt,
    });
  }

  return { projects, sessions };
}