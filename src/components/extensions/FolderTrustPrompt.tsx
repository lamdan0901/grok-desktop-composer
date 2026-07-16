import { useFolderTrustStore } from "@/stores/folderTrustStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function FolderTrustPrompt() {
  const sessionId = useWorkspaceStore((state) => state.activeSessionId);
  const pending = useFolderTrustStore((state) => (sessionId ? state.pendingBySession[sessionId] : undefined));
  if (!sessionId || !pending) return null;
  return (
    <div className="folder-trust-overlay" role="alertdialog" aria-label="Folder trust request">
      <div className="folder-trust-prompt">
        <h2>Trust this folder?</h2>
        <p>{pending.folder ?? "The current project folder"}</p>
        {pending.reason && <p>{pending.reason}</p>}
        <div className="folder-trust-prompt__actions">
          <button type="button" onClick={() => useFolderTrustStore.getState().respond(sessionId, false)}>Deny</button>
          <button type="button" onClick={() => useFolderTrustStore.getState().respond(sessionId, true)}>Approve</button>
        </div>
      </div>
    </div>
  );
}
