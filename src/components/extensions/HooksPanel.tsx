import { useEffect, useState } from "react";
import { listHooks, runHookAction } from "@/lib/acp/xaiExtensions";
import { useHookStore } from "@/stores/hookStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const ACTIONS = ["enable", "disable", "test", "trust"] as const;
const EMPTY_HOOKS = [] as const;

export function HooksPanel() {
  const tabId = useWorkspaceStore((state) => state.activeSessionId);
  const hooks = useHookStore((state) => (tabId ? state.hooksByTab[tabId] ?? EMPTY_HOOKS : EMPTY_HOOKS));
  const loading = useHookStore((state) => (tabId ? state.loadingByTab[tabId] : false));
  const error = useHookStore((state) => (tabId ? state.errorByTab[tabId] : undefined));
  const [unsupported, setUnsupported] = useState<Set<string>>(new Set());

  async function reload() {
    if (!tabId) return;
    const store = useHookStore.getState();
    store.setLoading(tabId, true);
    store.setError(tabId);
    try {
      const result = await listHooks(tabId);
      if (result) store.setHooks(tabId, result);
      else setUnsupported((current) => new Set(current).add("list"));
    } catch (cause) {
      store.setError(tabId, String(cause));
    } finally {
      store.setLoading(tabId, false);
    }
  }

  useEffect(() => {
    reload().catch((cause) => {
      if (tabId) useHookStore.getState().setError(tabId, String(cause));
    });
  }, [tabId]);

  async function action(hookId: string, actionName: string, hookName: string) {
    if (!tabId) return;
    const approved = window.confirm(`${actionName[0].toUpperCase()}${actionName.slice(1)} ${hookName}? Hooks can run code before or after Grok tools.`);
    if (!approved) return;
    try {
      const supported = await runHookAction(tabId, hookId, actionName);
      if (!supported) setUnsupported((current) => new Set(current).add(actionName));
      else await reload();
    } catch (cause) {
      useHookStore.getState().setError(tabId, String(cause));
    }
  }

  if (!tabId) return <p className="extensions-empty">Open a thread to manage its hooks.</p>;
  if (unsupported.has("list")) return <p className="extensions-empty">Hooks are not supported by this Grok session.</p>;

  return (
    <section className="extensions-panel" aria-label="Hooks">
      {error && <p className="extensions-error">{error}</p>}
      {loading && <p className="extensions-empty">Loading hooks…</p>}
      {!loading && hooks.length === 0 && <p className="extensions-empty">No Grok-owned hooks installed.</p>}
      <ul className="extensions-list">
        {hooks.map((hook) => (
          <li key={hook.id} className="extensions-list__item">
            <div>
              <strong>{hook.name}</strong>
              {hook.event && <p>{hook.event}</p>}
              <small>{hook.trusted ? "Trusted" : "Not trusted"} · {hook.enabled ? "Enabled" : "Disabled"}</small>
            </div>
            {ACTIONS.map((actionName) => {
              if (unsupported.has(actionName)) return null;
              const label = `${actionName[0].toUpperCase()}${actionName.slice(1)} ${hook.name}`;
              return (
                <button key={actionName} type="button" onClick={() => action(hook.id, actionName, hook.name)}>
                  {label}
                </button>
              );
            })}
          </li>
        ))}
      </ul>
    </section>
  );
}
