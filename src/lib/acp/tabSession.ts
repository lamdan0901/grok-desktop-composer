import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  type ContentBlock,
  type SessionConfigOption,
} from "@agentclientprotocol/sdk";
import type { SessionModelState } from "@/lib/sessionModel";
import { startTab, stopTab } from "@/lib/grok";
import {
  beginHistoryReplay,
  cancelHistoryReplay,
  scheduleEndHistoryReplay,
} from "@/lib/historyReplay";
import {
  clearSessionConnectionKeys,
  markSessionConnectionTracked,
  sessionConnectionKey,
} from "@/lib/sessionConnectionRegistry";
import {
  refreshTitleAfterTurn,
  startTitleRefreshWhileTurn,
  stopTitleRefreshWhileTurn,
} from "@/lib/syncGrokSessionTitle";
import { refreshUsageAfterTurn } from "@/lib/syncGrokSessionUsage";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { resolveGrokSessionCwd } from "@/lib/sessions";
import { clearSlashCommandsInflight } from "@/lib/loadSlashCommands";
import { useSlashCommandsStore } from "@/stores/slashCommandsStore";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useQuestionStore } from "@/stores/questionStore";
import { usePlanReviewStore } from "@/stores/planReviewStore";
import { useTaskStore } from "@/stores/taskStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useHookStore } from "@/stores/hookStore";
import { useSkillStore } from "@/stores/skillStore";
import { useFolderTrustStore } from "@/stores/folderTrustStore";
import { useRewindStore } from "@/stores/rewindStore";
import { useQueueStore } from "@/stores/queueStore";
import { clearSessionNotificationDedupe } from "@/lib/sessionUpdateDedupe";
import { isBenignAttachError } from "@/lib/acpErrors";
import {
  beginSilentSessionAttach,
  endSilentSessionAttach,
} from "@/lib/agentOutputGuard";
import { clearComposerFileToolDedupe } from "./applyComposerFileTool";
import { createClientHandler } from "./createClientHandler";
import { clearFeatureCache } from "./featureDetection";
import { clearTabLineHandlers } from "./lineRouter";
import { createTauriAcpStream } from "./tauriStream";

type SessionState = "idle" | "connecting" | "ready" | "error";

const IMAGE_READ_FAILURE_INSTRUCTION =
  "If reading an image file fails, treat that as normal and inspect the image already included in the prompt.";

export class TabAcpSession {
  private connection: ClientSideConnection | null = null;
  private sessionId: string | null = null;
  private boundCwd: string | null = null;
  private state: SessionState = "idle";
  private initPromise: Promise<void> | null = null;
  private promptInFlight = false;
  private loadSessionSupported = false;
  /** True when the live agent process has this Grok session loaded (not UI-only attach). */
  private agentAttached = false;

  constructor(readonly tabId: string) {}

  get isReady(): boolean {
    return this.state === "ready" && this.sessionId !== null;
  }

  get isAgentAttached(): boolean {
    return this.agentAttached;
  }

  get isRunning(): boolean {
    return this.promptInFlight;
  }

  get grokSessionId(): string | undefined {
    return this.sessionId ?? undefined;
  }

  async ensureConnected(cwd: string): Promise<void> {
    return this.ensureSession(cwd);
  }

  async ensureLoaded(cwd: string, grokSessionId: string): Promise<void> {
    if (
      this.state === "ready" &&
      this.sessionId === grokSessionId &&
      this.boundCwd === cwd
    ) {
      return;
    }
    if (this.initPromise && this.boundCwd === cwd) {
      return this.initPromise;
    }

    if (this.boundCwd && this.boundCwd !== cwd) {
      await this.dispose();
    }

    this.initPromise = this.connectLoaded(cwd, grokSessionId).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  /** Re-attach to an existing Grok session without replaying transcript into the UI. */
  async ensureResumed(cwd: string, grokSessionId: string): Promise<void> {
    if (
      this.state === "ready" &&
      this.sessionId === grokSessionId &&
      this.boundCwd === cwd
    ) {
      return;
    }
    if (this.initPromise && this.boundCwd === cwd) {
      return this.initPromise;
    }

    if (this.boundCwd && this.boundCwd !== cwd) {
      await this.dispose();
    }

    this.initPromise = this.connectResumed(cwd, grokSessionId).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async ensureSession(cwd: string): Promise<void> {
    if (this.state === "ready" && this.sessionId && this.boundCwd === cwd) {
      return;
    }
    if (this.initPromise && this.boundCwd === cwd) {
      return this.initPromise;
    }

    if (this.boundCwd && this.boundCwd !== cwd) {
      await this.dispose();
    }

    this.initPromise = this.connect(cwd).finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async connect(cwd: string): Promise<void> {
    this.state = "connecting";
    await this.teardownAgentProcess();
    useMcpStore.getState().clearInitialization(this.tabId);
    await startTab(this.tabId, cwd);

    const stream = createTauriAcpStream(this.tabId);
    const client = createClientHandler(this.tabId);
    this.connection = new ClientSideConnection(() => client, stream);

    try {
      const init = await this.connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          _meta: { "x.ai/folderTrust.interactive": true },
        },
      });
      this.loadSessionSupported =
        init.agentCapabilities?.loadSession === true;

      const session = await this.connection.newSession({
        cwd,
        mcpServers: [],
      });

      this.sessionId = session.sessionId;
      this.boundCwd = cwd;
      boundCwdByTab.set(this.tabId, cwd);
      this.state = "ready";
      this.agentAttached = true;
      this.applyConfigOptions(session.configOptions);
      this.applySessionModels(session);
    } catch (err) {
      this.state = "error";
      this.boundCwd = null;
      this.agentAttached = false;
      boundCwdByTab.delete(this.tabId);
      throw err;
    }
  }

  /**
   * Bind an existing Grok session to the agent process. Returns true when the
   * agent accepted resume/load; false when neither method could attach.
   */
  private async tryAttachExistingSession(
    cwd: string,
    grokSessionId: string,
    replayHistory: boolean,
  ): Promise<boolean> {
    if (!this.connection) return false;

    if (this.connection.resumeSession) {
      try {
        const resumed = await this.connection.resumeSession({
          sessionId: grokSessionId,
          cwd,
        });
        this.applyConfigOptions(resumed.configOptions);
        this.applySessionModels(resumed);
        return true;
      } catch (err) {
        if (!isBenignAttachError(err)) throw err;
      }
    }

    if (!this.loadSessionSupported) return false;

    const finishReplay = () => {
      const store = useWorkspaceStore.getState();
      store.finalizeAssistantStream(this.tabId);
      store.finalizeThoughts(this.tabId);
      store.setSessionStatus(this.tabId, "idle");
    };

    if (replayHistory) {
      beginHistoryReplay(this.tabId);
    } else {
      beginSilentSessionAttach(this.tabId);
    }
    try {
      const loaded = await this.connection.loadSession({
        sessionId: grokSessionId,
        cwd,
        mcpServers: [],
      });
      this.applyConfigOptions(loaded.configOptions);
      this.applySessionModels(loaded);
      return true;
    } catch (err) {
      if (isBenignAttachError(err)) return false;
      throw err;
    } finally {
      if (replayHistory) {
        scheduleEndHistoryReplay(this.tabId, finishReplay);
      } else {
        endSilentSessionAttach(this.tabId);
      }
    }
  }

  /** Load session into agent when UI is ready but resume failed (offline attach). */
  private async ensureAgentAttached(): Promise<void> {
    if (this.agentAttached || !this.connection || !this.sessionId || !this.boundCwd) {
      return;
    }
    const hasTranscript =
      (useWorkspaceStore
        .getState()
        .sessions.find((s) => s.id === this.tabId)?.messages.length ?? 0) > 0;
    const attached = await this.tryAttachExistingSession(
      this.boundCwd,
      this.sessionId,
      !hasTranscript,
    );
    if (!attached) {
      throw new Error(
        "Could not attach to this Grok thread. Try Reconnect in Settings.",
      );
    }
    this.agentAttached = true;
  }

  private async connectLoaded(
    cwd: string,
    grokSessionId: string,
  ): Promise<void> {
    this.state = "connecting";
    await this.teardownAgentProcess();
    await startTab(this.tabId, cwd);

    const stream = createTauriAcpStream(this.tabId);
    const client = createClientHandler(this.tabId);
    this.connection = new ClientSideConnection(() => client, stream);

    try {
      const init = await this.connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          _meta: { "x.ai/folderTrust.interactive": true },
        },
      });
      this.loadSessionSupported =
        init.agentCapabilities?.loadSession === true;

      this.agentAttached = await this.tryAttachExistingSession(
        cwd,
        grokSessionId,
        this.loadSessionSupported,
      );
      if (!this.agentAttached) {
        throw new Error(
          "Grok agent does not support loading or resuming sessions",
        );
      }

      this.sessionId = grokSessionId;
      this.boundCwd = cwd;
      boundCwdByTab.set(this.tabId, cwd);
      this.state = "ready";
    } catch (err) {
      cancelHistoryReplay(this.tabId);
      if (isBenignAttachError(err)) {
        this.sessionId = grokSessionId;
        this.boundCwd = cwd;
        boundCwdByTab.set(this.tabId, cwd);
        this.state = "ready";
        this.agentAttached = false;
        return;
      }
      this.state = "error";
      this.boundCwd = null;
      this.agentAttached = false;
      boundCwdByTab.delete(this.tabId);
      throw err;
    }
  }

  private async connectResumed(
    cwd: string,
    grokSessionId: string,
  ): Promise<void> {
    this.state = "connecting";
    await this.teardownAgentProcess();
    await startTab(this.tabId, cwd);

    const stream = createTauriAcpStream(this.tabId);
    const client = createClientHandler(this.tabId);
    this.connection = new ClientSideConnection(() => client, stream);

    try {
      const init = await this.connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          _meta: { "x.ai/folderTrust.interactive": true },
        },
      });
      this.loadSessionSupported =
        init.agentCapabilities?.loadSession === true;

      this.agentAttached = await this.tryAttachExistingSession(
        cwd,
        grokSessionId,
        false,
      );

      this.sessionId = grokSessionId;
      this.boundCwd = cwd;
      boundCwdByTab.set(this.tabId, cwd);
      this.state = "ready";
    } catch (err) {
      if (isBenignAttachError(err)) {
        this.sessionId = grokSessionId;
        this.boundCwd = cwd;
        boundCwdByTab.set(this.tabId, cwd);
        this.state = "ready";
        this.agentAttached = false;
        return;
      }
      this.state = "error";
      this.boundCwd = null;
      this.agentAttached = false;
      boundCwdByTab.delete(this.tabId);
      throw err;
    }
  }

  /** Send an agent-directed `x.ai/*` (or other) extension request, verbatim on the wire. */
  async extMethod(method: string, params: unknown): Promise<unknown> {
    if (!this.connection || !this.sessionId) {
      throw new Error("ACP session not ready");
    }
    return this.connection.extMethod(method, params as Record<string, unknown>);
  }

  /** Send an agent-directed extension notification, verbatim on the wire. */
  async extNotification(method: string, params: unknown): Promise<void> {
    if (!this.connection || !this.sessionId) {
      throw new Error("ACP session not ready");
    }
    await this.connection.extNotification(method, params as Record<string, unknown>);
  }

  /**
   * Switch model via `session/set_model`; effort rides `_meta.reasoningEffort`.
   * SDK 0.24 has no typed `setSessionModel`, so this rides `extMethod`, which
   * sends the method name verbatim over JSON-RPC (grok's expected wire method).
   */
  async setModel(modelId: string, effort?: string): Promise<void> {
    if (!this.connection || !this.sessionId) {
      throw new Error("ACP session not ready");
    }
    await this.connection.extMethod("session/set_model", {
      sessionId: this.sessionId,
      modelId,
      ...(effort ? { _meta: { reasoningEffort: effort } } : {}),
    });
    // The effort selector follows the selected model immediately.
    useSessionConfigStore.getState().setCurrentModel(this.tabId, modelId);
  }

  private applyConfigOptions(
    options: SessionConfigOption[] | null | undefined,
  ): void {
    if (!options?.length) return;
    useSessionConfigStore.getState().setConfigOptions(this.tabId, options);
  }

  /**
   * Capture the `models` map grok attaches to new/load/resume responses. SDK 0.24
   * does not type it, so we read it off the untyped response.
   */
  private applySessionModels(response: unknown): void {
    const models = (response as { models?: SessionModelState } | null)?.models;
    if (models && Array.isArray(models.availableModels)) {
      useSessionConfigStore.getState().setSessionModels(this.tabId, models);
    }
  }

  async sendPrompt(
    text: string,
    promptBlocks?: ContentBlock[],
  ): Promise<void> {
    if (!this.connection || !this.sessionId) {
      throw new Error("ACP session not ready");
    }
    const userPrompt =
      promptBlocks?.length
        ? promptBlocks
        : text.trim()
          ? [{ type: "text" as const, text: text.trim() }]
          : [];
    if (!userPrompt.length) return;
    const prompt: ContentBlock[] = [
      { type: "text", text: IMAGE_READ_FAILURE_INSTRUCTION },
      ...userPrompt,
    ];

    this.promptInFlight = true;
    startTitleRefreshWhileTurn(this.tabId);
    try {
      await this.ensureAgentAttached();
      try {
        await this.connection.prompt({
          sessionId: this.sessionId,
          prompt,
        });
      } catch (err) {
        if (!isBenignAttachError(err) || !this.boundCwd) throw err;
        this.agentAttached = false;
        await this.ensureAgentAttached();
        await this.connection.prompt({
          sessionId: this.sessionId,
          prompt,
        });
      }
    } finally {
      this.promptInFlight = false;
      stopTitleRefreshWhileTurn(this.tabId);
      refreshTitleAfterTurn(this.tabId);
      refreshUsageAfterTurn(this.tabId);
      const { listRewindPoints } = await import("./xaiRewind");
      await listRewindPoints(this.tabId).catch(() => undefined);
    }
  }

  async cancelPrompt(): Promise<void> {
    if (!this.connection || !this.sessionId) return;
    await this.connection.cancel({ sessionId: this.sessionId });
    this.promptInFlight = false;
    refreshTitleAfterTurn(this.tabId);
    refreshUsageAfterTurn(this.tabId);
  }

  async dispose(): Promise<void> {
    clearTabLineHandlers(this.tabId);
    clearSessionNotificationDedupe(this.tabId);
    // Settle any pending reverse requests so they do not leak or leave a stale
    // overlay for a reconnecting session.
    useQuestionStore.getState().cancelSession(this.tabId);
    usePlanReviewStore.getState().cancelSession(this.tabId);
    await this.teardownAgentProcess();
    this.state = "idle";
    this.sessionId = null;
    this.boundCwd = null;
    this.agentAttached = false;
    boundCwdByTab.delete(this.tabId);
    this.initPromise = null;
    useSessionConfigStore.getState().clearSession(this.tabId);
    clearSlashCommandsInflight(this.tabId);
    useSlashCommandsStore.getState().clearSession(this.tabId);
    clearFeatureCache(this.tabId);
    useTaskStore.getState().clearTab(this.tabId);
    useMcpStore.getState().clearTab(this.tabId);
    useSkillStore.getState().clearTab(this.tabId);
    useHookStore.getState().clearTab(this.tabId);
    useFolderTrustStore.getState().cancelSession(this.tabId);
    useRewindStore.getState().clearSession(this.tabId);
    useQueueStore.getState().clearSession(this.tabId);
    cancelHistoryReplay(this.tabId);
  }

  /** Stop the child process first so the ACP stream can close. */
  private async teardownAgentProcess(): Promise<void> {
    const conn = this.connection;
    this.connection = null;

    try {
      await stopTab(this.tabId);
    } catch {
      // Process may already be stopped
    }

    if (conn) {
      await Promise.race([
        conn.closed.catch(() => undefined),
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 3000);
        }),
      ]);
    }
  }
}

const sessions = new Map<string, TabAcpSession>();
const boundCwdByTab = new Map<string, string>();

/** Project cwd last passed to `start_tab` for this thread (used for disk writes). */
export function getTabBoundCwd(tabId: string): string | undefined {
  return boundCwdByTab.get(tabId);
}

export function getTabSession(tabId: string): TabAcpSession {
  let session = sessions.get(tabId);
  if (!session) {
    session = new TabAcpSession(tabId);
    sessions.set(tabId, session);
  }
  return session;
}

export async function removeTabSession(tabId: string): Promise<void> {
  const session = sessions.get(tabId);
  if (session) {
    sessions.delete(tabId);
    clearComposerFileToolDedupe(tabId);
    await session.dispose();
  }
}

/** Restart Rust process and re-run ACP initialize + session/new. */
export async function reconnectTabSession(
  tabId: string,
  cwd: string,
): Promise<void> {
  await restartSessionAgent(tabId, cwd);
}

/**
 * Stop the agent process and reconnect, preserving an existing Grok session when possible.
 */
export async function restartSessionAgent(
  tabId: string,
  cwd: string,
  grokSessionId?: string,
): Promise<void> {
  clearSessionConnectionKeys(tabId);
  await removeTabSession(tabId);
  const session = getTabSession(tabId);

  let attachCwd = cwd;
  if (grokSessionId) {
    // Heal legacy sessionCwd like ensureAcpForSend does, so restart/model-change also uses exact grok cwd.
    try {
      const ws = useWorkspaceStore.getState().sessions.find((s) => s.id === tabId);
      if (ws && !ws.sessionCwd) {
        const resolved = await resolveGrokSessionCwd(grokSessionId);
        if (resolved && resolved.trim()) {
          attachCwd = resolved;
          useWorkspaceStore.getState().setSessionCwd(tabId, resolved);
        }
      } else if (ws?.sessionCwd) {
        attachCwd = ws.sessionCwd;
      }
    } catch (err) {
      // non-fatal
    }
    await session.ensureResumed(attachCwd, grokSessionId);
  } else {
    await session.ensureConnected(attachCwd);
  }
  markSessionConnectionTracked(
    sessionConnectionKey(tabId, attachCwd, grokSessionId),
  );
}
