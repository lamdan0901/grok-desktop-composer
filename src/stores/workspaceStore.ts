import { create } from "zustand";
import { releaseAgentOutput } from "@/lib/agentOutputGuard";
import { removeTabSession } from "@/lib/acp";
import { clearPlanWatch } from "@/lib/plan";
import { pathsEqual } from "@/lib/pathUtils";
import {
  clampSidebarWidth,
  SIDEBAR_WIDTH_DEFAULT,
} from "@/lib/sidebarLayout";
import {
  buildWorkspaceFromPersisted,
  findProjectForCwd,
  resolveLastActiveProjectCwd,
} from "@/lib/workspaceBootstrap";
import { usePermissionStore } from "@/stores/permissionStore";
import { MAX_SESSIONS } from "@/lib/constants";
import {
  confirmCloseRunningTab,
  confirmRemoveProject,
} from "@/lib/projectFolder";
import { stopTab } from "@/lib/grok";
import { isHistoryReplay } from "@/lib/historyReplay";
import {
  isUnstartedNewThread,
  shouldShowInSidebar,
} from "@/lib/sessionEmpty";
import { restoreSessionTranscriptIfNeeded } from "@/lib/restoreSession";
import {
  coalesceAssistantStreamFragments,
  mergeStreamChunk,
} from "@/lib/streamChunkMerge";
import { mergeFileDiffSources } from "@/lib/fileDiff";
import {
  findToolMessageIndex,
  resolveToolCallIdForUpsert,
} from "@/lib/toolCallIdentity";
import { isComposerFileToolApplied } from "@/lib/acp/composerFileToolApplied";
import {
  collapseCurrentTurnActivity,
  markTurnActivityCollapsed,
} from "@/lib/groupTurnActivity";
import { mergeToolCallStatus } from "@/lib/toolCallStatus";
import {
  inferredTitleFromMessages,
  isPlaceholderThreadTitle,
} from "@/lib/threadTitle";
import { grokTitleSyncedFromSummary } from "@/lib/threadTitle";
import { titleFromPrompt } from "@/lib/tabTitle";
import { removeProjectCwd } from "@/lib/sidebarProjectState";
import { unwatchSessionSignals } from "@/lib/usage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useAcpStore } from "@/stores/acpStore";
import { useUsageStore } from "@/stores/usageStore";
import type {
  AcpConnectionState,
  AgentNodeStatus,
  ChatMessage,
  UserMessageAttachment,
  Project,
  ProjectId,
  Session,
  SessionId,
  SessionSnapshot,
  SessionStatus,
  FileDiffSource,
  ToolCallDisplayStatus,
} from "@/lib/types";

function newId(): string {
  return crypto.randomUUID();
}

function newMessageId(): string {
  return crypto.randomUUID();
}

function folderBaseName(cwd: string): string {
  const parts = cwd.replace(/[/\\]+$/, "").split(/[/\\]/);
  return parts[parts.length - 1] || cwd;
}

function pruneUnstartedNewThreads(sessions: Session[]): Session[] {
  return sessions.filter((s) => !isUnstartedNewThread(s));
}

function lastSidebarSessionForProject(
  sessions: Session[],
  projectId: ProjectId,
): Session | undefined {
  const visible = sessions.filter(
    (s) => s.projectId === projectId && shouldShowInSidebar(s),
  );
  return visible[visible.length - 1];
}

function defaultSession(projectId: ProjectId): Session {
  const now = Date.now();
  return {
    id: newId(),
    projectId,
    title: "New thread",
    status: "idle",
    messages: [],
    acpState: "disconnected",
    agentNodes: [],
    lastActiveAt: now,
  };
}

function touchSessionLastActive(
  sessions: Session[],
  sessionId: SessionId,
): Session[] {
  if (isHistoryReplay(sessionId)) return sessions;
  return patchSession(sessions, sessionId, { lastActiveAt: Date.now() });
}

function patchSession(
  sessions: Session[],
  sessionId: SessionId,
  patch: Partial<Session>,
): Session[] {
  return sessions.map((s) =>
    s.id === sessionId ? { ...s, ...patch } : s,
  );
}

export function isSessionBusy(session: Session): boolean {
  return (
    session.status === "running" ||
    session.status === "awaiting_permission" ||
    session.status === "plan_review" ||
    session.acpState === "connecting"
  );
}

export function countBusySessions(sessions: Session[]): number {
  return sessions.filter(isSessionBusy).length;
}

export function isAtSessionAgentLimit(sessions: Session[]): boolean {
  return countBusySessions(sessions) >= MAX_SESSIONS;
}

/** Sidebar status: agent work in progress (not disk transcript load). */
export function isSessionSidebarBusy(
  session: Session,
  _activeSessionId: string | null,
): boolean {
  return (
    session.status === "running" ||
    session.status === "awaiting_permission" ||
    session.status === "plan_review"
  );
}

export function getSessionCwd(
  session: Session | undefined,
  projects: Project[],
): string {
  if (!session) return "";
  if (session.sessionCwd) return session.sessionCwd;
  return projects.find((p) => p.id === session.projectId)?.cwd ?? "";
}

/** Tear down ACP/process resources after the session is removed from UI state. */
function disposeSessionInBackground(sessionId: SessionId): void {
  usePermissionStore.getState().cancelSession(sessionId);
  useUsageStore.getState().clearSession(sessionId);
  void unwatchSessionSignals(sessionId).catch(() => undefined);
  clearPlanWatch(sessionId);
  useAcpStore.getState().clearTab(sessionId);
  void (async () => {
    await removeTabSession(sessionId);
    try {
      await stopTab(sessionId);
    } catch {
      // already stopped
    }
  })();
}

interface WorkspaceState {
  projects: Project[];
  sessions: Session[];
  activeSessionId: SessionId | null;
  /** Project context for the home composer when no thread is selected. */
  activeProjectId: ProjectId | null;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  expandedProjectIds: string[];
  expandedSessionIds: string[];

  addProject: (cwd: string) => { project: Project } | null;
  /** Open a folder without creating a thread when one already exists. */
  openProject: (cwd: string) => Project | null;
  /** Home / new-thread prep: project context only, no session until first message. */
  prepareNewThread: (projectId: ProjectId) => void;
  addSession: (projectId: ProjectId) => Session | null;
  removeProject: (projectId: ProjectId) => Promise<void>;
  renameProject: (projectId: ProjectId, name: string) => void;
  archiveProjectSessions: (projectId: ProjectId) => Promise<void>;
  bootstrapFromPersisted: (
    lastProjectPaths: string[],
    openTabs: SessionSnapshot[],
  ) => void;
  openResumedSession: (
    cwd: string,
    grokSessionId: string,
    title: string,
    lastActiveAt?: number,
  ) => Session | null;
  setSessionLastActiveAt: (sessionId: SessionId, lastActiveAt: number) => void;
  restoreFromSnapshots: (snapshots: SessionSnapshot[]) => void;
  clearResumeOnConnect: (sessionId: SessionId) => void;
  closeSession: (sessionId: SessionId) => Promise<void>;
  setActiveSession: (sessionId: SessionId) => void;
  setActiveProject: (projectId: ProjectId | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  toggleProjectExpanded: (projectId: ProjectId) => void;
  toggleSessionExpanded: (sessionId: SessionId) => void;
  setSessionTitle: (sessionId: SessionId, title: string) => void;
  setSessionTitleFromGrok: (sessionId: SessionId, title: string) => void;
  setSessionMessages: (sessionId: SessionId, messages: ChatMessage[]) => void;
  setTranscriptRestore: (
    sessionId: SessionId,
    transcriptRestore: Session["transcriptRestore"],
  ) => void;
  setAcpState: (
    sessionId: SessionId,
    acpState: AcpConnectionState,
    error?: string,
  ) => void;
  setSessionStatus: (sessionId: SessionId, status: SessionStatus) => void;
  setGrokSessionId: (sessionId: SessionId, grokSessionId: string, sessionCwd?: string) => void;
  setSessionCwd: (sessionId: SessionId, cwd: string) => void;
  upsertAgentNode: (
    sessionId: SessionId,
    node: {
      id: string;
      title: string;
      status?: AgentNodeStatus;
      kind?: string;
      path?: string;
      startedAt?: number;
    },
  ) => void;
  setAgentNodeStatus: (
    sessionId: SessionId,
    nodeId: string,
    status: AgentNodeStatus,
  ) => void;
  addUserMessage: (
    sessionId: SessionId,
    content: string,
    attachments?: UserMessageAttachment[],
  ) => void;
  /** Replay path: append user turn without starting a new live prompt. */
  appendHistoryUserMessage: (sessionId: SessionId, content: string) => void;
  appendThoughtChunk: (sessionId: SessionId, chunk: string) => void;
  finalizeThoughts: (sessionId: SessionId) => void;
  appendAssistantChunk: (sessionId: SessionId, chunk: string) => void;
  finalizeAssistantStream: (sessionId: SessionId) => void;
  upsertToolCallMessage: (
    sessionId: SessionId,
    tool: {
      toolCallId: string;
      title: string;
      kind?: string;
      path?: string;
      status?: ToolCallDisplayStatus;
      fileDiff?: FileDiffSource;
    },
  ) => void;
  appendSystemNote: (sessionId: SessionId, content: string) => void;
  appendError: (sessionId: SessionId, content: string) => void;
}

function finalizeStreamingThoughts(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "thought" || !m.streaming) return m;
    const durationSeconds =
      m.durationSeconds ??
      (m.startedAt != null
        ? Math.max(0.1, (Date.now() - m.startedAt) / 1000)
        : undefined);
    return {
      ...m,
      streaming: false,
      ...(durationSeconds != null ? { durationSeconds } : {}),
    };
  });
}

/** Close open stream rows before a new user turn so chunks cannot land after the user bubble. */
function finalizeMessagesBeforeUserTurn(messages: ChatMessage[]): ChatMessage[] {
  return collapseCurrentTurnActivity(
    finalizeStreamingThoughts(messages).map((m) => {
      if (m.role === "assistant" && m.streaming) {
        return { ...m, streaming: false };
      }
      return m;
    }),
  );
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  projects: [],
  sessions: [],
  activeSessionId: null,
  activeProjectId: null,
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  expandedProjectIds: [],
  expandedSessionIds: [],

  openProject: (cwd) => {
    const existing = get().projects.find((p) => pathsEqual(p.cwd, cwd));
    if (existing) {
      const lastVisible = lastSidebarSessionForProject(
        get().sessions,
        existing.id,
      );
      set((state) => ({
        activeSessionId: lastVisible?.id ?? null,
        activeProjectId: existing.id,
        expandedProjectIds: state.expandedProjectIds.includes(existing.id)
          ? state.expandedProjectIds
          : [...state.expandedProjectIds, existing.id],
      }));
      return existing;
    }

    const project: Project = {
      id: newId(),
      cwd,
      name: folderBaseName(cwd),
    };
    set((state) => ({
      projects: [...state.projects, project],
      activeProjectId: project.id,
      expandedProjectIds: [...state.expandedProjectIds, project.id],
    }));
    return project;
  },

  addProject: (cwd) => {
    const existing = get().projects.find((p) => pathsEqual(p.cwd, cwd));
    if (existing) {
      const lastVisible = lastSidebarSessionForProject(
        get().sessions,
        existing.id,
      );
      set((state) => ({
        activeSessionId: lastVisible?.id ?? null,
        activeProjectId: existing.id,
        expandedProjectIds: state.expandedProjectIds.includes(existing.id)
          ? state.expandedProjectIds
          : [...state.expandedProjectIds, existing.id],
      }));
      return { project: existing };
    }

    const project: Project = {
      id: newId(),
      cwd,
      name: folderBaseName(cwd),
    };
    set((state) => ({
      projects: [...state.projects, project],
      activeSessionId: null,
      activeProjectId: project.id,
      expandedProjectIds: [...state.expandedProjectIds, project.id],
    }));
    return { project };
  },

  prepareNewThread: (projectId) => {
    if (!get().projects.some((p) => p.id === projectId)) return;
    set((state) => ({
      sessions: pruneUnstartedNewThreads(state.sessions),
      activeProjectId: projectId,
      activeSessionId: null,
      expandedProjectIds: state.expandedProjectIds.includes(projectId)
        ? state.expandedProjectIds
        : [...state.expandedProjectIds, projectId],
    }));
  },

  addSession: (projectId) => {
    if (!get().projects.some((p) => p.id === projectId)) return null;

    if (isAtSessionAgentLimit(get().sessions)) return null;

    const session = defaultSession(projectId);
    set((state) => ({
      sessions: [...pruneUnstartedNewThreads(state.sessions), session],
      activeSessionId: session.id,
      activeProjectId: projectId,
      expandedProjectIds: state.expandedProjectIds.includes(projectId)
        ? state.expandedProjectIds
        : [...state.expandedProjectIds, projectId],
    }));
    return session;
  },

  openResumedSession: (cwd, grokSessionId, title, lastActiveAt) => {
    const existing = get().sessions.find(
      (s) => s.grokSessionId === grokSessionId,
    );
    if (existing) {
      get().setActiveSession(existing.id);
      return existing;
    }
    if (isAtSessionAgentLimit(get().sessions)) return null;

    let project = get().projects.find((p) => pathsEqual(p.cwd, cwd));
    let projects = get().projects;
    if (!project) {
      project = {
        id: newId(),
        cwd,
        name: folderBaseName(cwd),
      };
      projects = [...projects, project];
    }

    const resolvedTitle = title.trim() || "Resumed thread";
    const session: Session = {
      id: newId(),
      projectId: project.id,
      title: resolvedTitle,
      grokTitleSynced: grokTitleSyncedFromSummary(resolvedTitle),
      grokSessionId,
      sessionCwd: cwd,
      resumeOnConnect: true,
      expectsTranscript: true,
      transcriptRestore: "idle",
      status: "idle",
      messages: [],
      acpState: "disconnected",
      agentNodes: [],
      lastActiveAt: lastActiveAt ?? Date.now(),
    };

    set((state) => ({
      projects,
      sessions: [...state.sessions, session],
      activeSessionId: session.id,
      activeProjectId: project!.id,
      expandedProjectIds: state.expandedProjectIds.includes(project!.id)
        ? state.expandedProjectIds
        : [...state.expandedProjectIds, project!.id],
    }));
    return session;
  },

  setSessionLastActiveAt: (sessionId, lastActiveAt) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, { lastActiveAt }),
    })),

  bootstrapFromPersisted: (lastProjectPaths, openTabs) => {
    if (get().projects.length > 0 || get().sessions.length > 0) return;
    if (lastProjectPaths.length === 0 && openTabs.length === 0) return;

    const { projects, sessions } = buildWorkspaceFromPersisted(
      lastProjectPaths,
      openTabs,
      newId,
    );
    const restoredSessions = pruneUnstartedNewThreads(sessions).map((s) => ({
      ...s,
      resumeOnConnect: false,
      transcriptRestore: undefined,
    }));
    const lastCwd = resolveLastActiveProjectCwd(lastProjectPaths, openTabs);
    const activeProject =
      findProjectForCwd(projects, lastCwd) ?? projects[0];
    const activeProjectId = activeProject?.id ?? null;

    set({
      projects,
      sessions: restoredSessions,
      activeSessionId: null,
      activeProjectId,
      expandedProjectIds: [],
      expandedSessionIds: [],
    });
  },

  restoreFromSnapshots: (snapshots) => {
    get().bootstrapFromPersisted([], snapshots);
  },

  removeProject: async (projectId) => {
    const { projects, sessions, activeSessionId } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;

    const projectSessions = sessions.filter((s) => s.projectId === projectId);
    const hasBusy = projectSessions.some((s) => isSessionBusy(s));
    if (hasBusy) {
      const ok = await confirmRemoveProject(project.name, true);
      if (!ok) return;
    } else {
      const ok = await confirmRemoveProject(project.name, false);
      if (!ok) return;
    }

    const nextSessions = sessions.filter((s) => s.projectId !== projectId);
    const nextProjects = projects.filter((p) => p.id !== projectId);
    const nextActive =
      activeSessionId &&
      nextSessions.some((s) => s.id === activeSessionId)
        ? activeSessionId
        : (nextSessions[nextSessions.length - 1]?.id ?? null);

    const removedActiveProject = get().activeProjectId === projectId;
    set({
      projects: nextProjects,
      sessions: nextSessions,
      activeSessionId: nextActive,
      activeProjectId: removedActiveProject
        ? (nextProjects[nextProjects.length - 1]?.id ?? null)
        : get().activeProjectId,
      expandedProjectIds: get().expandedProjectIds.filter(
        (id) => id !== projectId,
      ),
    });

    for (const session of projectSessions) {
      disposeSessionInBackground(session.id);
    }

    const { settings, updateSettings } = useSettingsStore.getState();
    void updateSettings({
      expandedProjectCwds: removeProjectCwd(
        settings.expandedProjectCwds ?? [],
        project.cwd,
      ),
      showAllThreadsProjectCwds: removeProjectCwd(
        settings.showAllThreadsProjectCwds ?? [],
        project.cwd,
      ),
    });
  },

  clearResumeOnConnect: (sessionId) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, {
        resumeOnConnect: false,
      }),
    })),

  closeSession: async (sessionId) => {
    const { sessions, activeSessionId } = get();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    if (isSessionBusy(session)) {
      const ok = await confirmCloseRunningTab(session.title);
      if (!ok) return;
    }

    const nextSessions = sessions.filter((s) => s.id !== sessionId);
    const closedProjectId = session.projectId;
    const closingActive = activeSessionId === sessionId;

    if (closingActive) {
      set((state) => ({
        sessions: pruneUnstartedNewThreads(nextSessions),
        activeSessionId: null,
        activeProjectId: closedProjectId,
        expandedProjectIds: state.expandedProjectIds.includes(closedProjectId)
          ? state.expandedProjectIds
          : [...state.expandedProjectIds, closedProjectId],
      }));
    } else {
      set({
        sessions: nextSessions,
        activeSessionId,
        activeProjectId: get().activeProjectId,
      });
    }

    disposeSessionInBackground(sessionId);
  },

  renameProject: (projectId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, name: trimmed } : p,
      ),
    }));
  },

  archiveProjectSessions: async (projectId) => {
    const { sessions } = get();
    const toClose = sessions.filter((s) => s.projectId === projectId);
    for (const session of toClose) {
      await get().closeSession(session.id);
    }
  },

  setActiveSession: (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const isFreshNewThread =
      session.title.trim().toLowerCase() === "new thread" &&
      session.messages.length === 0 &&
      !session.expectsTranscript;
    const shouldLoadTranscript =
      Boolean(session.grokSessionId) && session.messages.length === 0;
    set((state) => ({
      activeSessionId: sessionId,
      activeProjectId: session.projectId,
      sessions: isFreshNewThread
        ? patchSession(state.sessions, sessionId, {
            transcriptRestore: undefined,
            resumeOnConnect: false,
            expectsTranscript: false,
            acpState:
              session.acpState === "error" ? "disconnected" : session.acpState,
            acpError: undefined,
          })
        : shouldLoadTranscript
          ? patchSession(state.sessions, sessionId, {
              transcriptRestore: "idle",
              expectsTranscript:
                session.expectsTranscript ||
                session.title.trim().toLowerCase() !== "new thread",
              acpError: undefined,
            })
          : state.sessions,
      expandedProjectIds: state.expandedProjectIds.includes(session.projectId)
        ? state.expandedProjectIds
        : [...state.expandedProjectIds, session.projectId],
    }));
    void restoreSessionTranscriptIfNeeded(sessionId);
  },

  setActiveProject: (projectId) => {
    if (projectId != null && !get().projects.some((p) => p.id === projectId)) {
      return;
    }
    if (projectId == null) {
      set({ activeProjectId: null, activeSessionId: null });
      return;
    }
    set({ activeProjectId: projectId, activeSessionId: null });
  },

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarWidth: (width) =>
    set({ sidebarWidth: clampSidebarWidth(width) }),

  toggleProjectExpanded: (projectId) =>
    set((state) => ({
      expandedProjectIds: state.expandedProjectIds.includes(projectId)
        ? state.expandedProjectIds.filter((id) => id !== projectId)
        : [...state.expandedProjectIds, projectId],
    })),

  toggleSessionExpanded: (sessionId) =>
    set((state) => ({
      expandedSessionIds: state.expandedSessionIds.includes(sessionId)
        ? state.expandedSessionIds.filter((id) => id !== sessionId)
        : [...state.expandedSessionIds, sessionId],
    })),

  setSessionTitle: (sessionId, title) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, { title }),
    })),

  setSessionTitleFromGrok: (sessionId, title) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, {
        title,
        grokTitleSynced: true,
      }),
    })),

  setSessionMessages: (sessionId, messages) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const collapsed = markTurnActivityCollapsed(messages);
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages: collapsed,
          transcriptRestore: collapsed.length > 0 ? "done" : undefined,
          ...inferredTitleFromMessages(session, collapsed),
        }),
      };
    }),

  setTranscriptRestore: (sessionId, transcriptRestore) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, { transcriptRestore }),
    })),

  setAcpState: (sessionId, acpState, error) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      if (session.acpState === acpState && session.acpError === error) {
        return state;
      }
      return {
        sessions: patchSession(state.sessions, sessionId, {
          acpState,
          acpError: error,
        }),
      };
    }),

  setSessionStatus: (sessionId, status) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, { status }),
    })),

  setGrokSessionId: (sessionId, grokSessionId, sessionCwd) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session || session.grokSessionId === grokSessionId) return state;
      // Never replace a persisted Grok session id (would break on-disk transcript paths).
      if (session.grokSessionId) return state;
      return {
        sessions: patchSession(state.sessions, sessionId, {
          grokSessionId,
          ...(sessionCwd ? { sessionCwd } : {}),
          resumeOnConnect: false,
        }),
      };
    }),

  setSessionCwd: (sessionId, cwd) =>
    set((state) => ({
      sessions: patchSession(state.sessions, sessionId, { sessionCwd: cwd }),
    })),

  upsertAgentNode: (sessionId, node) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const existing = session.agentNodes.find((n) => n.id === node.id);
      const agentNodes = existing
        ? session.agentNodes.map((n) =>
            n.id === node.id
              ? {
                  ...n,
                  title: node.title,
                  status: node.status ?? n.status,
                  kind: node.kind ?? n.kind,
                  path: node.path ?? n.path,
                  startedAt: n.startedAt ?? node.startedAt,
                }
              : n,
          )
        : [
            ...session.agentNodes,
            {
              id: node.id,
              sessionId,
              parentId: null,
              title: node.title,
              status: node.status ?? "running",
              kind: node.kind,
              path: node.path,
              startedAt: node.startedAt ?? Date.now(),
            },
          ];
      return {
        sessions: patchSession(state.sessions, sessionId, { agentNodes }),
        expandedSessionIds: state.expandedSessionIds.includes(sessionId)
          ? state.expandedSessionIds
          : [...state.expandedSessionIds, sessionId],
      };
    }),

  setAgentNodeStatus: (sessionId, nodeId, status) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      return {
        sessions: patchSession(state.sessions, sessionId, {
          agentNodes: session.agentNodes.map((n) =>
            n.id === nodeId ? { ...n, status } : n,
          ),
        }),
      };
    }),

  addUserMessage: (sessionId, content, attachments) => {
    releaseAgentOutput(sessionId);
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const message: ChatMessage = {
        id: newMessageId(),
        role: "user",
        content,
        ...(attachments?.length ? { attachments } : {}),
      };
      const titleSource =
        content.trim() ||
        (attachments?.length === 1
          ? "Image"
          : attachments?.length
            ? `${attachments.length} images`
            : "");
      const rename =
        isPlaceholderThreadTitle(session.title)
          ? { title: titleFromPrompt(titleSource) }
          : {};
      const messages = [...finalizeMessagesBeforeUserTurn(session.messages), message];
      return {
        sessions: touchSessionLastActive(
          patchSession(state.sessions, sessionId, {
            messages,
            status: "running",
            ...rename,
          }),
          sessionId,
        ),
      };
    });
  },

  appendHistoryUserMessage: (sessionId, content) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const trimmed = content.trim();
      if (!trimmed) return state;
      const last = session.messages[session.messages.length - 1];
      if (last?.role === "user" && last.content === trimmed) {
        return state;
      }
      const userMessage: ChatMessage = {
        id: newMessageId(),
        role: "user",
        content: trimmed,
      };
      const nextMessages: ChatMessage[] = [
        ...finalizeMessagesBeforeUserTurn(session.messages),
        userMessage,
      ];
      const rename = isPlaceholderThreadTitle(session.title)
        ? inferredTitleFromMessages(session, nextMessages)
        : {};
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages: nextMessages,
          ...rename,
        }),
      };
    }),

  appendThoughtChunk: (sessionId, chunk) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const messages = [...session.messages];
      const last = messages[messages.length - 1];
      if (last?.role === "thought" && last.streaming) {
        messages[messages.length - 1] = {
          ...last,
          content: mergeStreamChunk(last.content, chunk),
        };
      } else {
        messages.push({
          id: newMessageId(),
          role: "thought",
          content: chunk,
          streaming: true,
          startedAt: Date.now(),
        });
      }
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages,
          status: "running",
        }),
      };
    }),

  finalizeThoughts: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages: finalizeStreamingThoughts(session.messages),
        }),
      };
    }),

  appendAssistantChunk: (sessionId, chunk) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      let messages = finalizeStreamingThoughts(session.messages);
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        messages = [...messages];
        messages[messages.length - 1] = {
          ...last,
          content: mergeStreamChunk(last.content, chunk),
        };
      } else {
        messages = [
          ...messages,
          {
            id: newMessageId(),
            role: "assistant",
            content: chunk,
            streaming: true,
          },
        ];
      }
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages,
          status: "running",
        }),
      };
    }),

  finalizeAssistantStream: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      let messages = finalizeStreamingThoughts(session.messages).map((m) => {
        if (m.role === "assistant" && m.streaming) {
          return {
            ...m,
            streaming: false,
            content: m.content,
          };
        }
        if (m.role === "tool" && m.status === "running") {
          return { ...m, status: "completed" as const };
        }
        return m;
      });
      messages = coalesceAssistantStreamFragments(
        collapseCurrentTurnActivity(messages),
      );
      return {
        sessions: touchSessionLastActive(
          patchSession(state.sessions, sessionId, {
            messages,
            status: "idle",
            agentNodes: session.agentNodes.map((n) =>
              n.status === "running" ? { ...n, status: "done" as const } : n,
            ),
          }),
          sessionId,
        ),
      };
    }),

  upsertToolCallMessage: (sessionId, tool) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      const messages = finalizeStreamingThoughts([...session.messages]);
      const resolvedId = resolveToolCallIdForUpsert(
        messages,
        tool.toolCallId,
        tool.path ?? tool.fileDiff?.file,
      );
      const idx = findToolMessageIndex(
        messages,
        resolvedId,
        tool.path ?? tool.fileDiff?.file,
      );
      const existing =
        idx >= 0 && messages[idx]?.role === "tool" ? messages[idx] : undefined;
      const status = mergeToolCallStatus(
        tool.status,
        existing?.status,
        isComposerFileToolApplied(sessionId, resolvedId),
      );
      if (idx >= 0) {
        if (existing?.role !== "tool") return state;
        messages[idx] = {
          ...existing,
          title: tool.title || existing.title,
          kind: tool.kind ?? existing.kind,
          path: tool.path ?? existing.path,
          status,
          fileDiff: mergeFileDiffSources(existing.fileDiff, tool.fileDiff),
        };
      } else {
        messages.push({
          id: newMessageId(),
          role: "tool",
          toolCallId: resolvedId,
          title: tool.title,
          kind: tool.kind,
          path: tool.path,
          status,
          fileDiff: tool.fileDiff,
        });
      }
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages,
          status: "running",
        }),
      };
    }),

  appendSystemNote: (sessionId, content) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages: [
            ...session.messages,
            { id: newMessageId(), role: "system", content },
          ],
        }),
      };
    }),

  appendError: (sessionId, content) =>
    set((state) => {
      const session = state.sessions.find((s) => s.id === sessionId);
      if (!session) return state;
      return {
        sessions: patchSession(state.sessions, sessionId, {
          messages: [
            ...session.messages,
            { id: newMessageId(), role: "error", content },
          ],
          status: "idle",
          agentNodes: session.agentNodes.map((n) =>
            n.status === "running" ? { ...n, status: "failed" as const } : n,
          ),
        }),
      };
    }),
}));

export async function stopSessionProcess(sessionId: SessionId): Promise<void> {
  await removeTabSession(sessionId);
  try {
    await stopTab(sessionId);
  } catch {
    // already stopped
  }
}