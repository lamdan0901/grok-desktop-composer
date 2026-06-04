import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import {
  activitySectionLabel,
  isActivityLive,
  isActivityTurnCollapsed,
} from "@/lib/groupTurnActivity";
import type { ChatMessage } from "@/lib/types";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";

interface TurnActivitySectionProps {
  items: Array<Extract<ChatMessage, { role: "thought" | "tool" }>>;
  /** True while the agent turn is still in flight for this thread. */
  turnActive: boolean;
}

export function TurnActivitySection({
  items,
  turnActive,
}: TurnActivitySectionProps) {
  const live = isActivityLive(items);
  const storeCollapsed = isActivityTurnCollapsed(items);
  const shouldStayOpen = live || turnActive;
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const activityKey = items[0]?.id ?? "";

  useEffect(() => {
    setUserExpanded(null);
  }, [activityKey]);

  useEffect(() => {
    if (!shouldStayOpen && storeCollapsed) {
      setUserExpanded(null);
    }
  }, [shouldStayOpen, storeCollapsed]);

  const defaultExpanded = shouldStayOpen ? true : !storeCollapsed;
  const expanded = userExpanded ?? defaultExpanded;

  const label = activitySectionLabel(items, live && expanded);

  return (
    <div
      className={`turn-activity${live ? " turn-activity--live" : ""}${expanded ? " turn-activity--expanded" : ""}`}
    >
      <button
        type="button"
        className="turn-activity__toggle"
        onClick={() => setUserExpanded((v) => !(v ?? expanded))}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Sparkles size={13} className="turn-activity__icon" aria-hidden />
        <span className="turn-activity__label">{label}</span>
        {live && expanded && (
          <Loader2
            size={13}
            className="turn-activity__spinner"
            aria-hidden
          />
        )}
      </button>
      {expanded && (
        <div className="turn-activity__body">
          {items.map((message) =>
            message.role === "thought" ? (
              <div key={message.id} className="turn-activity__item">
                <ThinkingBlock
                  content={message.content}
                  streaming={message.streaming}
                  startedAt={message.startedAt}
                  durationSeconds={message.durationSeconds}
                  embedded
                />
              </div>
            ) : (
              <div key={message.id} className="turn-activity__item">
                <ToolCallCard
                  title={message.title}
                  kind={message.kind}
                  path={message.path}
                  status={message.status}
                  fileDiff={message.fileDiff}
                  turnActive={turnActive}
                  embedded
                />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}