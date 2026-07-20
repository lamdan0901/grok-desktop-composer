# MCP Initialization Status UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live MCP initialization progress and the final ready/failure result in the chat UI for each ACP tab.

**Architecture:** Route Grok's existing `_x.ai/mcp/init_progress`, `_x.ai/mcp/server_status`, and `_x.ai/mcp_initialized` notifications into the existing per-tab `mcpStore`. Render the store state as a compact UI-only row above the conversation; never add synthetic `ChatMessage` entries or poll the agent.

**Tech Stack:** TypeScript, React, Zustand, Vitest, Testing Library, existing ACP extension-notification router.

## Global Constraints

- Keep `session/new.mcpServers` and `session/load.mcpServers` empty.
- Do not add GUI MCP polling, duplicate MCP configuration state, synthetic transcript messages, new MCP APIs, or unrelated extension-method changes.
- Preserve existing MCP catalog/status behavior and unrelated worktree changes.
- Use the actual Grok wire names with the leading `_`: `_x.ai/mcp/...`.
- Run focused Vitest tests and `npx tsc --noEmit`; do not run a build.

---

### Task 1: Route MCP initialization events into per-tab state

**Files:**
- Modify: `src/lib/acp/xaiMethods.ts`
- Modify: `src/stores/mcpStore.ts`
- Modify: `src/lib/acp/mcpNotifications.ts`
- Modify: `src/lib/acp/tabSession.ts`
- Test: `src/stores/mcpStore.test.ts`
- Test: `src/lib/acp/mcpNotifications.test.ts`

**Interfaces:**
- Consumes: Grok notifications `_x.ai/mcp/init_progress`, `_x.ai/mcp/server_status`, and `_x.ai/mcp_initialized`.
- Produces: `McpInitializationState`, `useMcpStore.getInitialization(tabId)`, and store actions for progress, failures, completion, and reset.

- [ ] **Step 1: Write failing store and router tests**

Extend the existing `beforeEach` resets to include `initializationByTab: {}`. Add this store test to `src/stores/mcpStore.test.ts`:

```ts
it("tracks initialization progress, failures, completion, and reset", () => {
  useMcpStore.getState().setInitializationProgress("tabA", 4, 0);
  useMcpStore.getState().setInitializationProgress("tabA", 4, 2);
  useMcpStore.getState().applyInitializationServerStatus(
    "tabA",
    "github",
    "unavailable",
  );
  useMcpStore.getState().completeInitialization("tabA");

  expect(useMcpStore.getState().getInitialization("tabA")).toEqual({
    phase: "complete",
    total: 4,
    connected: 2,
    failures: { github: "unavailable" },
  });

  useMcpStore.getState().clearInitialization("tabA");
  expect(useMcpStore.getState().getInitialization("tabA")).toBeUndefined();
});
```

Add these router tests to `src/lib/acp/mcpNotifications.test.ts`:

```ts
it("routes live Grok initialization notifications", () => {
  expect(
    routeMcpNotification("tabA", "_x.ai/mcp/init_progress", {
      total: 3,
      connected: 1,
    }),
  ).toBe(true);
  routeMcpNotification("tabA", "_x.ai/mcp/server_status", {
    name: "atlassian",
    status: "needsauth",
  });
  routeMcpNotification("tabA", "_x.ai/mcp_initialized", {});

  expect(useMcpStore.getState().getInitialization("tabA")).toEqual({
    phase: "complete",
    total: 3,
    connected: 1,
    failures: { atlassian: "needsauth" },
  });
});

it("ignores malformed initialization progress", () => {
  expect(
    routeMcpNotification("tabA", "_x.ai/mcp/init_progress", {
      total: "3",
      connected: 1,
    }),
  ).toBe(true);
  expect(useMcpStore.getState().getInitialization("tabA")).toBeUndefined();
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
npx vitest run src/stores/mcpStore.test.ts src/lib/acp/mcpNotifications.test.ts
```

Expected: compilation/test failures because initialization state, actions, and the `_x.ai` routing cases do not exist yet.

- [ ] **Step 3: Add the initialization state and actions**

In `src/stores/mcpStore.ts`, add these exported types and state members beside the existing MCP catalog types:

```ts
export type McpInitializationPhase = "running" | "complete";
export type McpInitializationFailure = Extract<
  McpServerStatus,
  "unavailable" | "needsauth"
>;

export interface McpInitializationState {
  phase: McpInitializationPhase;
  total: number;
  connected: number;
  failures: Record<string, McpInitializationFailure>;
}
```

Add `initializationByTab` and these actions to `McpState`:

```ts
initializationByTab: Record<string, McpInitializationState>;
setInitializationProgress: (tabId: string, total: number, connected: number) => void;
applyInitializationServerStatus: (
  tabId: string,
  name: string,
  status: McpServerStatus | undefined,
) => void;
completeInitialization: (tabId: string) => void;
getInitialization: (tabId: string) => McpInitializationState | undefined;
clearInitialization: (tabId: string) => void;
```

Implement the actions in the existing Zustand initializer. `setInitializationProgress` starts a fresh `running` state when no state exists or the previous state is `complete`, and otherwise preserves failure names while updating counters. `applyInitializationServerStatus` records only `unavailable` and `needsauth` statuses and removes a server from `failures` when it reports `ready`. `completeInitialization` changes only an existing state to `complete`; `clearInitialization` removes the tab entry.

- [ ] **Step 4: Route the actual Grok wire notifications**

In `src/lib/acp/xaiMethods.ts`, change only the four existing MCP notification entries to their actual wire names and add the completion notification:

```ts
mcpServersUpdated: entry("_x.ai/mcp/servers_updated", "agent->gui", "notification"),
mcpServerStatus: entry("_x.ai/mcp/server_status", "agent->gui", "notification"),
mcpToolsChanged: entry("_x.ai/mcp/tools_changed", "agent->gui", "notification"),
mcpInitProgress: entry("_x.ai/mcp/init_progress", "agent->gui", "notification"),
mcpInitialized: entry("_x.ai/mcp_initialized", "agent->gui", "notification"),
```

In `src/lib/acp/mcpNotifications.ts`:

- Parse `total` and `connected` only when both are safe non-negative integers; consume malformed progress without mutating state.
- Keep the existing catalog update behavior for `mcpServersUpdated`.
- Keep the existing catalog update behavior for `mcpServerStatus`, and also call `applyInitializationServerStatus`.
- Add `mcpInitialized` handling that marks the tab complete.
- Continue marking consumed notification features as seen.
- Update the existing catalog/status test literals from `x.ai/mcp/...` to `_x.ai/mcp/...`; request methods such as `x.ai/mcp/list` remain unchanged.

- [ ] **Step 5: Reset initialization state when the ACP child reconnects**

In `TabAcpSession.connect` in `src/lib/acp/tabSession.ts`, call:

```ts
useMcpStore.getState().clearInitialization(this.tabId);
```

immediately after `await this.teardownAgentProcess()` and before `startTab(...)`. Keep the existing `dispose` cleanup as-is so tab disposal also clears state.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```powershell
npx vitest run src/stores/mcpStore.test.ts src/lib/acp/mcpNotifications.test.ts
npx tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits `0`.

- [ ] **Step 7: Commit the event/state slice**

```powershell
git add -- src/lib/acp/xaiMethods.ts src/stores/mcpStore.ts src/lib/acp/mcpNotifications.ts src/lib/acp/tabSession.ts src/stores/mcpStore.test.ts src/lib/acp/mcpNotifications.test.ts
git commit -m "feat: track MCP initialization status"
```

### Task 2: Render MCP initialization status in chat

**Files:**
- Create: `src/components/chat/McpInitStatus.tsx`
- Test: `src/components/chat/McpInitStatus.test.tsx`
- Modify: `src/components/chat/ChatColumn.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/stores/mcpStore.ts`

**Interfaces:**
- Consumes: `useMcpStore` initialization state from Task 1.
- Produces: UI-only `McpInitStatus` row rendered above the conversation.

- [ ] **Step 1: Write failing UI tests**

Create `src/components/chat/McpInitStatus.test.tsx` with the jsdom environment and this coverage:

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMcpStore } from "@/stores/mcpStore";
import { McpInitStatus } from "./McpInitStatus";

describe("McpInitStatus", () => {
  beforeEach(() => useMcpStore.setState({ serversByTab: {}, initializationByTab: {} }));
  afterEach(cleanup);

  it("hides when no servers are initializing", () => {
    const { container } = render(<McpInitStatus tabId="tabA" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders running progress", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: { phase: "running", total: 4, connected: 2, failures: {} },
      },
    });
    render(<McpInitStatus tabId="tabA" />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting MCP servers 2/4…");
  });

  it("renders the final result and failed server names", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: {
          phase: "complete",
          total: 4,
          connected: 3,
          failures: { github: "unavailable", atlassian: "needsauth" },
        },
      },
    });
    render(<McpInitStatus tabId="tabA" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "MCP ready: 3/4 · github unavailable, atlassian needs authentication",
    );
  });
});
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run:

```powershell
npx vitest run src/components/chat/McpInitStatus.test.tsx
```

Expected: module/import failure because `McpInitStatus` and its formatter do not exist yet.

- [ ] **Step 3: Add the formatter and minimal status component**

In `src/stores/mcpStore.ts`, add the pure formatter:

```ts
export function formatMcpInitialization(state: McpInitializationState): string {
  if (state.phase === "running") {
    return `Starting MCP servers ${state.connected}/${state.total}…`;
  }
  const failures = Object.entries(state.failures)
    .map(([name, status]) => `${name} ${status === "needsauth" ? "needs authentication" : "unavailable"}`)
    .join(", ");
  return `MCP ready: ${state.connected}/${state.total}${failures ? ` · ${failures}` : ""}`;
}
```

Create `src/components/chat/McpInitStatus.tsx`:

```tsx
import { useMcpStore, formatMcpInitialization } from "@/stores/mcpStore";

export function McpInitStatus({ tabId }: { tabId: string | null }) {
  const state = useMcpStore((s) => (tabId ? s.initializationByTab[tabId] : undefined));
  if (!state || state.total <= 0) return null;

  return (
    <div className="chat-column__mcp-status" role="status" aria-live="polite">
      {formatMcpInitialization(state)}
    </div>
  );
}
```

- [ ] **Step 4: Mount the row and style it**

In `src/components/chat/ChatColumn.tsx`, import `McpInitStatus` and render:

```tsx
<McpInitStatus tabId={activeSessionId} />
<div className="chat-column__scroll" ref={scrollRef}>
```

Place it immediately before the existing scroll container so it remains visible above the conversation and outside transcript data.

In `src/styles/global.css`, add the compact status styling next to the existing chat-column status rules:

```css
.chat-column__mcp-status {
  flex-shrink: 0;
  padding: 8px 20px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}
```

- [ ] **Step 5: Run focused UI tests and typecheck**

Run:

```powershell
npx vitest run src/components/chat/McpInitStatus.test.tsx src/stores/mcpStore.test.ts src/lib/acp/mcpNotifications.test.ts
npx tsc --noEmit
```

Expected: all listed tests pass and TypeScript exits `0`.

- [ ] **Step 6: Review the diff and commit the UI slice**

```powershell
git diff -- src/components/chat/McpInitStatus.tsx src/components/chat/McpInitStatus.test.tsx src/components/chat/ChatColumn.tsx src/styles/global.css src/stores/mcpStore.ts
git status --short
git add -- src/components/chat/McpInitStatus.tsx src/components/chat/McpInitStatus.test.tsx src/components/chat/ChatColumn.tsx src/styles/global.css src/stores/mcpStore.ts
git commit -m "feat: show MCP initialization status in chat"
```

Confirm the diff contains no changes to `session/new.mcpServers` or `session/load.mcpServers`, no polling, and no synthetic chat messages.
