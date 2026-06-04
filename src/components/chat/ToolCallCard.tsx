import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Search,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { hasFileDiffContent, isFileDiffTool } from "@/lib/fileDiff";
import { basenameFromPath } from "@/lib/toolPresentation";
import type { FileDiffSource, ToolCallDisplayStatus } from "@/lib/types";
import { FileDiffView } from "./FileDiffView";

interface ToolCallCardProps {
  title: string;
  kind?: string;
  path?: string;
  status: ToolCallDisplayStatus;
  fileDiff?: FileDiffSource;
  /** Rendered inside a turn activity section (no separate collapse). */
  embedded?: boolean;
  /** While true, the diff panel stays expanded until the user collapses it. */
  turnActive?: boolean;
}

function ToolIcon({ kind }: { kind?: string }) {
  const size = 14;
  switch (kind) {
    case "read":
      return <FileText size={size} />;
    case "edit":
    case "delete":
    case "move":
      return <Pencil size={size} />;
    case "search":
      return <Search size={size} />;
    case "execute":
      return <Terminal size={size} />;
    default:
      return <Wrench size={size} />;
  }
}

function StatusBadge({ status }: { status: ToolCallDisplayStatus }) {
  if (status === "running") {
    return <Loader2 size={13} className="tool-card__status tool-card__status--spin" />;
  }
  if (status === "completed") {
    return <Check size={13} className="tool-card__status tool-card__status--done" />;
  }
  if (status === "failed") {
    return <X size={13} className="tool-card__status tool-card__status--fail" />;
  }
  return null;
}

export function ToolCallCard({
  title,
  kind,
  path,
  status,
  fileDiff,
  embedded,
  turnActive = false,
}: ToolCallCardProps) {
  const pathLabel = path ? basenameFromPath(path) : null;
  const isWriteTool = isFileDiffTool(title, kind);
  const toolLive = status === "running" || status === "pending";
  const shouldAutoExpandDiff = isWriteTool && (turnActive || toolLive);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!shouldAutoExpandDiff) {
      setUserExpanded(null);
    }
  }, [shouldAutoExpandDiff]);

  const isExpanded =
    isWriteTool && (userExpanded ?? shouldAutoExpandDiff);

  const row = (
    <div className="tool-card__row">
      {isWriteTool && (
        <span className="tool-card__chevron" aria-hidden>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
      <span className="tool-card__icon" aria-hidden>
        <ToolIcon kind={kind} />
      </span>
      <div className="tool-card__body">
        <span className="tool-card__title">{title}</span>
        {pathLabel && (
          <span className="tool-card__path" title={path}>
            {pathLabel}
          </span>
        )}
      </div>
      <StatusBadge status={status} />
    </div>
  );

  return (
    <div
      className={`tool-card tool-card--${status}${embedded ? " tool-card--embedded" : ""}${isWriteTool ? " tool-card--diffable" : ""}${isExpanded ? " tool-card--expanded" : ""}`}
    >
      {isWriteTool ? (
        <button
          type="button"
          className="tool-card__toggle"
          onClick={() => setUserExpanded((v) => !(v ?? isExpanded))}
          aria-expanded={isExpanded}
        >
          {row}
        </button>
      ) : (
        row
      )}
      {isExpanded && (
        <div className="tool-card__diff">
          {fileDiff && hasFileDiffContent(fileDiff) ? (
            <FileDiffView source={fileDiff} />
          ) : (
            <p className="tool-card__diff-empty">No diff content for this edit yet.</p>
          )}
        </div>
      )}
    </div>
  );
}