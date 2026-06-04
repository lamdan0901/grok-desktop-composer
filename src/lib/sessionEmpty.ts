import type { Session } from "./types";

/** Thread with no conversation yet (home / new-thread state). */
export function isEmptyNewThread(session: Session): boolean {
  return session.messages.length === 0;
}

export function isNewThreadTitle(title: string): boolean {
  return title.trim().toLowerCase() === "new thread";
}

export function sessionExpectsTranscript(session: Session): boolean {
  return Boolean(session.expectsTranscript);
}

/** True when a failed disk restore should surface an error (not for fresh "New thread" tabs). */
export function sessionShowsTranscriptRestoreError(session: Session): boolean {
  return Boolean(
    session.expectsTranscript && !isNewThreadTitle(session.title),
  );
}

export function isUnstartedNewThread(session: Session): boolean {
  return (
    isEmptyNewThread(session) &&
    isNewThreadTitle(session.title) &&
    !sessionExpectsTranscript(session) &&
    session.transcriptRestore !== "failed"
  );
}

/** Threads that only exist as prep state — not listed in the sidebar. */
export function shouldShowInSidebar(session: Session): boolean {
  return !isUnstartedNewThread(session);
}

export function findEmptySessionForProject(
  sessions: Session[],
  projectId: string,
): Session | undefined {
  return sessions.find(
    (s) => s.projectId === projectId && isUnstartedNewThread(s),
  );
}

/** True when the main pane should show the Codex-style home composer. */
export function shouldShowHomeComposer(
  activeSessionId: string | null,
  session: Session | undefined,
): boolean {
  if (!activeSessionId) return true;
  if (!session) return true;
  if (sessionExpectsTranscript(session)) return false;
  return isEmptyNewThread(session);
}

export function isTranscriptLoading(
  session: Session,
  activeSessionId: string | null = null,
): boolean {
  if (activeSessionId != null && session.id !== activeSessionId) return false;
  return session.transcriptRestore === "loading";
}

export function showTranscriptRestoreFailed(session: Session): boolean {
  return (
    sessionShowsTranscriptRestoreError(session) &&
    session.transcriptRestore === "failed" &&
    session.messages.length === 0
  );
}