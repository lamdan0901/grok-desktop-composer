import { useState } from "react";
import { useQuestionStore } from "@/stores/questionStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AskQuestionOverlay() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const pending = useQuestionStore((s) =>
    activeSessionId ? s.pendingBySession[activeSessionId] : undefined,
  );
  const respond = useQuestionStore((s) => s.respond);
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  if (!activeSessionId || !pending) return null;

  const toggle = (q: string, label: string, multi: boolean) => {
    setSelected((prev) => {
      const cur = prev[q] ?? [];
      if (multi) {
        return {
          ...prev,
          [q]: cur.includes(label)
            ? cur.filter((l) => l !== label)
            : [...cur, label],
        };
      }
      return { ...prev, [q]: [label] };
    });
  };

  const accept = () => {
    respond(activeSessionId, { outcome: "accepted", answers: selected });
    setSelected({});
  };
  const cancel = () => {
    respond(activeSessionId, { outcome: "cancelled" });
    setSelected({});
  };

  return (
    <div className="ask-question-overlay" role="dialog" aria-label="Agent question">
      {pending.questions.map((q) => (
        <fieldset key={q.id ?? q.question} className="ask-question__group">
          <legend>{q.question}</legend>
          {q.options.map((o) => {
            const on = (selected[q.question] ?? []).includes(o.label);
            return (
              <button
                key={o.id ?? o.label}
                type="button"
                className={`ask-question__option${on ? " ask-question__option--on" : ""}`}
                onClick={() => toggle(q.question, o.label, q.multiSelect === true)}
              >
                <span className="ask-question__label">{o.label}</span>
                {o.description && (
                  <span className="ask-question__desc">{o.description}</span>
                )}
              </button>
            );
          })}
        </fieldset>
      ))}
      <div className="ask-question__actions">
        <button type="button" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          onClick={accept}
          disabled={Object.keys(selected).length === 0}
        >
          Submit
        </button>
      </div>
    </div>
  );
}
