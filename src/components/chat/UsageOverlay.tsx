import { ExternalLink, Gauge, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatModelName } from "@/lib/formatModelName";
import { displayThreadTitle } from "@/lib/threadTitle";
import {
  CONTEXT_COMPACT_THRESHOLD_PCT,
  contextBarClass,
  formatDuration,
  formatIsoTimestamp,
  formatTokenCount,
  GROK_SUBSCRIPTION_USAGE_URL,
  hasContextUsageData,
} from "@/lib/usage";
import { useUsageStore } from "@/stores/usageStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

export function UsageOverlay() {
  const open = useUsageStore((s) => s.overlayOpen);
  const setOverlayOpen = useUsageStore((s) => s.setOverlayOpen);
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);

  const session = sessions.find((s) => s.id === activeSessionId);
  const cwd = getSessionCwd(session, projects);
  const entry = useUsageStore((s) =>
    activeSessionId != null ? s.bySession[activeSessionId] : undefined,
  );

  if (!open) return null;

  const signals = entry?.signals;
  const meta = entry?.meta;
  const pct = signals?.contextWindowUsage ?? 0;
  const windowTokens = signals?.contextWindowTokens ?? 0;
  const usedTokens = signals?.contextTokensUsed ?? 0;
  const hasContextData = hasContextUsageData(signals);
  const remaining =
    windowTokens > usedTokens ? windowTokens - usedTokens : 0;
  const compactAt =
    windowTokens > 0
      ? Math.round((windowTokens * CONTEXT_COMPACT_THRESHOLD_PCT) / 100)
      : 0;

  const rawModelId = signals?.primaryModelId ?? meta?.modelId ?? null;
  const modelLabel = rawModelId ? formatModelName(rawModelId) : null;
  const agentLabel = meta?.agentName ?? null;
  const workdir = meta?.cwd ?? cwd ?? null;
  const threadTitle = session ? displayThreadTitle(session) : "";

  const openSubscriptionUsage = () => {
    void openUrl(GROK_SUBSCRIPTION_USAGE_URL);
  };

  return (
    <div className="usage-overlay" role="dialog" aria-label="Usage">
      <div
        className="usage-overlay__backdrop"
        aria-hidden
        onClick={() => setOverlayOpen(false)}
      />
      <div className="usage-overlay__panel">
        <header className="usage-overlay__header">
          <div className="usage-overlay__title-row">
            <Gauge size={20} className="usage-overlay__icon" />
            <h2 className="usage-overlay__title">Usage & session</h2>
          </div>
          <button
            type="button"
            className="usage-overlay__close"
            aria-label="Close usage"
            onClick={() => setOverlayOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <div className="usage-overlay__body">
          <section className="usage-overlay__section">
            <h3 className="usage-overlay__section-title">Session</h3>
            {!session?.grokSessionId ? (
              <p className="usage-overlay__status">
                Open or start a thread with a Grok session to see session info.
              </p>
            ) : (
              <dl className="usage-overlay__stats">
                {threadTitle && (
                  <div className="usage-overlay__stat usage-overlay__stat--wide">
                    <dt>Title</dt>
                    <dd>{threadTitle}</dd>
                  </div>
                )}
                {modelLabel && (
                  <div className="usage-overlay__stat">
                    <dt>Model</dt>
                    <dd>{modelLabel}</dd>
                  </div>
                )}
                {agentLabel && (
                  <div className="usage-overlay__stat">
                    <dt>Agent</dt>
                    <dd>{agentLabel}</dd>
                  </div>
                )}
                {workdir && (
                  <div className="usage-overlay__stat usage-overlay__stat--wide">
                    <dt>Working directory</dt>
                    <dd className="usage-overlay__mono" title={workdir}>
                      {workdir}
                    </dd>
                  </div>
                )}
                <div className="usage-overlay__stat usage-overlay__stat--wide">
                  <dt>Session ID</dt>
                  <dd className="usage-overlay__mono">{session.grokSessionId}</dd>
                </div>
                {meta?.numChatMessages != null && meta.numChatMessages > 0 && (
                  <div className="usage-overlay__stat">
                    <dt>Chat messages</dt>
                    <dd>{meta.numChatMessages}</dd>
                  </div>
                )}
                {meta?.headBranch && (
                  <div className="usage-overlay__stat">
                    <dt>Branch</dt>
                    <dd>{meta.headBranch}</dd>
                  </div>
                )}
                {meta?.createdAt && (
                  <div className="usage-overlay__stat">
                    <dt>Started</dt>
                    <dd>{formatIsoTimestamp(meta.createdAt)}</dd>
                  </div>
                )}
                {meta?.updatedAt && (
                  <div className="usage-overlay__stat">
                    <dt>Last active</dt>
                    <dd>{formatIsoTimestamp(meta.updatedAt)}</dd>
                  </div>
                )}
              </dl>
            )}
          </section>

          <section className="usage-overlay__section">
            <h3 className="usage-overlay__section-title">Context</h3>
            {entry?.loading && !signals ? (
              <p className="usage-overlay__status">Loading context usage…</p>
            ) : entry?.error && !hasContextData ? (
              <p className="usage-overlay__status usage-overlay__status--error">
                {entry.error}
              </p>
            ) : !session?.grokSessionId ? (
              <p className="usage-overlay__status">
                Connect a thread to Grok to see context usage.
              </p>
            ) : !hasContextData ? (
              <p className="usage-overlay__status">
                Context usage is not available yet for this thread.
              </p>
            ) : (
              <>
                <div className="usage-overlay__meter">
                  <div className="usage-overlay__meter-track">
                    <div
                      className={`usage-overlay__meter-fill ${contextBarClass(pct)}`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <span className="usage-overlay__meter-label">
                    {pct}% context used
                  </span>
                </div>

                <dl className="usage-overlay__stats">
                  <div className="usage-overlay__stat">
                    <dt>Context</dt>
                    <dd>
                      {formatTokenCount(usedTokens)} /{" "}
                      {formatTokenCount(windowTokens)} tokens
                      {remaining > 0 && (
                        <span className="usage-overlay__muted">
                          {" "}
                          · {formatTokenCount(remaining)} left
                        </span>
                      )}
                    </dd>
                  </div>
                  {compactAt > 0 && (
                    <div className="usage-overlay__stat">
                      <dt>Auto-compact</dt>
                      <dd>
                        at {CONTEXT_COMPACT_THRESHOLD_PCT}% (
                        {formatTokenCount(compactAt)} tokens)
                      </dd>
                    </div>
                  )}
                  <div className="usage-overlay__stat">
                    <dt>Turns</dt>
                    <dd>{signals?.turnCount ?? 0}</dd>
                  </div>
                  <div className="usage-overlay__stat">
                    <dt>Tool calls</dt>
                    <dd>{signals?.toolCallCount ?? 0}</dd>
                  </div>
                  {(signals?.sessionDurationSeconds ?? 0) > 0 && (
                    <div className="usage-overlay__stat">
                      <dt>Session time</dt>
                      <dd>
                        {formatDuration(signals!.sessionDurationSeconds)}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )}
          </section>

          <section className="usage-overlay__section">
            <h3 className="usage-overlay__section-title">Subscription</h3>
            <p className="usage-overlay__hint">
              Credit and plan limits are managed on grok.com. This app reads
              per-thread context from Grok&apos;s local{" "}
              <code className="usage-overlay__mono">signals.json</code> and
              session fields from{" "}
              <code className="usage-overlay__mono">summary.json</code> — the
              same sources as <code>/session-info</code> in the Grok TUI.
            </p>
            <button
              type="button"
              className="btn btn--secondary usage-overlay__link-btn"
              onClick={openSubscriptionUsage}
            >
              <ExternalLink size={14} aria-hidden />
              View subscription usage
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}