import {
  BadgeCheck,
  ListChecks,
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  X,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { getTabSession, reconnectTabSession } from "@/lib/acp";
import {
  COMPOSER_ACCESS_MODE_PRESENTATION,
  composerAccessModeFromSettings,
  settingsPatchForComposerAccessMode,
  type ComposerAccessMode,
} from "@/lib/composerAccessMode";
import { formatModelName } from "@/lib/formatModelName";
import { restartTab } from "@/lib/grok";
import {
  PERMISSION_MODE_OPTIONS,
  type AcpConnectionState,
  type PermissionMode,
  type Theme,
} from "@/lib/types";
import { useGrokStore } from "@/stores/grokStore";
import { useSessionConfigStore } from "@/stores/sessionConfigStore";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

const ADVANCED_PERMISSION_MODES: PermissionMode[] = [
  "default",
  "acceptEdits",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "plan",
];

const ACCESS_MODE_ICONS = {
  normal: Shield,
  alwaysApprove: BadgeCheck,
  plan: ListChecks,
} as const;

function SettingsKbd({ children }: { children: ReactNode }) {
  return <kbd className="settings-kbd">{children}</kbd>;
}

function reconnectActiveThread(
  sessionId: string,
  cwd: string,
  setAcpState: (id: string, state: AcpConnectionState) => void,
  setGrokSessionId: (
    id: string,
    grokId: string,
    sessionCwd: string,
  ) => void,
) {
  setAcpState(sessionId, "connecting");
  return reconnectTabSession(sessionId, cwd)
    .then(() => {
      setAcpState(sessionId, "ready");
      const grokId = getTabSession(sessionId).grokSessionId;
      if (grokId) setGrokSessionId(sessionId, grokId, cwd);
    })
    .catch(() => setAcpState(sessionId, "error"));
}

export function SettingsPanel() {
  const open = useSettingsStore((s) => s.settingsOpen);
  const settings = useSettingsStore((s) => s.settings);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const cli = useGrokStore((s) => s.cli);
  const auth = useGrokStore((s) => s.auth);
  const loginPending = useGrokStore((s) => s.loginPending);
  const refreshGrok = useGrokStore((s) => s.refresh);
  const signIn = useGrokStore((s) => s.signIn);
  const signOut = useGrokStore((s) => s.signOut);
  const cliModels = useSessionConfigStore((s) => s.cliModels);
  const cliModelsLoaded = useSessionConfigStore((s) => s.cliModelsLoaded);
  const cliModelsError = useSessionConfigStore((s) => s.cliModelsError);
  const loadCliModels = useSessionConfigStore((s) => s.loadCliModels);
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeCwd = getSessionCwd(activeSession, projects);
  const setAcpState = useWorkspaceStore((s) => s.setAcpState);
  const setGrokSessionId = useWorkspaceStore((s) => s.setGrokSessionId);

  const quickAccessMode = composerAccessModeFromSettings(settings);
  const usingAdvancedSpawn = quickAccessMode === null;

  useEffect(() => {
    if (!open || cliModelsLoaded) return;
    void loadCliModels();
  }, [open, cliModelsLoaded, loadCliModels]);

  if (!open) return null;

  const cliReady = cli?.ready === true;
  const signedIn = auth?.authenticated === true;

  return (
    <div
      className="settings-overlay"
      role="presentation"
      onClick={() => setSettingsOpen(false)}
    >
      <aside
        className="settings-panel"
        role="dialog"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="settings-panel__header">
          <div>
            <h2 id="settings-title">Settings</h2>
            <p className="settings-panel__subtitle">
              Desktop Composer · Grok Build agent UI
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <div className="settings-panel__body">
          <section className="settings-section">
            <h3 className="settings-section__title">Grok CLI</h3>
            <dl className="settings-meta">
              <div className="settings-meta__row">
                <dt>CLI</dt>
                <dd>
                  <span
                    className={`settings-badge${cliReady ? " settings-badge--ok" : " settings-badge--warn"}`}
                  >
                    {cliReady ? "Ready" : "Not ready"}
                  </span>
                  {cliReady && (
                    <span className="settings-meta__detail">
                      {cli?.version ?? "Unknown version"}
                    </span>
                  )}
                </dd>
              </div>
              <div className="settings-meta__row">
                <dt>Account</dt>
                <dd>
                  <span
                    className={`settings-badge${signedIn ? " settings-badge--ok" : " settings-badge--warn"}`}
                  >
                    {signedIn ? "Signed in" : "Not signed in"}
                  </span>
                  {auth?.message && (
                    <span className="settings-meta__detail">{auth.message}</span>
                  )}
                </dd>
              </div>
              {cli?.grokPath && (
                <div className="settings-meta__row">
                  <dt>Executable</dt>
                  <dd className="settings-meta__mono">{cli.grokPath}</dd>
                </div>
              )}
            </dl>
            {!cliReady && cli?.error && (
              <p className="hint settings-hint--warn">{cli.error}</p>
            )}
            <div className="settings-actions">
              {!signedIn && (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={loginPending}
                  onClick={() => void signIn()}
                >
                  <LogIn size={16} />
                  {loginPending ? "Signing in…" : "Sign in (OAuth)"}
                </button>
              )}
              {signedIn && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => void signOut()}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void refreshGrok()}
              >
                <RefreshCw size={16} />
                Refresh status
              </button>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Agent defaults</h3>
            <p className="hint settings-section__lead">
              Applied when a new agent process starts. Restart the active thread
              after changing spawn options.
            </p>

            <div className="field">
              <span className="field__label" id="access-mode-label">
                Access mode
              </span>
              <div
                className="settings-segments"
                role="group"
                aria-labelledby="access-mode-label"
              >
                {COMPOSER_ACCESS_MODE_PRESENTATION.map((opt) => {
                  const Icon = ACCESS_MODE_ICONS[opt.value];
                  const active = quickAccessMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`settings-segment settings-segment--${opt.tone}${active ? " settings-segment--active" : ""}`}
                      aria-pressed={active}
                      onClick={() =>
                        void updateSettings(
                          settingsPatchForComposerAccessMode(
                            opt.value as ComposerAccessMode,
                          ),
                        )
                      }
                    >
                      <Icon size={14} aria-hidden />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="hint">
                Same as the composer pill. Cycle with <SettingsKbd>Shift</SettingsKbd>{" "}
                + <SettingsKbd>Tab</SettingsKbd> or use{" "}
                <SettingsKbd>/always-approve</SettingsKbd> in chat.
              </p>
            </div>

            <div className="field">
              <label htmlFor="permission-mode">Spawn permission mode</label>
              <select
                id="permission-mode"
                value={settings.permissionMode}
                onChange={(e) =>
                  void updateSettings({
                    permissionMode: e.target.value as PermissionMode,
                    ...(e.target.value !== "default"
                      ? { alwaysApprove: false }
                      : {}),
                  })
                }
              >
                {ADVANCED_PERMISSION_MODES.map((value) => {
                  const opt = PERMISSION_MODE_OPTIONS.find(
                    (o) => o.value === value,
                  );
                  return (
                    <option key={value} value={value}>
                      {opt?.label ?? value}
                    </option>
                  );
                })}
              </select>
              <p className="hint">
                {
                  PERMISSION_MODE_OPTIONS.find(
                    (o) => o.value === settings.permissionMode,
                  )?.description
                }{" "}
                Passed as <code>--permission-mode</code> when not Default.
                {usingAdvancedSpawn &&
                  " Quick access modes above are overridden while an advanced mode is selected."}
              </p>
              {settings.permissionMode === "bypassPermissions" && (
                <div className="warning-banner" style={{ marginTop: 10 }}>
                  Bypass permissions disables safety prompts. Only use in trusted
                  folders.
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="default-model">Default model</label>
              {cliModels.length > 0 ? (
                <select
                  id="default-model"
                  value={
                    settings.defaultModel ||
                    cliModels[0] ||
                    ""
                  }
                  onChange={(e) =>
                    void updateSettings({ defaultModel: e.target.value })
                  }
                >
                  {!settings.defaultModel && (
                    <option value="">CLI default</option>
                  )}
                  {cliModels.map((id) => (
                    <option key={id} value={id}>
                      {formatModelName(id)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="default-model"
                  type="text"
                  placeholder={
                    cliModelsError
                      ? "Run grok models after sign-in"
                      : "From grok models or override"
                  }
                  value={settings.defaultModel}
                  onChange={(e) =>
                    void updateSettings({ defaultModel: e.target.value })
                  }
                />
              )}
              <p className="hint">
                Used for new threads and the home composer. In a thread, pick a
                model from the toolbar or press <SettingsKbd>Ctrl</SettingsKbd>{" "}
                + <SettingsKbd>Tab</SettingsKbd> to cycle.
              </p>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Appearance</h3>
            <div className="field">
              <label htmlFor="theme">Theme</label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) =>
                  void updateSettings({ theme: e.target.value as Theme })
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Paths</h3>
            <div className="field">
              <label htmlFor="grok-cli-path">Grok CLI path (optional)</label>
              <input
                id="grok-cli-path"
                type="text"
                placeholder="grok on PATH"
                value={settings.grokCliPath}
                onChange={(e) =>
                  void updateSettings({ grokCliPath: e.target.value })
                }
              />
              <p className="hint">
                Leave empty to use <code>grok</code> from PATH. Session data,
                plans, and history live under <code>~/.grok/</code> (same as the
                CLI).
              </p>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section__title">Active thread</h3>
            {activeSession && activeCwd ? (
              <>
                <dl className="settings-meta">
                  <div className="settings-meta__row">
                    <dt>Thread</dt>
                    <dd>{activeSession.title}</dd>
                  </div>
                  <div className="settings-meta__row">
                    <dt>Folder</dt>
                    <dd className="settings-meta__mono">{activeCwd}</dd>
                  </div>
                  <div className="settings-meta__row">
                    <dt>ACP</dt>
                    <dd>{activeSession.acpState}</dd>
                  </div>
                </dl>
                <p className="hint">
                  Reconnect reuses the bridge; Restart stops and respawns the
                  agent with current settings.
                </p>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      if (!activeSessionId || !activeCwd) return;
                      void reconnectActiveThread(
                        activeSessionId,
                        activeCwd,
                        setAcpState,
                        setGrokSessionId,
                      );
                    }}
                  >
                    Reconnect ACP
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      if (!activeSessionId || !activeCwd) return;
                      setAcpState(activeSessionId, "connecting");
                      void restartTab(activeSessionId)
                        .then(() =>
                          reconnectActiveThread(
                            activeSessionId,
                            activeCwd,
                            setAcpState,
                            setGrokSessionId,
                          ),
                        )
                        .catch(() => setAcpState(activeSessionId, "error"));
                    }}
                  >
                    Restart agent
                  </button>
                </div>
              </>
            ) : (
              <p className="hint">
                Open a project thread from the sidebar to reconnect or restart
                its agent process.
              </p>
            )}
          </section>

          <section className="settings-section settings-section--last">
            <h3 className="settings-section__title">What you can do</h3>
            <ul className="settings-capabilities">
              <li>
                <strong>Projects & threads</strong> — Add folders in the sidebar;
                each thread runs <code>grok agent stdio</code> in that folder.
              </li>
              <li>
                <strong>Chat</strong> — Streaming replies, thinking blocks, tool
                cards with file diffs, sub-agent tree, plan review, and inline
                permission prompts.
              </li>
              <li>
                <strong>Slash commands</strong> — Type <code>/</code> for agent
                and skill commands; <code>/context</code> and{" "}
                <code>/session-info</code> open usage here in the app.
              </li>
              <li>
                <strong>Attachments</strong> — Paste or attach images in the
                composer.
              </li>
              <li>
                <strong>History</strong> — Browse prior Grok sessions per project;
                resume threads from disk under <code>~/.grok/sessions/</code>.
              </li>
              <li>
                <strong>External sessions</strong> — Threads active in the Grok
                terminal are detected and blocked here until closed there.
              </li>
            </ul>
            <table className="settings-shortcuts">
              <caption className="settings-shortcuts__caption">
                Keyboard shortcuts
              </caption>
              <tbody>
                <tr>
                  <th scope="row">
                    <SettingsKbd>Enter</SettingsKbd>
                  </th>
                  <td>Send message</td>
                </tr>
                <tr>
                  <th scope="row">
                    <SettingsKbd>Shift</SettingsKbd> + <SettingsKbd>Enter</SettingsKbd>
                  </th>
                  <td>New line</td>
                </tr>
                <tr>
                  <th scope="row">
                    <SettingsKbd>Shift</SettingsKbd> + <SettingsKbd>Tab</SettingsKbd>
                  </th>
                  <td>Cycle access mode</td>
                </tr>
                <tr>
                  <th scope="row">
                    <SettingsKbd>Ctrl</SettingsKbd> + <SettingsKbd>Tab</SettingsKbd>
                  </th>
                  <td>Cycle model</td>
                </tr>
                <tr>
                  <th scope="row">
                    <SettingsKbd>↑</SettingsKbd> / <SettingsKbd>↓</SettingsKbd>
                  </th>
                  <td>Previous prompts</td>
                </tr>
                <tr>
                  <th scope="row">
                    <SettingsKbd>Esc</SettingsKbd>
                  </th>
                  <td>Stop generation (when no menu is open)</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </aside>
    </div>
  );
}
