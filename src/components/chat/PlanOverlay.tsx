import { useCallback, useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { approvePlan, revisePlan } from "@/lib/plan";
import { usePlanStore } from "@/stores/planStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

export function PlanOverlay() {
  const [feedback, setFeedback] = useState("");
  const [acting, setActing] = useState(false);

  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);

  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const plan = usePlanStore((s) =>
    activeSessionId != null ? s.bySession[activeSessionId] : undefined,
  );

  const visible = session?.status === "plan_review";

  const handleApprove = useCallback(async () => {
    if (!session || !cwd || acting) return;
    setActing(true);
    try {
      await approvePlan(session.id, cwd);
      setFeedback("");
    } finally {
      setActing(false);
    }
  }, [session, cwd, acting]);

  const handleRevise = useCallback(async () => {
    if (!session || !cwd || acting) return;
    setActing(true);
    try {
      await revisePlan(session.id, cwd, feedback);
      setFeedback("");
    } finally {
      setActing(false);
    }
  }, [session, cwd, feedback, acting]);

  if (!visible || !session) return null;

  const content = plan?.content?.trim();
  const showEmpty = !content && !plan?.loading;

  return (
    <div className="plan-overlay" role="dialog" aria-label="Plan review">
      <div className="plan-overlay__backdrop" aria-hidden />
      <div className="plan-overlay__panel">
        <header className="plan-overlay__header">
          <div className="plan-overlay__title-row">
            <ClipboardList size={20} className="plan-overlay__icon" />
            <h2 className="plan-overlay__title">Plan</h2>
          </div>
          <button
            type="button"
            className="plan-overlay__close"
            aria-label="Close plan overlay"
            disabled={acting}
            onClick={() => void handleRevise()}
          >
            <X size={18} />
          </button>
        </header>

        <div className="plan-overlay__body">
          {plan?.loading && !content ? (
            <p className="plan-overlay__status">Loading plan…</p>
          ) : plan?.error ? (
            <p className="plan-overlay__status plan-overlay__status--error">
              {plan.error}
            </p>
          ) : showEmpty ? (
            <p className="plan-overlay__status">
              Waiting for plan content. The agent may still be writing{" "}
              <code>plan.md</code>…
            </p>
          ) : (
            <div className="plan-overlay__markdown message__markdown">
              <MarkdownContent>{content ?? ""}</MarkdownContent>
            </div>
          )}
        </div>

        <div className="plan-overlay__feedback">
          <label className="plan-overlay__feedback-label" htmlFor="plan-feedback">
            Revision notes (optional)
          </label>
          <textarea
            id="plan-feedback"
            className="plan-overlay__feedback-input"
            rows={2}
            placeholder="Describe what to change in the plan…"
            value={feedback}
            disabled={acting}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>

        <footer className="plan-overlay__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={acting || !cwd}
            onClick={() => void handleApprove()}
          >
            Approve & build
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={acting || !cwd}
            onClick={() => void handleRevise()}
          >
            Revise plan
          </button>
        </footer>
      </div>
    </div>
  );
}