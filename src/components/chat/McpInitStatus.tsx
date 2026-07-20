import { formatMcpInitialization, useMcpStore } from "@/stores/mcpStore";

export function McpInitStatus({ tabId }: { tabId: string | null }) {
  const state = useMcpStore((s) => (tabId ? s.initializationByTab[tabId] : undefined));
  const message =
    state && state.total > 0 ? formatMcpInitialization(state) : null;
  if (!message) return null;

  return (
    <div className="chat-column__mcp-status" role="status" aria-live="polite">
      {message}
    </div>
  );
}
