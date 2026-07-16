import { useCallback, useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { MarkdownContent } from "./MarkdownContent";
import { approvePlan, revisePlan } from "@/lib/plan";
import {
  formatPlanComments,
  sendApprovedPlanComments,
  type PlanComment,
} from "@/lib/planComments";
import { usePlanStore } from "@/stores/planStore";
import { usePlanReviewStore } from "@/stores/planReviewStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

const EMPTY_COMMENTS: PlanComment[] = [];

export function PlanOverlay() {
  const [feedback, setFeedback] = useState("");
  const [acting, setActing] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");

  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);

  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const plan = usePlanStore((s) =>
    activeSessionId != null ? s.bySession[activeSessionId] : undefined,
  );
  const reverseReview = usePlanReviewStore((s) =>
    activeSessionId != null ? s.pendingBySession[activeSessionId] : undefined,
  );
  const resolveReview = usePlanReviewStore((s) => s.resolve);
  const comments = usePlanReviewStore((s) =>
    activeSessionId != null
      ? s.commentsBySession[activeSessionId] ?? EMPTY_COMMENTS
      : EMPTY_COMMENTS,
  );
  const addComment = usePlanReviewStore((s) => s.addComment);
  const removeComment = usePlanReviewStore((s) => s.removeComment);
  const clearComments = usePlanReviewStore((s) => s.clearComments);
  const setSessionStatus = useWorkspaceStore((s) => s.setSessionStatus);
  const appendError = useWorkspaceStore((s) => s.appendError);

  const visible = session?.status === "plan_review";

  const handleApprove = useCallback(async () => {
    if (!session || acting) return;
    // Reverse exit_plan_mode request: resolve it directly instead of the
    // permission-option path.
    if (reverseReview && activeSessionId) {
      resolveReview(activeSessionId, { outcome: "approved" });
      setSessionStatus(activeSessionId, "running");
      setFeedback("");
      if (comments.length > 0) {
        setActing(true);
        try {
          await sendApprovedPlanComments(activeSessionId, comments);
        } catch (error) {
          appendError(
            activeSessionId,
            error instanceof Error
              ? error.message
              : "Failed to send approved plan comments",
          );
        } finally {
          setActing(false);
        }
      }
      return;
    }
    if (!cwd) return;
    setActing(true);
    try {
      await approvePlan(session.id, cwd);
      setFeedback("");
      clearComments(session.id);
    } finally {
      setActing(false);
    }
  }, [
    session,
    cwd,
    acting,
    reverseReview,
    activeSessionId,
    resolveReview,
    setSessionStatus,
    comments,
    appendError,
    clearComments,
  ]);

  const handleRevise = useCallback(async () => {
    if (!session || acting) return;
    const combinedFeedback = [formatPlanComments(comments), feedback.trim()]
      .filter(Boolean)
      .join("\n\n");
    if (reverseReview && activeSessionId) {
      resolveReview(activeSessionId, {
        outcome: "cancelled",
        feedback: combinedFeedback || undefined,
      });
      setSessionStatus(activeSessionId, "running");
      setFeedback("");
      return;
    }
    if (!cwd) return;
    setActing(true);
    try {
      await revisePlan(session.id, cwd, combinedFeedback);
      setFeedback("");
      clearComments(session.id);
    } finally {
      setActing(false);
    }
  }, [
    session,
    cwd,
    feedback,
    acting,
    reverseReview,
    activeSessionId,
    resolveReview,
    setSessionStatus,
    comments,
    clearComments,
  ]);

  if (!visible || !session) return null;

  const content = plan?.content?.trim();
  const showEmpty = !content && !plan?.loading;
  const lines = (content ?? "").split("\n");

  const saveComment = () => {
    const text = commentText.trim();
    if (!activeSessionId || selectedLine == null || !text) return;
    const comment: PlanComment = {
      id: crypto.randomUUID(),
      line: selectedLine,
      text,
    };
    addComment(activeSessionId, comment);
    setSelectedLine(null);
    setCommentText("");
  };

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
            <ol className="plan-overlay__lines">
              {lines.map((line, index) => {
                const lineNumber = index + 1;
                return (
                  <li key={lineNumber} className="plan-overlay__line">
                    <span className="plan-overlay__line-number">{lineNumber}</span>
                    <div className="plan-overlay__line-text message__markdown">
                      <MarkdownContent>{line || " "}</MarkdownContent>
                    </div>
                    <button
                      type="button"
                      className="plan-overlay__line-comment-btn"
                      aria-label={`Add comment to line ${lineNumber}`}
                      onClick={() => {
                        setSelectedLine(lineNumber);
                        setCommentText("");
                      }}
                    >
                      +
                    </button>
                    {selectedLine === lineNumber && (
                      <div className="plan-overlay__comment-editor">
                        <label htmlFor={`plan-comment-${lineNumber}`}>
                          Comment for line {lineNumber}
                        </label>
                        <textarea
                          id={`plan-comment-${lineNumber}`}
                          value={commentText}
                          onChange={(event) => setCommentText(event.target.value)}
                        />
                        <button
                          type="button"
                          aria-label="Save line comment"
                          disabled={!commentText.trim()}
                          onClick={saveComment}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedLine(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {activeSessionId && comments.length > 0 && (
            <ul className="plan-overlay__comments" aria-label="Plan comments">
              {comments.map((comment) => (
                <li key={comment.id}>
                  Line {comment.line}: {comment.text}
                  <button
                    type="button"
                    aria-label={`Remove comment from line ${comment.line}`}
                    onClick={() => removeComment(activeSessionId, comment.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
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
