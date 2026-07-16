import { ArrowDown, ArrowUp, ListOrdered, Trash2, Zap } from "lucide-react";
import {
  clearQueuedPrompts,
  promoteQueuedPrompt,
  removeQueuedPrompt,
  reorderQueuedPrompt,
} from "@/lib/acp/xaiQueue";
import { useQueueStore } from "@/stores/queueStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const EMPTY_QUEUE: never[] = [];

export function PromptQueuePanel() {
  const tabId = useWorkspaceStore((state) => state.activeSessionId);
  const items = useQueueStore((state) =>
    tabId ? state.bySession[tabId] ?? EMPTY_QUEUE : EMPTY_QUEUE,
  );

  if (!tabId || items.length === 0) return null;

  return (
    <section className="tasks-pane" aria-label="Prompt queue">
      <div className="tasks-pane__toggle">
        <ListOrdered size={14} aria-hidden />
        <span className="tasks-pane__title">Queue</span>
        <span className="tasks-pane__badge">{items.length}</span>
        <button
          type="button"
          aria-label="Clear prompt queue"
          onClick={async () => {
            await clearQueuedPrompts(tabId);
          }}
        >
          Clear
        </button>
      </div>
      <ul className="tasks-pane__list">
        {items.map((item, index) => (
          <li key={item.id} className="tasks-pane__item">
            <span className="tasks-pane__cmd">{item.text}</span>
            <button
              type="button"
              aria-label={`Move ${item.text} up`}
              disabled={index === 0}
              onClick={async () => {
                await reorderQueuedPrompt(tabId, item.id, index - 1);
              }}
            >
              <ArrowUp size={12} />
            </button>
            <button
              type="button"
              aria-label={`Move ${item.text} down`}
              disabled={index === items.length - 1}
              onClick={async () => {
                await reorderQueuedPrompt(tabId, item.id, index + 1);
              }}
            >
              <ArrowDown size={12} />
            </button>
            <button
              type="button"
              aria-label={`Interject ${item.text} next`}
              onClick={async () => {
                await promoteQueuedPrompt(tabId, item.id);
              }}
            >
              <Zap size={12} />
            </button>
            <button
              type="button"
              aria-label={`Remove ${item.text}`}
              onClick={async () => {
                await removeQueuedPrompt(tabId, item.id);
              }}
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
