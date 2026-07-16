import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GitBranch,
  History,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  RefreshCw,
  Settings,
  Trash2,
  FolderPlus,
  Pencil,
  Puzzle,
} from "lucide-react";
import { useSidebarResize } from "@/hooks/useSidebarResize";
import { SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MIN } from "@/lib/sidebarLayout";
import { SessionHistoryPanel } from "./SessionHistoryPanel";
import { SidebarMenu, type SidebarMenuItem } from "./SidebarMenu";
import { openPathInExplorer } from "@/lib/openInExplorer";
import { pathsEqual } from "@/lib/pathUtils";
import { pickProjectFolder } from "@/lib/projectFolder";
import { pushRecentProject } from "@/lib/recentProjects";
import { formatRelativeShort } from "@/lib/relativeTime";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  deleteSession,
  forkSession,
  renameSession,
} from "@/lib/acp/xaiSession";
import {
  getSessionCwd,
  isSessionSidebarBusy,
  useWorkspaceStore,
} from "@/stores/workspaceStore";
import { shouldShowInSidebar } from "@/lib/sessionEmpty";
import {
  addProjectCwd,
  isProjectCwdInList,
  removeProjectCwd,
  SIDEBAR_THREADS_PREVIEW,
  toggleProjectCwdInList,
} from "@/lib/sidebarProjectState";
import { displayThreadTitle } from "@/lib/threadTitle";
import type { Project, Session } from "@/lib/types";
import { useExtensionsStore } from "@/stores/extensionsStore";

function recordProjectPath(cwd: string) {
  const { settings, updateSettings } = useSettingsStore.getState();
  void updateSettings({
    lastProjectPaths: pushRecentProject(settings.lastProjectPaths, cwd),
  });
}

function sessionSortKey(session: Session): number {
  return session.lastActiveAt ?? 0;
}

function sortSessionsNewestFirst(list: Session[]): Session[] {
  return [...list].sort((a, b) => sessionSortKey(b) - sessionSortKey(a));
}

function ThreadRow({
  session,
  active,
  activeSessionId,
  onSelect,
  onDelete,
  onOpenActions,
}: {
  session: Session;
  active: boolean;
  activeSessionId: string | null;
  onSelect: () => void;
  onDelete: () => void;
  onOpenActions?: (anchor: HTMLElement) => void;
}) {
  const busy = isSessionSidebarBusy(session, activeSessionId);
  const threadTitle = displayThreadTitle(session);
  const timeLabel =
    session.lastActiveAt != null && session.lastActiveAt > 0
      ? formatRelativeShort(session.lastActiveAt)
      : null;

  return (
    <div
      className={`codex-thread${active ? " codex-thread--active" : ""}`}
      title={threadTitle}
    >
      <button type="button" className="codex-thread__main" onClick={onSelect}>
        <span className="codex-thread__title">{threadTitle}</span>
        <span className="codex-thread__time">
          {busy ? (
            <Loader2 size={11} className="codex-thread__spin" />
          ) : (
            timeLabel ?? ""
          )}
        </span>
      </button>
      {onOpenActions && (
        <button
          type="button"
          className="codex-thread__delete codex-icon-btn"
          aria-label={`Actions for ${threadTitle}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenActions(event.currentTarget);
          }}
        >
          <MoreHorizontal size={13} />
        </button>
      )}
      <button
        type="button"
        className="codex-thread__delete codex-icon-btn"
        aria-label={`Delete ${threadTitle}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function SidebarThreadList({
  sessions,
  activeSessionId,
  showAllThreads,
  onShowMore,
  onShowLess,
  onSelectSession,
  onDeleteSession,
  onOpenSessionActions,
  wrapClassName,
}: {
  sessions: Session[];
  activeSessionId: string | null;
  showAllThreads: boolean;
  onShowMore: () => void;
  onShowLess: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSessionActions: (id: string, anchor: HTMLElement) => void;
  wrapClassName?: string;
}) {
  const sorted = sortSessionsNewestFirst(
    sessions.filter(shouldShowInSidebar),
  );
  if (sorted.length === 0) return null;

  const visible = showAllThreads
    ? sorted
    : sorted.slice(0, SIDEBAR_THREADS_PREVIEW);
  const hiddenCount = Math.max(0, sorted.length - SIDEBAR_THREADS_PREVIEW);
  const showMoreButton = !showAllThreads && hiddenCount > 0;
  const showLessButton =
    showAllThreads && sorted.length > SIDEBAR_THREADS_PREVIEW;

  return (
    <div
      className={
        wrapClassName
          ? `codex-project__threads-wrap ${wrapClassName}`
          : "codex-project__threads-wrap"
      }
    >
      <div
        className={
          showAllThreads
            ? "codex-project__threads codex-project__threads--scroll"
            : "codex-project__threads"
        }
      >
        {visible.map((session) => (
          <ThreadRow
            key={session.id}
            session={session}
            active={session.id === activeSessionId}
            activeSessionId={activeSessionId}
            onSelect={() => onSelectSession(session.id)}
            onDelete={() => onDeleteSession(session.id)}
            onOpenActions={
              session.grokSessionId
                ? (anchor) => onOpenSessionActions(session.id, anchor)
                : undefined
            }
          />
        ))}
      </div>
      {showMoreButton && (
        <button
          type="button"
          className="codex-show-more"
          onClick={onShowMore}
        >
          Show more ({hiddenCount})
        </button>
      )}
      {showLessButton && (
        <button
          type="button"
          className="codex-show-more codex-show-more--pinned"
          onClick={onShowLess}
        >
          Show less
        </button>
      )}
    </div>
  );
}

function ProjectBlock({
  project,
  sessions,
  expanded,
  activeSessionId,
  showAllThreads,
  pinned,
  onToggleExpand,
  onSelectSession,
  onOpenMenu,
  onNewThread,
  onDeleteSession,
  onOpenSessionActions,
  onShowMore,
  onShowLess,
}: {
  project: Project;
  sessions: Session[];
  expanded: boolean;
  activeSessionId: string | null;
  showAllThreads: boolean;
  pinned: boolean;
  onToggleExpand: () => void;
  onSelectSession: (id: string) => void;
  onOpenMenu: (anchor: HTMLElement) => void;
  onNewThread: () => void;
  onDeleteSession: (id: string) => void;
  onOpenSessionActions: (id: string, anchor: HTMLElement) => void;
  onShowMore: () => void;
  onShowLess: () => void;
}) {
  const hasThreads = sessions.some(shouldShowInSidebar);

  return (
    <div className="codex-project">
      <div className="codex-project__row">
        <button
          type="button"
          className="codex-project__main"
          title={project.cwd}
          onClick={onToggleExpand}
          aria-expanded={hasThreads ? expanded : undefined}
        >
          {expanded ? (
            <FolderOpen size={14} className="codex-project__folder" />
          ) : (
            <Folder size={14} className="codex-project__folder" />
          )}
          <span className="codex-project__name">{project.name}</span>
          {pinned && <Pin size={11} className="codex-project__pin" />}
        </button>
        <div className="codex-project__actions">
          <button
            type="button"
            className="codex-icon-btn"
            aria-label={`Options for ${project.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu(e.currentTarget);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            type="button"
            className="codex-icon-btn"
            aria-label="New thread in project"
            onClick={(e) => {
              e.stopPropagation();
              onNewThread();
            }}
          >
            <GitBranch size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <SidebarThreadList
          sessions={sessions}
          activeSessionId={activeSessionId}
          showAllThreads={showAllThreads}
          onShowMore={onShowMore}
          onShowLess={onShowLess}
          onSelectSession={onSelectSession}
          onDeleteSession={onDeleteSession}
          onOpenSessionActions={onOpenSessionActions}
        />
      )}
    </div>
  );
}

function SidebarBottomActions({
  collapsed,
  onToggleSidebar,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const openExtensions = useExtensionsStore((s) => s.openModal);

  const settingsBtn = (
    <button
      type="button"
      className="codex-icon-btn"
      aria-label="Settings"
      title="Settings"
      onClick={() => setSettingsOpen(true)}
    >
      <Settings size={18} />
    </button>
  );

  const extensionsBtn = (
    <button
      type="button"
      className="codex-icon-btn"
      aria-label="Extensions"
      title="Extensions"
      onClick={() => openExtensions()}
    >
      <Puzzle size={18} />
    </button>
  );

  const toggleBtn = (
    <button
      type="button"
      className="codex-icon-btn"
      aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
      title={collapsed ? "Show sidebar" : "Hide sidebar"}
      onClick={onToggleSidebar}
    >
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );

  return (
    <div
      className={`codex-sidebar__footer${collapsed ? " codex-sidebar__footer--rail" : ""}`}
    >
      {collapsed ? (
        <>
          {settingsBtn}
          {extensionsBtn}
          {toggleBtn}
        </>
      ) : (
        <>
          {toggleBtn}
          {extensionsBtn}
          {settingsBtn}
        </>
      )}
    </div>
  );
}

export function WorkspaceSidebar() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyProjectCwd, setHistoryProjectCwd] = useState<string | undefined>();
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);
  const [chatsSectionOpen, setChatsSectionOpen] = useState(true);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [menu, setMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [sessionMenu, setSessionMenu] = useState<{
    sessionId: string;
    x: number;
    y: number;
  } | null>(null);
  const [unsupportedSessionActions, setUnsupportedSessionActions] = useState<
    Set<string>
  >(new Set());
  const refreshSpin = useRef(false);
  const [, setRefreshTick] = useState(0);

  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const sidebarCollapsed = useWorkspaceStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceStore((s) => s.setSidebarCollapsed);
  const openProject = useWorkspaceStore((s) => s.openProject);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);
  const prepareNewThread = useWorkspaceStore((s) => s.prepareNewThread);
  const closeSession = useWorkspaceStore((s) => s.closeSession);
  const removeProject = useWorkspaceStore((s) => s.removeProject);
  const renameProject = useWorkspaceStore((s) => s.renameProject);
  const archiveProjectSessions = useWorkspaceStore((s) => s.archiveProjectSessions);
  const setActiveSession = useWorkspaceStore((s) => s.setActiveSession);
  const setSessionTitle = useWorkspaceStore((s) => s.setSessionTitle);
  const openResumedSession = useWorkspaceStore((s) => s.openResumedSession);
  const pinnedPaths = useSettingsStore((s) => s.settings.pinnedProjectPaths);
  const expandedProjectCwds = useSettingsStore(
    (s) => s.settings.expandedProjectCwds ?? [],
  );
  const showAllThreadsProjectCwds = useSettingsStore(
    (s) => s.settings.showAllThreadsProjectCwds ?? [],
  );
  const chatsSectionShowAll = useSettingsStore(
    (s) => s.settings.chatsSectionShowAll ?? false,
  );
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const settings = useSettingsStore((s) => s.settings);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId],
  );

  const effectiveProjectId = useMemo(() => {
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
      return activeProjectId;
    }
    const fromSession = activeSession?.projectId;
    if (fromSession && projects.some((p) => p.id === fromSession)) {
      return fromSession;
    }
    return projects[0]?.id ?? null;
  }, [activeProjectId, activeSession?.projectId, projects]);

  const effectiveProject = effectiveProjectId
    ? projects.find((p) => p.id === effectiveProjectId)
    : undefined;

  const sidebarSessions = useMemo(
    () => sessions.filter(shouldShowInSidebar),
    [sessions],
  );

  const sortedProjects = useMemo(() => {
    const pinnedSet = new Set(pinnedPaths.map((p) => p.toLowerCase()));
    const pinned: Project[] = [];
    const rest: Project[] = [];
    for (const p of projects) {
      if (pinnedSet.has(p.cwd.toLowerCase())) pinned.push(p);
      else rest.push(p);
    }
    const pinOrder = (a: Project, b: Project) =>
      pinnedPaths.findIndex((x) => pathsEqual(x, a.cwd)) -
      pinnedPaths.findIndex((x) => pathsEqual(x, b.cwd));
    pinned.sort(pinOrder);
    return [...pinned, ...rest];
  }, [projects, pinnedPaths]);

  const visibleProjects = showPinnedOnly
    ? sortedProjects.filter((p) =>
        pinnedPaths.some((path) => pathsEqual(path, p.cwd)),
      )
    : sortedProjects;

  const allChats = useMemo(
    () => sortSessionsNewestFirst(sidebarSessions),
    [sidebarSessions],
  );

  const menuProject = menu
    ? projects.find((p) => p.id === menu.projectId)
    : undefined;
  const menuSession = sessionMenu
    ? sessions.find((session) => session.id === sessionMenu.sessionId)
    : undefined;

  const openHistory = useCallback((projectCwd?: string) => {
    setHistoryProjectCwd(projectCwd);
    setHistoryOpen(true);
  }, []);

  const handleNewProject = useCallback(async () => {
    const cwd = await pickProjectFolder();
    if (!cwd) return;
    const project = openProject(cwd);
    if (project) {
      setActiveProject(project.id);
      recordProjectPath(cwd);
    }
  }, [openProject, setActiveProject]);

  const handleRefresh = useCallback(() => {
    refreshSpin.current = true;
    setRefreshTick((n) => n + 1);
    window.setTimeout(() => {
      refreshSpin.current = false;
      setRefreshTick((n) => n + 1);
    }, 600);
  }, []);

  const togglePinProject = useCallback(
    (cwd: string) => {
      const pinned = settings.pinnedProjectPaths;
      const isPinned = pinned.some((p) => pathsEqual(p, cwd));
      const next = isPinned
        ? pinned.filter((p) => !pathsEqual(p, cwd))
        : [...pinned, cwd];
      void updateSettings({ pinnedProjectPaths: next });
    },
    [settings.pinnedProjectPaths, updateSettings],
  );

  const persistExpandedProjectCwds = useCallback(
    (next: string[]) => {
      void updateSettings({ expandedProjectCwds: next });
    },
    [updateSettings],
  );

  const persistShowAllThreadsProjectCwds = useCallback(
    (next: string[]) => {
      void updateSettings({ showAllThreadsProjectCwds: next });
    },
    [updateSettings],
  );

  const toggleProjectThreadsExpanded = useCallback(
    (cwd: string) => {
      persistExpandedProjectCwds(toggleProjectCwdInList(expandedProjectCwds, cwd));
    },
    [expandedProjectCwds, persistExpandedProjectCwds],
  );

  const showAllProjectThreads = useCallback(
    (cwd: string) => {
      persistShowAllThreadsProjectCwds(
        addProjectCwd(showAllThreadsProjectCwds, cwd),
      );
      if (!isProjectCwdInList(expandedProjectCwds, cwd)) {
        persistExpandedProjectCwds(addProjectCwd(expandedProjectCwds, cwd));
      }
    },
    [
      expandedProjectCwds,
      showAllThreadsProjectCwds,
      persistExpandedProjectCwds,
      persistShowAllThreadsProjectCwds,
    ],
  );

  const showFewerProjectThreads = useCallback(
    (cwd: string) => {
      persistShowAllThreadsProjectCwds(
        removeProjectCwd(showAllThreadsProjectCwds, cwd),
      );
    },
    [showAllThreadsProjectCwds, persistShowAllThreadsProjectCwds],
  );

  const projectMenuItems: SidebarMenuItem[] = useMemo(() => {
    if (!menuProject) return [];
    const isPinned = pinnedPaths.some((p) => pathsEqual(p, menuProject.cwd));
    return [
      {
        id: "pin",
        label: isPinned ? "Unpin project" : "Pin project",
        icon: isPinned ? <PinOff size={14} /> : <Pin size={14} />,
        onClick: () => togglePinProject(menuProject.cwd),
      },
      {
        id: "explorer",
        label: "Open in Explorer",
        icon: <FolderOpen size={14} />,
        onClick: () => void openPathInExplorer(menuProject.cwd),
      },
      {
        id: "worktree",
        label: "Create permanent worktree",
        icon: <GitBranch size={14} />,
        disabled: true,
        onClick: () => undefined,
      },
      {
        id: "rename",
        label: "Rename project",
        icon: <Pencil size={14} />,
        onClick: () => {
          const next = window.prompt("Rename project", menuProject.name);
          if (next != null) renameProject(menuProject.id, next);
        },
      },
      {
        id: "archive",
        label: "Archive chats",
        icon: <Archive size={14} />,
        onClick: () => void archiveProjectSessions(menuProject.id),
      },
      {
        id: "remove",
        label: "Remove",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => void removeProject(menuProject.id),
      },
    ];
  }, [
    menuProject,
    pinnedPaths,
    togglePinProject,
    renameProject,
    archiveProjectSessions,
    removeProject,
  ]);

  const { sidebarWidth, resizing, onResizePointerDown } = useSidebarResize();

  const headerMenuItems: SidebarMenuItem[] = useMemo(
    () => [
      {
        id: "pinned-only",
        label: showPinnedOnly ? "Show all projects" : "Show pinned only",
        icon: showPinnedOnly ? <PinOff size={14} /> : <Pin size={14} />,
        onClick: () => setShowPinnedOnly((v) => !v),
      },
      {
        id: "history",
        label: "All session history",
        icon: <History size={14} />,
        onClick: () => openHistory(),
      },
    ],
    [showPinnedOnly, openHistory],
  );

  const markSessionActionUnsupported = (action: string) =>
    setUnsupportedSessionActions((current) => new Set(current).add(action));

  const reportSessionActionError = (action: string, error: unknown) => {
    window.alert(
      error instanceof Error ? error.message : `Failed to ${action} session`,
    );
  };

  const renameOpenSession = async (session: Session) => {
    if (!session.grokSessionId) return;
    const title = window.prompt("Rename session", session.title)?.trim();
    if (!title) return;
    if (!(await renameSession(session.id, session.grokSessionId, title))) {
      markSessionActionUnsupported("rename");
      return;
    }
    setSessionTitle(session.id, title);
  };

  const forkOpenSession = async (session: Session) => {
    if (!session.grokSessionId) return;
    const forked = await forkSession(session.id, session.grokSessionId);
    if (!forked) {
      markSessionActionUnsupported("fork");
      return;
    }
    const cwd = forked.cwd ?? getSessionCwd(session, projects);
    if (!cwd) throw new Error("Could not resolve project folder for the forked session");
    openResumedSession(
      cwd,
      forked.sessionId,
      forked.title ?? `${displayThreadTitle(session)} fork`,
    );
  };

  const deleteOpenSession = async (session: Session) => {
    if (
      !session.grokSessionId ||
      !window.confirm("Delete this session from Grok history? This cannot be undone.")
    ) {
      return;
    }
    if (!(await deleteSession(session.id, session.grokSessionId))) {
      markSessionActionUnsupported("delete");
      return;
    }
    await closeSession(session.id);
  };

  const sessionMenuItems: SidebarMenuItem[] = menuSession
    ? [
        ...(!unsupportedSessionActions.has("rename")
          ? [{
              id: "session-rename",
              label: "Rename session",
              icon: <Pencil size={14} />,
              onClick: () => {
                renameOpenSession(menuSession).catch((error) =>
                  reportSessionActionError("rename", error),
                );
              },
            }]
          : []),
        ...(!unsupportedSessionActions.has("fork")
          ? [{
              id: "session-fork",
              label: "Fork session",
              icon: <GitBranch size={14} />,
              onClick: () => {
                forkOpenSession(menuSession).catch((error) =>
                  reportSessionActionError("fork", error),
                );
              },
            }]
          : []),
        ...(!unsupportedSessionActions.has("delete")
          ? [{
              id: "session-delete",
              label: "Delete from Grok history",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => {
                deleteOpenSession(menuSession).catch((error) =>
                  reportSessionActionError("delete", error),
                );
              },
            }]
          : []),
      ]
    : [];

  useEffect(() => {
    const id = window.setInterval(() => setRefreshTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (sidebarCollapsed) {
    return (
      <aside className="codex-sidebar codex-sidebar--collapsed">
        <div className="codex-sidebar-rail">
          <div className="codex-sidebar-rail__top">
            <button
              type="button"
              className="codex-icon-btn codex-icon-btn--primary"
              aria-label={
                effectiveProject
                  ? `New thread in ${effectiveProject.name}`
                  : "New thread"
              }
              title={
                effectiveProject
                  ? `New thread (${effectiveProject.name})`
                  : "Add a project to start a thread"
              }
              disabled={effectiveProjectId == null}
              onClick={() => {
                if (effectiveProjectId) prepareNewThread(effectiveProjectId);
              }}
            >
              <GitBranch size={18} />
            </button>
          </div>
          <SidebarBottomActions
            collapsed
            onToggleSidebar={() => setSidebarCollapsed(false)}
          />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`codex-sidebar${resizing ? " codex-sidebar--resizing" : ""}`}
      style={{ width: sidebarWidth }}
    >
      <div
        className="codex-sidebar__resize-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        aria-valuenow={sidebarWidth}
        onPointerDown={onResizePointerDown}
      />
      <div className="codex-sidebar__scroll">
        <section className="codex-section">
          <div className="codex-section__header">
            <button
              type="button"
              className="codex-section__title-btn"
              onClick={() => setProjectsSectionOpen((v) => !v)}
            >
              <span>Projects</span>
              {projectsSectionOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
            <div className="codex-section__tools">
              <button
                type="button"
                className="codex-icon-btn"
                aria-label="Refresh projects"
                title="Refresh"
                onClick={handleRefresh}
              >
                <RefreshCw
                  size={14}
                  className={refreshSpin.current ? "codex-spin" : undefined}
                />
              </button>
              <button
                type="button"
                className="codex-icon-btn"
                aria-label="Projects menu"
                title="More options"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHeaderMenu({ x: rect.left, y: rect.bottom + 4 });
                }}
              >
                <MoreHorizontal size={14} />
              </button>
              <button
                type="button"
                className="codex-icon-btn codex-icon-btn--primary"
                aria-label="Add project"
                title="Add project"
                onClick={() => void handleNewProject()}
              >
                <FolderPlus size={14} />
              </button>
            </div>
          </div>

          {projectsSectionOpen && (
            <div className="codex-section__body">
              {visibleProjects.length === 0 ? (
                <div className="codex-empty-block">
                  <p className="codex-empty">
                    {showPinnedOnly
                      ? "No pinned projects."
                      : "Add a project to get started."}
                  </p>
                  {!showPinnedOnly && (
                    <button
                      type="button"
                      className="codex-add-project"
                      onClick={() => void handleNewProject()}
                    >
                      <FolderPlus size={14} />
                      Add project
                    </button>
                  )}
                </div>
              ) : (
                visibleProjects.map((project) => {
                  const projectSessions = sessions.filter(
                    (s) => s.projectId === project.id,
                  );
                  const expanded = isProjectCwdInList(
                    expandedProjectCwds,
                    project.cwd,
                  );
                  const showAll = isProjectCwdInList(
                    showAllThreadsProjectCwds,
                    project.cwd,
                  );

                  return (
                    <ProjectBlock
                      key={project.id}
                      project={project}
                      sessions={projectSessions}
                      expanded={expanded}
                      activeSessionId={activeSessionId}
                      showAllThreads={showAll}
                      pinned={pinnedPaths.some((p) =>
                        pathsEqual(p, project.cwd),
                      )}
                      onToggleExpand={() =>
                        toggleProjectThreadsExpanded(project.cwd)
                      }
                      onShowMore={() => showAllProjectThreads(project.cwd)}
                      onShowLess={() => showFewerProjectThreads(project.cwd)}
                      onSelectSession={setActiveSession}
                      onOpenMenu={(el) => {
                        const rect = el.getBoundingClientRect();
                        setMenu({
                          projectId: project.id,
                          x: rect.left,
                          y: rect.bottom + 4,
                        });
                      }}
                      onNewThread={() => prepareNewThread(project.id)}
                      onDeleteSession={(id) => void closeSession(id)}
                      onOpenSessionActions={(id, anchor) => {
                        const rect = anchor.getBoundingClientRect();
                        setSessionMenu({
                          sessionId: id,
                          x: rect.left,
                          y: rect.bottom + 4,
                        });
                      }}
                    />
                  );
                })
              )}

            </div>
          )}
        </section>

        <section className="codex-section codex-section--chats">
          <div className="codex-section__header">
            <button
              type="button"
              className="codex-section__title-btn"
              onClick={() => setChatsSectionOpen((v) => !v)}
            >
              <span>Chats</span>
              {chatsSectionOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          </div>
          {chatsSectionOpen && (
            <div className="codex-section__body">
              {allChats.length === 0 ? (
                <p className="codex-empty">No open chats.</p>
              ) : (
                <SidebarThreadList
                  sessions={allChats}
                  activeSessionId={activeSessionId}
                  showAllThreads={chatsSectionShowAll}
                  onShowMore={() =>
                    void updateSettings({ chatsSectionShowAll: true })
                  }
                  onShowLess={() =>
                    void updateSettings({ chatsSectionShowAll: false })
                  }
                  onSelectSession={setActiveSession}
                  onDeleteSession={(id) => void closeSession(id)}
                  onOpenSessionActions={(id, anchor) => {
                    const rect = anchor.getBoundingClientRect();
                    setSessionMenu({
                      sessionId: id,
                      x: rect.left,
                      y: rect.bottom + 4,
                    });
                  }}
                  wrapClassName="codex-chats-list"
                />
              )}
            </div>
          )}
        </section>
      </div>

      <SidebarBottomActions
        collapsed={false}
        onToggleSidebar={() => setSidebarCollapsed(true)}
      />

      <SidebarMenu
        open={menu != null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={projectMenuItems}
        onClose={() => setMenu(null)}
      />
      <SidebarMenu
        open={sessionMenu != null}
        x={sessionMenu?.x ?? 0}
        y={sessionMenu?.y ?? 0}
        items={sessionMenuItems}
        onClose={() => setSessionMenu(null)}
      />
      <SidebarMenu
        open={headerMenu != null}
        x={headerMenu?.x ?? 0}
        y={headerMenu?.y ?? 0}
        items={headerMenuItems}
        onClose={() => setHeaderMenu(null)}
      />

      <SessionHistoryPanel
        open={historyOpen}
        projectCwd={historyProjectCwd}
        onClose={() => {
          setHistoryOpen(false);
          setHistoryProjectCwd(undefined);
        }}
      />
    </aside>
  );
}
