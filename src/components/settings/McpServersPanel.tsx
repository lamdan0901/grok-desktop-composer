import { useEffect, useState } from "react";
import { useMcpStore, type McpServerEntry } from "@/stores/mcpStore";
import {
  listMcpServers,
  upsertMcpServer,
  toggleMcpServer,
  toggleMcpTool,
  deleteMcpServer,
  triggerMcpAuth,
  type McpServerConfigInput,
} from "@/lib/acp/xaiMcp";
import { useWorkspaceStore } from "@/stores/workspaceStore";

type FormState = {
  name: string;
  type: "stdio" | "http";
  command: string;
  args: string;
  url: string;
  editing: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "stdio",
  command: "",
  args: "",
  url: "",
  editing: false,
};

const EMPTY_SERVERS: McpServerEntry[] = [];

function toConfig(form: FormState): McpServerConfigInput | null {
  if (form.type === "http") {
    if (!form.url.trim()) return null;
    return { type: "http", url: form.url.trim() };
  }
  if (!form.command.trim()) return null;
  const args = form.args
    .split(/\s+/)
    .map((a) => a.trim())
    .filter(Boolean);
  return { type: "stdio", command: form.command.trim(), ...(args.length ? { args } : {}) };
}

export function McpServersPanel() {
  const tabId = useWorkspaceStore((s) => s.activeSessionId);
  const servers = useMcpStore((s) => (tabId ? s.getServers(tabId) : EMPTY_SERVERS));
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // Mutation kinds grok reported unsupported (method_not_found) for this process.
  const [unsupported, setUnsupported] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!tabId) return;
    listMcpServers(tabId)
      .then((result) => setSupported(result !== null))
      .catch((e) => setError(String(e)));
  }, [tabId]);

  function markUnsupported(kind: string) {
    setUnsupported((prev) => new Set(prev).add(kind));
  }

  async function onToggleServer(name: string, enabled: boolean) {
    if (!tabId) return;
    // Enabling an MCP server launches its process, which executes code.
    if (enabled) {
      const ok = window.confirm(
        `Enable the MCP server "${name}"? This starts its process, which can run code on your machine.`,
      );
      if (!ok) return;
    }
    try {
      const ok = await toggleMcpServer(tabId, name, enabled);
      if (!ok) markUnsupported("toggle");
    } catch (e) {
      setError(String(e));
    }
  }

  async function onSubmitForm() {
    if (!tabId) return;
    const config = toConfig(form);
    if (!form.name.trim() || !config) return;
    // Adding/editing a server persists it and live-enables it on this session,
    // which can run code on your machine.
    const ok = window.confirm(
      `Save the MCP server "${form.name.trim()}"? This persists the configuration and starts its process, which can run code on your machine.`,
    );
    if (!ok) return;
    try {
      const done = await upsertMcpServer(tabId, form.name.trim(), config);
      if (!done) {
        markUnsupported("upsert");
        return;
      }
      setForm(EMPTY_FORM);
    } catch (e) {
      setError(String(e));
    }
  }

  function startEdit(srv: McpServerEntry) {
    setForm({
      name: srv.name,
      type: srv.type === "http" ? "http" : "stdio",
      command: srv.command ?? "",
      args: (srv.args ?? []).join(" "),
      url: srv.url ?? "",
      editing: true,
    });
  }

  if (supported === false) return null;
  if (!tabId) {
    return (
      <section className="mcp-panel" aria-label="MCP servers">
        <p className="mcp-panel__empty">Open a thread to manage its MCP servers.</p>
      </section>
    );
  }

  return (
    <section className="mcp-panel" aria-label="MCP servers">
      {error && <p className="mcp-panel__error">{error}</p>}
      {servers.length === 0 && (
        <p className="mcp-panel__empty">No MCP servers configured.</p>
      )}
      <ul className="mcp-panel__list">
        {servers.map((srv) => (
          <li key={srv.name} className="mcp-panel__server">
            <div className="mcp-panel__server-head">
              <span className="mcp-panel__name">{srv.displayName ?? srv.name}</span>
              <span
                className={`mcp-panel__status mcp-panel__status--${srv.session?.status ?? "unknown"}`}
              >
                {srv.session?.status ?? "—"}
              </span>
              {!unsupported.has("toggle") && (
                <label className="mcp-panel__enable">
                  <input
                    type="checkbox"
                    checked={srv.session?.enabled ?? false}
                    onChange={async (e) => {
                      await onToggleServer(srv.name, e.target.checked);
                    }}
                  />
                  Enabled
                </label>
              )}
              {srv.session?.authRequired && (
                <button
                  type="button"
                  onClick={async () => {
                    if (tabId) await triggerMcpAuth(tabId, srv.name);
                  }}
                >
                  Authenticate
                </button>
              )}
              {srv.source === "local" && (
                <>
                  <button type="button" onClick={() => startEdit(srv)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (tabId) {
                        const ok = await deleteMcpServer(tabId, srv.name);
                        if (!ok) markUnsupported("delete");
                      }
                    }}
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
            {srv.session?.tools?.length ? (
              <ul className="mcp-panel__tools">
                {srv.session.tools.map((tool) => (
                  <li key={tool.name}>
                    <label>
                      <input
                        type="checkbox"
                        checked={tool.enabled}
                        onChange={async (e) => {
                          if (tabId) {
                            const ok = await toggleMcpTool(
                              tabId,
                              srv.name,
                              tool.name,
                              e.target.checked,
                            );
                            if (!ok) markUnsupported("toggleTool");
                          }
                        }}
                      />
                      {tool.displayName ?? tool.name}
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {!unsupported.has("upsert") && (
        <form
          className="mcp-panel__form"
          aria-label={form.editing ? "Edit MCP server" : "Add MCP server"}
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmitForm();
          }}
        >
          <input
            aria-label="Server name"
            placeholder="Server name"
            value={form.name}
            disabled={form.editing}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            aria-label="Server type"
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as "stdio" | "http" }))
            }
          >
            <option value="stdio">stdio</option>
            <option value="http">http</option>
          </select>
          {form.type === "stdio" ? (
            <>
              <input
                aria-label="Command"
                placeholder="Command (e.g. npx)"
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
              />
              <input
                aria-label="Arguments"
                placeholder="Arguments (space separated)"
                value={form.args}
                onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
              />
            </>
          ) : (
            <input
              aria-label="URL"
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          )}
          <button type="submit">{form.editing ? "Save server" : "Add server"}</button>
          {form.editing && (
            <button type="button" onClick={() => setForm(EMPTY_FORM)}>
              Cancel
            </button>
          )}
        </form>
      )}
    </section>
  );
}
