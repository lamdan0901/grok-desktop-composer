import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronDown,
  Folder,
  GitBranch,
  Laptop,
  Mic,
  Paperclip,
} from "lucide-react";
import { getTabSession } from "@/lib/acp";
import { ensureAcpForSend } from "@/lib/ensureAcpForSend";
import { MAX_SESSIONS } from "@/lib/constants";
import { notifyMaxSessions, pickProjectFolder } from "@/lib/projectFolder";
import { formatModelName } from "@/lib/formatModelName";
import { useCancelThreadOnEscape } from "@/hooks/useCancelThreadOnEscape";
import { useComposerAccessModeCycle } from "@/hooks/useComposerAccessModeCycle";
import { useComposerModelCycle } from "@/hooks/useComposerModelCycle";
import { useFileMentions } from "@/hooks/useFileMentions";

import { AccessModePill } from "./AccessModePill";
import { ModelSelectorDropdown } from "./ModelSelectorDropdown";
import {
  ComposerAttachmentStrip,
  ComposerFileInput,
} from "./ComposerAttachmentStrip";
import { ComposerTextarea } from "./ComposerTextarea";
import { SlashCommandPicker } from "./SlashCommandPicker";
import { FileMentionPicker } from "./FileMentionPicker";
import { useComposerAttachments } from "@/hooks/useComposerAttachments";
import { useSlashCommands } from "@/hooks/useSlashCommands";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import {
  executeSlashCommand,
  refreshUsageForSlash,
} from "@/lib/executeSlashCommand";
import {
  canSendComposer,
  toPromptContentBlocks,
  toUserMessageAttachments,
} from "@/lib/composerAttachments";
import {
  ProjectPickerDropdown,
  useRecordProjectOnAdd,
} from "./ProjectPickerDropdown";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  isAtSessionAgentLimit,
  useWorkspaceStore,
} from "@/stores/workspaceStore";
import {
  findEmptySessionForProject,
  isEmptyNewThread,
} from "@/lib/sessionEmpty";
export function HomeView() {
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const [sending, setSending] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

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
  const projectAnchorRef = useRef<HTMLButtonElement>(null);
  const slashAnchorRef = useRef<HTMLDivElement>(null);
  const canSend = canSendComposer(text, attachments.length);

  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const effectiveProjectId =
    activeSession?.projectId ?? activeProjectId;
  const isGenerating =
    sending || activeSession?.status === "running";

  useCancelThreadOnEscape(isGenerating, activeSession?.id, () =>
    setSending(false),
  );
  const addProject = useWorkspaceStore((s) => s.addProject);
  const addSession = useWorkspaceStore((s) => s.addSession);
  const setActiveSession = useWorkspaceStore((s) => s.setActiveSession);
  const setActiveProject = useWorkspaceStore((s) => s.setActiveProject);
  const addUserMessage = useWorkspaceStore((s) => s.addUserMessage);
  const finalizeAssistantStream = useWorkspaceStore(
    (s) => s.finalizeAssistantStream,
  );
  const appendError = useWorkspaceStore((s) => s.appendError);
  const recordProject = useRecordProjectOnAdd();

  const defaultModel = useSettingsStore((s) => s.settings.defaultModel);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const cliModels = useSessionConfigStore((s) => s.cliModels);
  const cliDefaultModel = useSessionConfigStore((s) => s.cliDefaultModel);
  const getModelSelector = useSessionConfigStore((s) => s.getModelSelector);

  const activeProject = projects.find((p) => p.id === effectiveProjectId);
  const projectName = activeProject?.name;

  const headline = projectName
    ? `What should we build in ${projectName}?`
    : "What should we build?";

  const slashSession = useMemo(() => {
    if (!effectiveProjectId) return undefined;
    let s = sessions.find((sess) => sess.id === activeSessionId);
    if (!s || s.projectId !== effectiveProjectId) {
      s = findEmptySessionForProject(sessions, effectiveProjectId);
    }
    return s?.projectId === effectiveProjectId ? s : undefined;
  }, [sessions, activeSessionId, effectiveProjectId]);

  useEffect(() => {
    if (!effectiveProjectId) return;
    const prep = findEmptySessionForProject(
      useWorkspaceStore.getState().sessions,
      effectiveProjectId,
    );
    if (prep) {
      if (useWorkspaceStore.getState().activeSessionId !== prep.id) {
        setActiveSession(prep.id);
      }
      return;
    }
    addSession(effectiveProjectId);
  }, [effectiveProjectId, addSession, setActiveSession, sessions.length]);

  const slash = useSlashCommands({
    sessionId: slashSession?.id,
    cwd: activeProject?.cwd,
    grokSessionId: slashSession?.grokSessionId,
    text,
    setText,
    disabled: !slashSession?.id || !activeProject?.cwd || sending,
    pickerAnchorRef: slashAnchorRef,
  });
  const fileMentions = useFileMentions({
    cwd: activeProject?.cwd,
    text,
    cursor,
    setText,
    setCursor,
    disabled: !activeProject?.cwd || sending,
    pickerAnchorRef: slashAnchorRef,
  });

  const { handleKeyDown: handleHistoryKeyDown, commitPrompt } = usePromptHistory({
    text,
    setText,
  });

  const openProject = useWorkspaceStore((s) => s.openProject);

  const modelChoices = useMemo(() => {
    const fromSelector = getModelSelector(null)?.choices;
    if (fromSelector?.length) return fromSelector;
    return cliModels.map((m) => ({
      value: m,
      label: formatModelName(m),
    }));
  }, [getModelSelector, cliModels]);

  const currentModelValue =
    defaultModel || cliDefaultModel || modelChoices[0]?.value || "";

  const handleAddProject = useCallback(
    (cwd: string) => {
      const result = addProject(cwd);
      if (result) {
        setActiveProject(result.project.id);
        recordProject(cwd);
        return;
      }
      const opened = openProject(cwd);
      if (opened) {
        setActiveProject(opened.id);
        recordProject(cwd);
      }
    },
    [addProject, openProject, recordProject, setActiveProject],
  );

  const handleSend = useCallback(async () => {
    if (!canSend || sending) return;

    const trimmed = text.trim();
    const slashResult = executeSlashCommand(trimmed);
    if (slashResult.handled) {
      if (!slashResult.forwardText) {
        setText("");
        clear();
        if (slashSession?.id) refreshUsageForSlash(slashSession.id);
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

    let projectId = effectiveProjectId;
    if (!projectId) {
      if (projects.length === 0) {
        const cwd = await pickProjectFolder();
        if (!cwd) return;
        const result = addProject(cwd);
        if (!result) return;
        projectId = result.project.id;
        recordProject(cwd);
      } else {
        projectId = projects[0]!.id;
        setActiveProject(projectId);
      }
    }

    const state = useWorkspaceStore.getState();
    let session =
      state.activeSessionId != null
        ? state.sessions.find((s) => s.id === state.activeSessionId)
        : undefined;

    if (
      session &&
      (session.projectId !== projectId || !isEmptyNewThread(session))
    ) {
      session = undefined;
    }

    if (!session) {
      if (isAtSessionAgentLimit(state.sessions)) {
        await notifyMaxSessions(MAX_SESSIONS);
        return;
      }
      session = addSession(projectId) ?? undefined;
    }

    if (!session) return;

    const cwd =
      useWorkspaceStore.getState().projects.find((p) => p.id === projectId)
        ?.cwd ?? "";
    if (!cwd) return;

    setSending(true);
    setText("");
    setCursor(0);
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
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    text,
    attachments,
    sending,
    clear,
    effectiveProjectId,
    projects,
    addProject,
    addSession,
    recordProject,
    setActiveProject,
    addUserMessage,
    finalizeAssistantStream,
    appendError,
    commitPrompt,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slash.handleKeyDown(e)) return;
    if (fileMentions.handleKeyDown(e)) return;
    handleAccessModeKeyDown(e);
    handleModelKeyDown(e);
    if (handleHistoryKeyDown(e)) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="home-view">
      <h1 className="home-view__title">{headline}</h1>

      <div className="home-composer">
        <ComposerAttachmentStrip
          className="composer-attachments composer-attachments--home"
          attachments={attachments}
          onRemove={remove}
        />
        <SlashCommandPicker
          open={slash.menuOpen}
          anchorRef={slashAnchorRef}
          items={slash.filtered}
          activeIndex={slash.activeIndex}
          connecting={slash.connecting}
          loadingCommands={slash.loadingCommands}
          onSelect={slash.applyEntry}
        />
        <FileMentionPicker
          open={fileMentions.menuOpen}
          anchorRef={slashAnchorRef}
          items={fileMentions.filtered}
          activeIndex={fileMentions.activeIndex}
          onSelect={fileMentions.applyEntry}
        />
        <ComposerTextarea
          anchorRef={slashAnchorRef}
          className="home-composer__input"
          wrapClassName="composer-textarea-wrap composer-textarea-wrap--home composer-textarea-wrap--slash"
          placeholder="Do anything"
          value={text}
          disabled={sending}
          focusKey={activeSessionId}
          cursor={cursor}
          onChange={setText}
          onCursorChange={setCursor}
          onKeyDown={handleKeyDown}
          onPaste={(e) => void handlePaste(e)}
        />

        <div className="home-composer__controls">
          <div className="home-composer__left">
            <button
              type="button"
              className="home-composer__icon-btn"
              aria-label="Attach images"
              title={atLimit ? "Maximum attachments reached" : "Attach images"}
              disabled={sending || atLimit}
              onClick={openFilePicker}
            >
              <Paperclip size={16} />
            </button>
            <AccessModePill variant="home" />
          </div>

          <div className="home-composer__right">
            {modelChoices.length > 0 && (
              <ModelSelectorDropdown
                variant="home"
                choices={modelChoices}
                currentValue={currentModelValue}
                disabled={sending}
                title="Ctrl+Tab to cycle models"
                onSelect={(value) => {
                  void updateSettings({ defaultModel: value });
                }}
              />
            )}
            <button
              type="button"
              className="home-composer__icon-btn"
              aria-label="Voice input"
              title="Coming soon"
              disabled
            >
              <Mic size={16} />
            </button>
            <button
              type="button"
              className="home-composer__send"
              aria-label="Send message"
              disabled={sending || !canSend}
              onClick={() => void handleSend()}
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
        <ComposerFileInput
          inputRef={fileInputRef}
          onChange={(e) => void handleFileInputChange(e)}
          disabled={sending || atLimit}
        />

        <div className="home-context">
          <button
            ref={projectAnchorRef}
            type="button"
            className="home-context__pill"
            onClick={() => setProjectMenuOpen((v) => !v)}
          >
            <Folder size={14} />
            <span>{projectName ?? "No project"}</span>
            <ChevronDown size={14} />
          </button>
          <button type="button" className="home-context__pill" disabled>
            <Laptop size={14} />
            <span>Work locally</span>
            <ChevronDown size={14} />
          </button>
          <button type="button" className="home-context__pill" disabled>
            <GitBranch size={14} />
            <span>main</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <ProjectPickerDropdown
        anchorRef={projectAnchorRef}
        open={projectMenuOpen}
        onClose={() => setProjectMenuOpen(false)}
        activeProjectId={effectiveProjectId}
        onSelectProject={setActiveProject}
        onAddProject={handleAddProject}
      />
    </div>
  );
}
