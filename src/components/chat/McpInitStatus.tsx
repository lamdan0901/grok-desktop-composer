import { formatMcpInitialization, useMcpStore } from "@/stores/mcpStore";

export function McpInitStatus({ tabId }: { tabId: string | null }) {
  const state = useMcpStore((s) => (tabId ? s.initializationByTab[tabId] : undefined));
  if (!state || state.total <= 0) return null;

  return (
    <div className="chat-column__mcp-status" role="status" aria-live="polite">
      {formatMcpInitialization(state)}
    </div>
  );
}
