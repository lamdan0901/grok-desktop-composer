import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  if (!tabId || supported === false) return null;

  const handleToggle = async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (!nextExpanded) return;
    try {
      setSupported((await listRewindPoints(tabId)) !== null);
    } catch {
      setSupported(true);
    }
  };

  const handleRestore = async (pointId: string) => {
    const point = points.find((item) => item.id === pointId);
    if (
      !point ||
      !window.confirm("Restore files to this rewind point? This cannot be undone.")
    ) {
      return;
    }
    setSupported(await executeRewind(tabId, pointId));
  };

  return (
    <section className="tasks-pane" aria-label="Rewind points">
      <button
        type="button"
        className="tasks-pane__toggle"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label="Rewind files"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <History size={14} aria-hidden />
        <span className="tasks-pane__title">Rewind</span>
        {points.length > 0 && <span className="tasks-pane__badge">{points.length}</span>}
      </button>
      {expanded && (
        <div className="tasks-pane__list">
          {error && <p className="tasks-pane__error">{error}</p>}
          {loading ? (
            <p>Loading rewind points…</p>
          ) : points.length === 0 ? (
            <p>No rewind points.</p>
          ) : (
            points.map((point) => (
              <div key={point.id} className="tasks-pane__item">
                <span className="tasks-pane__cmd">
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
