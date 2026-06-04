import type { Project, Session, SessionSnapshot } from "./types";
import { pushRecentProject } from "@/lib/recentProjects";
import { shouldShowInSidebar } from "@/lib/sessionEmpty";
import { useSettingsStore } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function collectSessionSnapshots(state: {
  projects: Project[];
  sessions: Session[];
}): SessionSnapshot[] {
  const { projects, sessions } = state;
  const snapshots: SessionSnapshot[] = [];
  for (const session of sessions) {
    if (!shouldShowInSidebar(session)) continue;
    const cwd = session.sessionCwd ?? projects.find((p) => p.id === session.projectId)?.cwd;
    if (!cwd) continue;
    snapshots.push({
      id: session.id,
      projectId: session.projectId,
      title: session.title,
      grokTitleSynced: session.grokTitleSynced,
      cwd,
      grokSessionId: session.grokSessionId,
      lastActiveAt: session.lastActiveAt,
    });
  }
  return snapshots;
}

export function collectProjectPaths(projects: Project[]): string[] {
  return projects.map((p) => p.cwd);
}

export async function syncWorkspaceToSettings(): Promise<void> {
  const { projects, sessions, activeProjectId } = useWorkspaceStore.getState();
  const openTabs = collectSessionSnapshots({ projects, sessions });
  let lastProjectPaths = collectProjectPaths(projects);
  const activeCwd = projects.find((p) => p.id === activeProjectId)?.cwd;
  if (activeCwd) {
    lastProjectPaths = pushRecentProject(lastProjectPaths, activeCwd);
  }
  const { settings, updateSettings } = useSettingsStore.getState();
  await updateSettings({ ...settings, openTabs, lastProjectPaths });
}

export async function persistOpenSessions(): Promise<void> {
  await syncWorkspaceToSettings();
}

export async function clearPersistedSessions(): Promise<void> {
  const { settings, updateSettings } = useSettingsStore.getState();
  await updateSettings({ ...settings, openTabs: [], lastProjectPaths: [] });
}