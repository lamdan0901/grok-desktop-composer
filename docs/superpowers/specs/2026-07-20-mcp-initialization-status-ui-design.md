# MCP initialization status in chat

## Goal

Show the user what configured MCP servers are doing while the lazily spawned
Grok ACP child initializes them before the first prompt. Keep failed results at
the top of the conversation without adding synthetic transcript messages; hide
successful completion.

This is a follow-up to `2026-07-20-mcp-first-prompt-design.md`; it supersedes
that document's UI exclusion for this status surface only.

## Existing wire events

The current Grok ACP runtime emits these notifications:

- `_x.ai/mcp/init_progress` with `{ total, connected, sessionId }`.
- `_x.ai/mcp/server_status` with `{ name, status, sessionId }`.
- `_x.ai/mcp_initialized` with `{ mcpToolCount, elapsedMs, sessionId }`.

The existing MCP notification entries omit the leading underscore, so the
MCP entries must be corrected to the actual `_x.ai/...` wire names. Only the
MCP notification entries change; unrelated extension methods remain out of
scope.

## Design

Extend the existing per-tab `mcpStore` with initialization state:

- `running | complete` phase.
- `total` and `connected` counters.
- Failed server names and statuses (`unavailable`, `needsauth`).

Route progress and server-status notifications into this state. Add routing
for `_x.ai/mcp_initialized` to mark initialization complete. Reset the state
when a child process reconnects or the tab is disposed.

Render one compact status row as the first item inside the conversation scroll
container. It scrolls away with the conversation and is never sticky. It is
UI-only and never enters `ChatMessage` history or transcript exports.

Displayed states:

- No configured servers: hidden.
- Running: `Starting MCP servers 2/4…`.
- Success: hidden after initialization completes.
- One failure: `1 MCP server failed: github`.
- Multiple failures: `2 MCP servers failed: github, atlassian`.

Failed results remain in the scrollable conversation until the ACP child
restarts or the tab closes. ACP startup errors continue through the existing
connection-error UI. Malformed or incomplete notifications are ignored.

## Testing

- Store tests cover progress, failure names, completion, and reset.
- Notification-router tests use the real Grok payload shapes and wire names.
- UI tests cover hidden, running, hidden success, and singular/plural failed
  server names.
- Run focused Vitest tests and `npx tsc --noEmit`; do not run a build.

## Scope

No GUI polling, MCP configuration duplication, synthetic chat messages, new
MCP APIs, or changes to `session/new.mcpServers` or `session/load.mcpServers`.
