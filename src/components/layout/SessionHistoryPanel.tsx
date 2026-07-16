import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitBranch,
  History,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  listGrokSessions,
  resolveGrokSessionCwd,
} from "@/lib/grok";
import { pathsEqual } from "@/lib/pathUtils";
import { notifyMaxSessions } from "@/lib/projectFolder";
import { parseGrokSessionTimestamp } from "@/lib/relativeTime";
import { MAX_SESSIONS } from "@/lib/constants";
import type { GrokSessionEntry } from "@/lib/types";
import {
  isAtSessionAgentLimit,
  useWorkspaceStore,
} from "@/stores/workspaceStore";
import {
  deleteSession,
  forkSession,
  renameSession,
} from "@/lib/acp/xaiSession";
import { SidebarMenu, type SidebarMenuItem } from "./SidebarMenu";
import { forkIntoWorktree } from "@/lib/acp/xaiWorktree";

interface SessionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  /** When set, only sessions for this project folder are listed. */
  projectCwd?: string;
}

export function SessionHistoryPanel({
  open,
  onClose,
  projectCwd,
}: SessionHistoryPanelProps) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<GrokSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    entry: GrokSessionEntry;
    x: number;
    y: number;
  } | null>(null);
  const [unsupported, setUnsupported] = useState<Set<string>>(new Set());

  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const openResumedSession = useWorkspaceStore((s) => s.openResumedSession);
  const closeSession = useWorkspaceStore((s) => s.closeSession);
  const setSessionTitle = useWorkspaceStore((s) => s.setSessionTitle);

  const filteredEntries = useMemo(() => {
    if (!projectCwd) return entries;
    return entries.filter(
      (e) => e.cwd && pathsEqual(e.cwd, projectCwd),
    );
  }, [entries, projectCwd]);

  const refresh = useCallback(async (searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const list = await listGrokSessions(40, searchQuery);
      setEntries(list);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load sessions",
      );
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, query ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [open, query, refresh]);

  const handleOpen = async (entry: GrokSessionEntry) => {
    if (isAtSessionAgentLimit(sessions)) {
      await notifyMaxSessions(MAX_SESSIONS);
      return;
    }
    setOpeningId(entry.id);
    try {
      let cwd = entry.cwd;
      if (!cwd) {
        cwd = (await resolveGrokSessionCwd(entry.id)) ?? undefined;
      }
      if (!cwd) {
        setError("Could not resolve project folder for this session.");
        return;
      }
      const lastActiveAt = parseGrokSessionTimestamp(
        entry.updated ?? entry.created,
      );
      const session = openResumedSession(
        cwd,
        entry.id,
        entry.summary || "Resumed thread",
        lastActiveAt,
      );
      if (session) onClose();
    } finally {
      setOpeningId(null);
    }
  };

  const transportTabId = (entry: GrokSessionEntry) =>
    sessions.find((session) => session.grokSessionId === entry.id)?.id ??
    activeSessionId;

  const markUnsupported = (action: string) =>
    setUnsupported((current) => new Set(current).add(action));

  const handleRename = async (entry: GrokSessionEntry) => {
    const tabId = transportTabId(entry);
    const title = window.prompt("Rename session", entry.summary)?.trim();
    if (!tabId || !title) return;
    if (!(await renameSession(tabId, entry.id, title))) {
      markUnsupported("rename");
      return;
    }
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, summary: title } : item,
      ),
    );
    const open = sessions.find((session) => session.grokSessionId === entry.id);
    if (open) setSessionTitle(open.id, title);
  };

  const handleDelete = async (entry: GrokSessionEntry) => {
    const tabId = transportTabId(entry);
    if (
      !tabId ||
      !window.confirm("Delete this session from Grok history? This cannot be undone.")
    ) {
      return;
    }
    if (!(await deleteSession(tabId, entry.id))) {
      markUnsupported("delete");
      return;
    }
    const open = sessions.find((session) => session.grokSessionId === entry.id);
    if (open) await closeSession(open.id);
    await refresh(query);
  };

  const handleFork = async (entry: GrokSessionEntry) => {
    const tabId = transportTabId(entry);
    if (!tabId) return;
    if (isAtSessionAgentLimit(sessions)) {
      await notifyMaxSessions(MAX_SESSIONS);
      return;
    }
    const forked = await forkSession(tabId, entry.id);
    if (!forked) {
      markUnsupported("fork");
      return;
    }
    const cwd =
      forked.cwd ?? entry.cwd ?? (await resolveGrokSessionCwd(entry.id)) ?? undefined;
    if (!cwd) throw new Error("Could not resolve project folder for the forked session");
    openResumedSession(
      cwd,
      forked.sessionId,
      forked.title ?? `${entry.summary || "Session"} fork`,
    );
    onClose();
  };

  const handleWorktreeFork = async (entry: GrokSessionEntry) => {
    const tabId = transportTabId(entry);
    const worktreePath = window.prompt("Worktree folder path")?.trim();
    if (
      !tabId ||
      !worktreePath ||
      !window.confirm(
        `Create a git worktree at ${worktreePath}? Files will be created there.`,
      )
    ) {
      return;
    }
    const forked = await forkIntoWorktree(tabId, entry.id, worktreePath);
    if (!forked) {
      markUnsupported("worktree");
      return;
    }
    openResumedSession(
      forked.cwd,
      forked.sessionId,
      `${entry.summary || "Session"} worktree`,
    );
    onClose();
  };

  const reportActionError = (action: string, actionError: unknown) => {
    setError(
      actionError instanceof Error
        ? actionError.message
        : `Failed to ${action} session`,
    );
  };

  const menuItems: SidebarMenuItem[] = menu
    ? [
        ...(!unsupported.has("rename")
          ? [{
              id: "rename",
              label: "Rename session",
              icon: <Pencil size={14} />,
              onClick: () => {
                handleRename(menu.entry).catch((actionError) =>
                  reportActionError("rename", actionError),
                );
              },
            }]
          : []),
        ...(!unsupported.has("fork")
          ? [{
              id: "fork",
              label: "Fork session",
              icon: <GitBranch size={14} />,
              onClick: () => {
                handleFork(menu.entry).catch((actionError) =>
                  reportActionError("fork", actionError),
                );
              },
            }]
          : []),
        ...(!unsupported.has("delete")
          ? [{
              id: "delete",
              label: "Delete from Grok history",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: () => {
                handleDelete(menu.entry).catch((actionError) =>
                  reportActionError("delete", actionError),
                );
              },
            }]
          : []),
        ...(!unsupported.has("worktree")
          ? [{
              id: "worktree",
              label: "Fork into worktree…",
              icon: <GitBranch size={14} />,
              onClick: () => {
                handleWorktreeFork(menu.entry).catch((actionError) =>
                  reportActionError("fork into worktree", actionError),
                );
              },
            }]
          : []),
      ]
    : [];

  if (!open) return null;

  return (
    <div className="session-history">
      <div
        className="session-history__backdrop"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className="session-history__panel"
        role="dialog"
        aria-label="Session history"
      >
        <header className="session-history__header">
          <div className="session-history__title">
            <History size={18} />
            <h2>
              {projectCwd ? "Project sessions" : "Session history"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close session history"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="session-history__search">
          <Search size={15} className="session-history__search-icon" />
          <input
            type="search"
            placeholder="Search sessions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {error && <p className="session-history__error">{error}</p>}

        <div className="session-history__list">
          {loading && filteredEntries.length === 0 ? (
            <div className="session-history__status">
              <Loader2 size={18} className="spin" />
              Loading sessions…
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="session-history__status">
              {projectCwd
                ? "No saved sessions for this project yet."
                : "No sessions found."}
            </p>
          ) : (
            filteredEntries.map((entry) => {
              const alreadyOpen = sessions.some(
                (s) => s.grokSessionId === entry.id,
              );
              return (
                <div key={entry.id} className="session-history__row-wrap">
                  <button
                    type="button"
                    className="session-history__row"
                    disabled={alreadyOpen || openingId === entry.id}
                    onClick={async () => {
                      await handleOpen(entry);
                    }}
                    title={entry.cwd ?? entry.id}
                  >
                    <span className="session-history__summary">
                      {entry.summary || "(no summary)"}
                    </span>
                    <span className="session-history__meta">
                      {entry.updated ?? entry.created ?? ""}
                      {entry.cwd ? ` · ${entry.cwd}` : ""}
                    </span>
                    {alreadyOpen && (
                      <span className="session-history__badge">Open</span>
                    )}
                    {openingId === entry.id && (
                      <Loader2 size={14} className="spin session-history__spin" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="session-history__actions icon-btn"
                    aria-label={`Actions for ${entry.summary || "session"}`}
                    disabled={!transportTabId(entry)}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMenu({ entry, x: rect.left, y: rect.bottom + 4 });
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <SidebarMenu
          open={menu != null}
          x={menu?.x ?? 0}
          y={menu?.y ?? 0}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      </aside>
    </div>
  );
}
