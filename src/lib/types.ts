export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
  | "plan";

export type Theme = "dark" | "light";

export type SessionStatus =
  | "idle"
  | "running"
  | "awaiting_permission"
  | "plan_review";

/** @deprecated Use SessionId */
export type TabId = string;

export type SessionId = string;
export type ProjectId = string;

export type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "error"
  | "thought"
  | "tool";

export type ToolCallDisplayStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

/** File change payload for the shared diff viewer (ACP edits or git patches). */
export type FileDiffSource = {
  file: string;
  before?: string;
  after?: string;
  patch?: string;
};

export type UserMessageAttachment = {
  id: string;
  mimeType: string;
  previewUrl: string;
};

export type ChatMessage =
  | {
      id: string;
      role: "user";
      content: string;
      attachments?: UserMessageAttachment[];
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      streaming?: boolean;
    }
  | {
      id: string;
      role: "system";
      content: string;
    }
  | {
      id: string;
      role: "error";
      content: string;
    }
  | {
      id: string;
      role: "thought";
      content: string;
      streaming?: boolean;
      /** Wall-clock start for live streaming thoughts. */
      startedAt?: number;
      /** Frozen duration once thinking completes (seconds). */
      durationSeconds?: number;
      /** Set when the assistant turn finishes; keeps the block collapsed. */
      turnCollapsed?: boolean;
    }
  | {
      id: string;
      role: "tool";
      toolCallId: string;
      title: string;
      kind?: string;
      path?: string;
      status: ToolCallDisplayStatus;
      /** Old/new file text or patch for the expandable diff viewer. */
      fileDiff?: FileDiffSource;
      /** Set when the assistant turn finishes; keeps the card collapsed. */
      turnCollapsed?: boolean;
    };

export type AcpConnectionState =
  | "disconnected"
  | "connecting"
  | "ready"
  | "error";

export type AgentNodeStatus = "idle" | "running" | "done" | "failed";

export interface AgentNode {
  id: string;
  sessionId: SessionId;
  parentId: string | null;
  title: string;
  status: AgentNodeStatus;
  kind?: string;
  path?: string;
  startedAt?: number;
  /** Real subagent fields (populated from subagent_* protocol events). */
  subagentId?: string;
  childSessionId?: string;
  subagentType?: string;
  contextUsagePct?: number;
  output?: string;
}

export interface Project {
  id: ProjectId;
  cwd: string;
  name: string;
}

export interface Session {
  id: SessionId;
  projectId: ProjectId;
  title: string;
  /** Set once a Grok-generated title has been applied; skips further title fetches. */
  grokTitleSynced?: boolean;
  grokSessionId?: string;
  /**
   * Exact cwd string recorded for this grokSessionId (from grok sessions list or snapshot).
   * Must be passed verbatim to resumeSession/loadSession so the agent can locate the
   * persisted session directory under ~/.grok/sessions/<encoded-cwd>/...
   * Falls back to the project's cwd when absent.
   */
  sessionCwd?: string;
  /** When set, the next ACP connect uses load/resume for `grokSessionId`. */
  resumeOnConnect?: boolean;
  /** Opened from history or a saved tab; attempt to load prior transcript from disk. */
  expectsTranscript?: boolean;
  transcriptRestore?: "idle" | "loading" | "done" | "failed";
  status: SessionStatus;
  messages: ChatMessage[];
  acpState: AcpConnectionState;
  acpError?: string;
  agentNodes: AgentNode[];
  /** Last message or creation time for sidebar ordering and timestamps (not updated on select). */
  lastActiveAt?: number;
}

/** Entry from `~/.grok/active_sessions.json` (Grok TUI or other CLI clients). */
export interface ActiveGrokSession {
  sessionId: string;
  pid: number;
  cwd: string;
  openedAt: string;
}

export interface GrokSessionEntry {
  id: string;
  summary: string;
  created?: string;
  updated?: string;
  status?: string;
  cwd?: string;
}

export interface SessionSnapshot {
  id: string;
  projectId: string;
  title: string;
  grokTitleSynced?: boolean;
  cwd: string;
  grokSessionId?: string;
  /** Unix ms; persisted for sidebar ordering and relative timestamps. */
  lastActiveAt?: number;
}

export interface AppSettings {
  permissionMode: PermissionMode;
  defaultModel: string;
  sandboxProfile: string;
  grokCliPath: string;
  lastProjectPaths: string[];
  /** Persisted as `openTabs` in settings.json (Rust field `open_tabs`). */
  openTabs: SessionSnapshot[];
  pinnedProjectPaths: string[];
  /** Project folders with thread lists expanded in the sidebar. */
  expandedProjectCwds: string[];
  /** Project folders showing the full scrollable thread list (not just five). */
  showAllThreadsProjectCwds: string[];
  /** Chats section shows the full scrollable list (not just five). */
  chatsSectionShowAll: boolean;
  theme: Theme;
  alwaysApprove: boolean;
}

/** @deprecated Use Session */
export type Tab = Session & { cwd: string };

export const PERMISSION_MODE_OPTIONS: {
  value: PermissionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "default",
    label: "Default",
    description: "Standard prompts when tools need approval",
  },
  {
    value: "acceptEdits",
    label: "Accept edits",
    description: "Auto-approve file edits",
  },
  { value: "auto", label: "Auto", description: "Approve most tool calls" },
  {
    value: "dontAsk",
    label: "Don't ask",
    description: "Minimize permission prompts",
  },
  {
    value: "bypassPermissions",
    label: "Bypass permissions",
    description: "No prompts — use with caution",
  },
  {
    value: "plan",
    label: "Plan",
    description: "Plan-first workflows",
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  permissionMode: "default",
  defaultModel: "",
  sandboxProfile: "off",
  grokCliPath: "",
  lastProjectPaths: [],
  openTabs: [],
  pinnedProjectPaths: [],
  expandedProjectCwds: [],
  showAllThreadsProjectCwds: [],
  chatsSectionShowAll: false,
  theme: "dark",
  alwaysApprove: false,
};
