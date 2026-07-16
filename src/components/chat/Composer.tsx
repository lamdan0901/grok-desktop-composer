import { ArrowUp, Paperclip, Square } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useComposerAccessModeCycle } from "@/hooks/useComposerAccessModeCycle";
import { useComposerAttachments } from "@/hooks/useComposerAttachments";
import { useComposerModelCycle } from "@/hooks/useComposerModelCycle";
import { AccessModePill } from "./AccessModePill";
import {
  ComposerAttachmentStrip,
  ComposerFileInput,
} from "./ComposerAttachmentStrip";
import { ComposerTextarea } from "./ComposerTextarea";
import { ModelSelector } from "./ModelSelector";
import { SlashCommandPicker } from "./SlashCommandPicker";
import { UsageBar } from "./UsageBar";
import { useCancelThreadOnEscape } from "@/hooks/useCancelThreadOnEscape";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import {
  executeSlashCommand,
  refreshUsageForSlash,
} from "@/lib/executeSlashCommand";
import { getTabSession } from "@/lib/acp";
import { useExternallyActiveSession } from "@/hooks/useExternallyActiveSession";
import {
  canSendComposer,
  toPromptContentBlocks,
  toUserMessageAttachments,
} from "@/lib/composerAttachments";
import { ensureAcpForSend } from "@/lib/ensureAcpForSend";
import { shouldShowHomeComposer } from "@/lib/sessionEmpty";
import { CONTEXT_COMPACT_THRESHOLD_PCT } from "@/lib/usage";
import { interjectActiveTurn } from "@/lib/acp/xaiQueue";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

export function Composer() {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [interjectText, setInterjectText] = useState("");
  const [interjectSupported, setInterjectSupported] = useState(true);
  const slashAnchorRef = useRef<HTMLDivElement>(null);
  const { handleAccessModeKeyDown } = useComposerAccessModeCycle();
  const { handleModelKeyDown } = useComposerModelCycle();
  const {
    attachments,
    atLimit,
    fileInputRef,
    handlePaste,
    remove,
    clear,
    openFilePicker,
    handleFileInputChange,
  } = useComposerAttachments();
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const addUserMessage = useWorkspaceStore((s) => s.addUserMessage);
  const finalizeAssistantStream = useWorkspaceStore(
    (s) => s.finalizeAssistantStream,
  );
  const appendError = useWorkspaceStore((s) => s.appendError);
  const setAcpState = useWorkspaceStore((s) => s.setAcpState);
  const externallyActive = useExternallyActiveSession(session?.grokSessionId);

  const blocked =
    !session ||
    !cwd ||
    session.status === "plan_review" ||
    session.status === "awaiting_permission" ||
    externallyActive;

  const isGenerating = sending || session?.status === "running";
  const canSend = canSendComposer(text, attachments.length);

  useCancelThreadOnEscape(isGenerating, session?.id, () => setSending(false));

  const slash = useSlashCommands({
    sessionId: session?.id,
    cwd,
    grokSessionId: session?.grokSessionId,
    text,
    setText,
    disabled: !session?.id || !cwd || sending,
    pickerAnchorRef: slashAnchorRef,
  });

  const { handleKeyDown: handleHistoryKeyDown, commitPrompt } = usePromptHistory({
    text,
    setText,
  });

  const handleSend = useCallback(async (overrideText?: string) => {
    const nextText = overrideText ?? text;
    if (
      !canSendComposer(nextText, attachments.length) ||
      blocked ||
      sending ||
      !session ||
      !cwd
    ) {
      return;
    }

    const trimmed = nextText.trim();
    const slashResult = executeSlashCommand(trimmed);
    if (slashResult.handled) {
      if (!slashResult.forwardText) {
        setText("");
        clear();
        refreshUsageForSlash(session.id);
        return;
      }
    }

    const promptText =
      slashResult.handled && slashResult.forwardText
        ? slashResult.forwardText
        : trimmed;
    const promptBlocks = toPromptContentBlocks(promptText, attachments);
    const messageAttachments = toUserMessageAttachments(attachments);

    commitPrompt(promptText);

    setSending(true);
    setText("");
    clear();
    addUserMessage(session.id, promptText, messageAttachments);

    try {
      await ensureAcpForSend(session.id, cwd, session.grokSessionId);
      await getTabSession(session.id).sendPrompt(promptText, promptBlocks);
      finalizeAssistantStream(session.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send message";
      appendError(session.id, message);
      finalizeAssistantStream(session.id);
      setAcpState(session.id, "disconnected");
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    text,
    attachments,
    blocked,
    sending,
    session,
    cwd,
    addUserMessage,
    finalizeAssistantStream,
    appendError,
    setAcpState,
    clear,
    commitPrompt,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slash.handleKeyDown(e)) return;
    handleAccessModeKeyDown(e);
    handleModelKeyDown(e);
    if (handleHistoryKeyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleSubmit = () => {
    if (isGenerating) {
      handleStop();
    } else {
      void handleSend();
    }
  };

  const handleStop = () => {
    if (!session) return;
    void getTabSession(session.id).cancelPrompt();
    finalizeAssistantStream(session.id);
    setSending(false);
  };

  const handleInterject = async () => {
    const next = interjectText.trim();
    if (!session || !next) return;
    try {
      if (!(await interjectActiveTurn(session.id, next))) {
        setInterjectSupported(false);
        return;
      }
      setInterjectText("");
    } catch (error) {
      appendError(
        session.id,
        error instanceof Error ? error.message : "Failed to interject active turn",
      );
    }
  };

  if (shouldShowHomeComposer(activeSessionId, session)) return null;

  const placeholder = !session
    ? "Select or create a thread in the sidebar…"
    : !cwd
      ? "Add a project folder first…"
      : sending
        ? "Connecting to Grok…"
        : externallyActive
          ? "Active in Grok terminal — close it there to send here…"
          : blocked
            ? "Resolve permissions or review the plan to continue…"
            : "Message Grok…";

  return (
    <footer className="composer">
      <div className="composer__toolbar">
        <div className="composer__toolbar-left">
          <AccessModePill variant="session" />
          <ModelSelector />
          <button
            type="button"
            className="composer__compact-btn"
            aria-label="Compact conversation"
            title={`Compact conversation (auto-compacts at ${CONTEXT_COMPACT_THRESHOLD_PCT}%)`}
            disabled={blocked || sending}
            onClick={async () => {
              await handleSend("/compact");
            }}
          >
            Compact
          </button>
          {isGenerating && interjectSupported && (
            <>
              <input
                type="text"
                aria-label="Active turn interjection"
                value={interjectText}
                onChange={(event) => setInterjectText(event.target.value)}
              />
              <button
                type="button"
                aria-label="Interject active turn"
                disabled={!interjectText.trim()}
                onClick={handleInterject}
              >
                Interject
              </button>
            </>
          )}
        </div>
        <UsageBar />
      </div>
      <div className="composer__box">
        <ComposerAttachmentStrip
          attachments={attachments}
          onRemove={remove}
        />
        <div className="composer__input-row">
          <button
            type="button"
            className="composer__attach-btn"
            aria-label="Attach images"
            title={atLimit ? "Maximum attachments reached" : "Attach images"}
            disabled={blocked || sending || atLimit}
            onClick={openFilePicker}
          >
            <Paperclip size={16} />
          </button>
          <SlashCommandPicker
            open={slash.menuOpen}
            anchorRef={slashAnchorRef}
            items={slash.filtered}
            activeIndex={slash.activeIndex}
            connecting={slash.connecting}
            loadingCommands={slash.loadingCommands}
            onSelect={slash.applyEntry}
          />
          <ComposerTextarea
            anchorRef={slashAnchorRef}
            className="composer__input"
            wrapClassName="composer-textarea-wrap composer-textarea-wrap--session composer-textarea-wrap--slash"
            placeholder={placeholder}
            value={text}
            disabled={blocked || sending}
            focusKey={activeSessionId}
            onChange={setText}
            onKeyDown={handleKeyDown}
            onPaste={(e) => void handlePaste(e)}
          />
          <button
            type="button"
            className={`composer__submit${isGenerating ? " composer__submit--stop" : ""}`}
            aria-label={isGenerating ? "Stop generating" : "Send message"}
            disabled={isGenerating ? false : blocked || !canSend}
            onClick={handleSubmit}
          >
            {isGenerating ? <Square size={14} fill="currentColor" /> : <ArrowUp size={16} />}
          </button>
        </div>
        <ComposerFileInput
          inputRef={fileInputRef}
          onChange={(e) => void handleFileInputChange(e)}
          disabled={blocked || sending || atLimit}
        />
      </div>
    </footer>
  );
}
