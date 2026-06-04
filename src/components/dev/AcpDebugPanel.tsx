import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useAcpStore } from "@/stores/acpStore";

export function AcpDebugPanel() {
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId);
  const lines = useAcpStore((s) =>
    activeSessionId ? s.linesByTab[activeSessionId] : undefined,
  );
  const errors = useAcpStore((s) =>
    activeSessionId ? s.errorsByTab[activeSessionId] : undefined,
  );

  if (!activeSessionId) return null;

  return (
    <details className="acp-debug">
      <summary>ACP debug ({lines?.length ?? 0} lines)</summary>
      <pre>
        {errors?.length ? `Errors:\n${errors.join("\n")}\n\n` : ""}
        {lines?.slice(-20).join("\n")}
      </pre>
    </details>
  );
}