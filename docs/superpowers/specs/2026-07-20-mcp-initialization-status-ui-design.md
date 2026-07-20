# MCP initialization status in chat

## Goal

Show the user what configured MCP servers are doing while the lazily spawned
Grok ACP child initializes them before the first prompt. Keep the final result
visible in the chat UI without adding synthetic transcript messages.

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

Render one compact status row in the chat area above the conversation. It is
UI-only and never enters `ChatMessage` history or transcript exports.

Displayed states:

- No configured servers: hidden.
- Running: `Starting MCP servers 2/4…`.
- Success: `MCP ready: 4/4`.
- Partial result: `MCP ready: 3/4 · GitHub unavailable`.
- Authentication result: `MCP ready: 3/4 · Atlassian needs authentication`.

The final result remains visible until the ACP child restarts or the tab
closes. ACP startup errors continue through the existing connection-error UI.
Malformed or incomplete notifications are ignored.

## Testing

- Store tests cover progress, failure names, completion, and reset.
- Notification-router tests use the real Grok payload shapes and wire names.
- UI tests cover hidden, running, success, unavailable, and authentication
  states.
- Run focused Vitest tests and `npx tsc --noEmit`; do not run a build.

## Scope

No GUI polling, MCP configuration duplication, synthetic chat messages, new
MCP APIs, or changes to `session/new.mcpServers` or `session/load.mcpServers`.
