import { useCallback, useRef, useState } from "react";
import { Download } from "lucide-react";
import { HomeView } from "./HomeView";
import { exportSessionTranscript } from "@/lib/exportSession";
import { restoreSessionTranscriptIfNeeded } from "@/lib/restoreSession";
import {
  isTranscriptLoading,
  shouldShowHomeComposer,
  showTranscriptRestoreFailed,
} from "@/lib/sessionEmpty";
import { ErrorBlock } from "./ErrorBlock";
import { MessageList } from "./MessageList";
import { TodoPanel } from "./TodoPanel";
import { TasksPane } from "./TasksPane";
import { selectSessionTodos, useTodoStore } from "@/stores/todoStore";
import { displayThreadTitle } from "@/lib/threadTitle";
import { useExternallyActiveSession } from "@/hooks/useExternallyActiveSession";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

export function ChatColumn() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const externallyActive = useExternallyActiveSession(session?.grokSessionId);
  const todos = useTodoStore((s) =>
    selectSessionTodos(s.bySession, activeSessionId),
  );

  const handleExport = useCallback(async () => {
    if (!session?.grokSessionId || exporting) return;
    setExporting(true);
    try {
      await exportSessionTranscript(session.grokSessionId, session.title);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Export failed";
      window.alert(message);
    } finally {
      setExporting(false);
    }
  }, [session?.grokSessionId, session?.title, exporting]);

  const handleRetryRestore = useCallback(() => {
    if (!activeSessionId) return;
    void restoreSessionTranscriptIfNeeded(activeSessionId);
  }, [activeSessionId]);

  if (shouldShowHomeComposer(activeSessionId, session)) {
    return (
      <main className="chat-column chat-column--home">
        <HomeView />
      </main>
    );
  }

  const hasMessages = (session?.messages.length ?? 0) > 0;
  const threadTitle = session ? displayThreadTitle(session) : "";

  return (
    <main className="chat-column">
      {session && (
        <header className="chat-column__toolbar">
          <div className="chat-column__toolbar-main">
            <h1 className="chat-column__thread-title" title={threadTitle}>
              {threadTitle}
            </h1>
            {cwd && (
              <p className="chat-column__cwd" title={cwd}>
                {cwd}
              </p>
            )}
          </div>
          {session.grokSessionId && hasMessages && (
            <button
              type="button"
              className="chat-column__export"
              disabled={exporting}
              onClick={() => void handleExport()}
              title="Export transcript as Markdown"
              aria-label={
                exporting ? "Exporting transcript" : "Export transcript"
              }
            >
              <Download size={14} aria-hidden />
            </button>
          )}
        </header>
      )}
      {externallyActive && (
        <div className="session-external-banner" role="status">
          This thread is active in the Grok terminal. Finish or close it there
          before sending from this app to avoid conflicting agents.
        </div>
      )}
      {todos.length > 0 && (
        <div className="chat-column__todo">
          <TodoPanel todos={todos} />
        </div>
      )}
      <div className="chat-column__tasks">
        <TasksPane />
      </div>
      <div className="chat-column__scroll" ref={scrollRef}>
        {hasMessages ? (
          <MessageList
            messages={session!.messages}
            sessionId={activeSessionId!}
            sessionStatus={session!.status}
            scrollContainerRef={scrollRef}
          />
        ) : session?.acpState === "error" ? (
          <div className="chat-column__status">
            <ErrorBlock
              content={session.acpError ?? "Failed to load conversation."}
            />
          </div>
        ) : session && isTranscriptLoading(session, activeSessionId) ? (
          <div className="chat-column__status">Loading conversation…</div>
        ) : session && showTranscriptRestoreFailed(session) ? (
          <div className="chat-column__status">
            <p>Transcript could not be loaded from disk.</p>
            <button
              type="button"
              className="chat-column__retry"
              onClick={handleRetryRestore}
            >
              Retry
            </button>
            <p className="chat-column__status-hint">
              You can still send a message to continue this thread.
            </p>
          </div>
        ) : (
          <div className="chat-column__status">
            Send a message to start the conversation.
          </div>
        )}
      </div>
    </main>
  );
}