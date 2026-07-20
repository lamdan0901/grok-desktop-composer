# MCP initialization before the first prompt

## Goal

When a user sends the first prompt in a new chat thread, configured MCP servers must finish initialization before Grok handles that prompt. Creating or opening a new thread must not start MCP work.

## Design

Set `MCP_INIT_STRATEGY=blocking` on the Grok ACP child process in `src-tauri/src/grok/process_manager.rs`.

The existing lifecycle already starts that child lazily from `ensureAcpForSend`, so the environment setting affects the first send without changing thread creation. Grok's runtime owns MCP configuration, starts configured servers, emits its existing lifecycle notifications, and waits for `mcp_initialized` before preparing first-turn tools.

Keep `session/new.mcpServers` and `session/load.mcpServers` empty. Those fields are for client-injected ephemeral servers; persistent MCP configuration remains Grok-owned.

## Failure behavior

Use Grok's existing bounded MCP wait and status notifications. Failed or unavailable servers reach a terminal state without adding GUI polling or a second MCP state machine. Existing ACP/process errors remain unchanged.

## Verification

Add one focused Rust unit test that verifies the spawned Grok command receives `MCP_INIT_STRATEGY=blocking`. Run that test and the existing lint/type check. Do not add UI changes or new MCP APIs.

## Scope

Only the process spawn environment and its focused test change. Existing unrelated worktree changes are out of scope.
