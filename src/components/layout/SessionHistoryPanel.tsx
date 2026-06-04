import { useCallback, useEffect, useMemo, useState } from "react";
import { History, Loader2, Search, X } from "lucide-react";
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

  const sessions = useWorkspaceStore((s) => s.sessions);
  const openResumedSession = useWorkspaceStore((s) => s.openResumedSession);

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
                <button
                  key={entry.id}
                  type="button"
                  className="session-history__row"
                  disabled={alreadyOpen || openingId === entry.id}
                  onClick={() => void handleOpen(entry)}
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
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}