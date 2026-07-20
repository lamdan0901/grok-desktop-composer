import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { executeRewind, listRewindPoints } from "@/lib/acp/xaiRewind";
import { useRewindStore } from "@/stores/rewindStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const EMPTY_POINTS: never[] = [];

export function RewindPanel() {
  const tabId = useWorkspaceStore((state) => state.activeSessionId);
  const points = useRewindStore((state) =>
    tabId ? state.pointsBySession[tabId] ?? EMPTY_POINTS : EMPTY_POINTS,
  );
  const loading = useRewindStore((state) =>
    tabId ? state.loadingBySession[tabId] ?? false : false,
  );
  const error = useRewindStore((state) =>
    tabId ? state.errorBySession[tabId] ?? null : null,
  );
  const setError = useRewindStore((state) => state.setError);
  const [expanded, setExpanded] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (!tabId) return;
    listRewindPoints(tabId)
      .then((result) => setSupported(result !== null))
      .catch(() => setSupported(true));
  }, [tabId]);

  if (!tabId || supported === false || points.length === 0) return null;

  const handleToggle = () => {
    setExpanded((value) => !value);
  };

  const handleRestore = async (pointId: string) => {
    const point = points.find((item) => item.id === pointId);
    if (
      !point ||
      !window.confirm("Restore files to this rewind point? This cannot be undone.")
    ) {
      return;
    }
    try {
      setSupported(await executeRewind(tabId, pointId));
    } catch (restoreError) {
      setError(
        tabId,
        restoreError instanceof Error
          ? restoreError.message
          : "Failed to restore rewind point",
      );
    }
  };

  return (
    <section
      className={expanded ? "todo-panel rewind-panel--expanded" : "rewind-panel"}
      aria-label="Rewind points"
    >
      <button
        type="button"
        className={expanded ? "todo-panel__toggle" : "rewind-panel__trigger"}
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label="Rewind files"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <History
          size={14}
          className={expanded ? "todo-panel__header-icon" : undefined}
          aria-hidden
        />
        <span className={expanded ? "todo-panel__title" : undefined}>Rewind</span>
        <span className={expanded ? "todo-panel__badge" : "rewind-panel__badge"}>
          {points.length}
        </span>
      </button>
      {expanded && (
        <div className="todo-panel__list">
          {error && <p className="tasks-pane__error">{error}</p>}
          {loading ? (
            <p>Loading rewind points…</p>
          ) : (
            points.map((point) => (
              <div key={point.id} className="todo-panel__item">
                <span className="todo-panel__text">
                  {point.label}
                  {point.fileCount != null ? ` · ${point.fileCount} files` : ""}
                </span>
                <button
                  type="button"
                  aria-label={`Restore ${point.label}`}
                  onClick={async () => {
                    await handleRestore(point.id);
                  }}
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
