import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Terminal, X } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { killTask, deleteScheduledTask, listTasks } from "@/lib/acp/xaiTask";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { AgentNode } from "@/lib/types";
import { openPath } from "@/lib/openInExplorer";

/** Stable empty reference so the selector snapshot does not change every render. */
const EMPTY_NODES: AgentNode[] = [];

export function TasksPane() {
  const tabId = useWorkspaceStore((s) => s.activeSessionId);
  const agentNodes = useWorkspaceStore((s) =>
    tabId
      ? s.sessions.find((session) => session.id === tabId)?.agentNodes ?? EMPTY_NODES
      : EMPTY_NODES,
  );
  const tasks = useTaskStore((s) => (tabId ? s.getTasks(tabId) : []));
  const scheduled = useTaskStore((s) => (tabId ? s.getScheduled(tabId) : []));
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!tabId) return;
    listTasks(tabId)
      .then(setSupported)
      .catch((e) => {
        setError(String(e));
        setSupported(true);
      });
  }, [tabId]);

  if (
    !tabId ||
    supported === false ||
    (tasks.length === 0 && scheduled.length === 0 && agentNodes.length === 0)
  ) {
    return null;
  }

  return (
    <section className="tasks-pane" aria-label="Background tasks">
      {error && <p className="tasks-pane__error">{error}</p>}
      <button
        type="button"
        className="tasks-pane__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Terminal size={14} aria-hidden />
        <span className="tasks-pane__title">Tasks</span>
        <span className="tasks-pane__badge">
          {tasks.length + scheduled.length + agentNodes.length}
        </span>
      </button>
      {expanded && (
        <>
          <ul className="tasks-pane__list">
            {tasks.map((t) => (
              <li key={t.taskId} className={`tasks-pane__item tasks-pane__item--${t.status}`}>
                <span className="tasks-pane__kind">
                  {t.kind === "monitor" ? "Monitor" : "Task"}
                </span>
                <span className="tasks-pane__cmd" title={t.command}>
                  {t.description ?? t.command}
                </span>
                {typeof t.lineCount === "number" && (
                  <span className="tasks-pane__lines">{t.lineCount} lines</span>
                )}
                {t.status === "running" && (
                  <button
                    type="button"
                    title="Kill task"
                    onClick={async () => {
                      if (tabId) await killTask(tabId, t.taskId);
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
                {t.outputFile && (
                  <button
                    type="button"
                    title="Open task output"
                    onClick={async () => {
                      await openPath(t.outputFile!);
                    }}
                  >
                    Output
                  </button>
                )}
              </li>
            ))}
          </ul>
          {scheduled.length > 0 && (
            <ul className="tasks-pane__scheduled">
              {scheduled.map((s) => (
                <li key={s.taskId} className="tasks-pane__item">
                  <Clock size={12} aria-hidden />
                  <span className="tasks-pane__cmd" title={s.prompt}>
                    {s.prompt} · {s.humanSchedule}
                  </span>
                  <button
                    type="button"
                    title="Delete schedule"
                    onClick={async () => {
                      if (tabId) await deleteScheduledTask(tabId, s.taskId);
                    }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ul className="tasks-pane__subagents" aria-label="Subagents">
            {agentNodes.map((node) => (
              <li key={node.id} className={`tasks-pane__item tasks-pane__item--${node.status}`}>
                <span className="tasks-pane__kind">Subagent</span>
                <span className="tasks-pane__cmd">{node.title}</span>
                {node.contextUsagePct != null && <span>{node.contextUsagePct}% context</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
