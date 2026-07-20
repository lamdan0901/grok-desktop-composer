import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { useWorkspaceBootstrap } from "@/hooks/useWorkspaceBootstrap";
import { useWorkspacePersistence } from "@/hooks/useWorkspacePersistence";
import { AcpDebugPanel } from "@/components/dev/AcpDebugPanel";
import { ChatColumn } from "@/components/chat/ChatColumn";
import { Composer } from "@/components/chat/Composer";
import { PermissionPrompt } from "@/components/chat/PermissionPrompt";
import { PlanOverlay } from "@/components/chat/PlanOverlay";
import { AskQuestionOverlay } from "@/components/chat/AskQuestionOverlay";
import { UsageOverlay } from "@/components/chat/UsageOverlay";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { ExtensionsModal } from "@/components/extensions/ExtensionsModal";
import { FolderTrustPrompt } from "@/components/extensions/FolderTrustPrompt";
import { usePlanWatcher } from "@/hooks/usePlanWatcher";
import { useSessionTitleWatcher } from "@/hooks/useSessionTitleWatcher";
import { useActiveSessionsWatcher } from "@/hooks/useActiveSessionsWatcher";
import { useSignalsWatcher } from "@/hooks/useSignalsWatcher";
import { useGrokSessionDiskSync } from "@/hooks/useGrokSessionDiskSync";
import { useSessionConnections } from "@/hooks/useSessionConnections";
import { useTaskbarProgress } from "@/hooks/useTaskbarProgress";
import { useTabAcpBridge } from "@/hooks/useTabAcpBridge";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppShell() {
  useTabAcpBridge();
  useSessionConnections();
  useGrokSessionDiskSync();
  usePlanWatcher();
  useActiveSessionsWatcher();
  useSignalsWatcher();
  useSessionTitleWatcher();
  useWorkspaceBootstrap();
  useWorkspacePersistence();
  useTaskbarProgress();

  const activeSession = useWorkspaceStore((s) =>
    s.sessions.find((x) => x.id === s.activeSessionId),
  );
  const planReview = activeSession?.status === "plan_review";

  return (
    <div className="app-shell">
      <div className="main-row">
        <WorkspaceSidebar />
        <div
          className={`main-pane${planReview ? " main-pane--plan-review" : ""}`}
        >
          <ChatColumn />
          <PermissionPrompt />
          <Composer />
          <PlanOverlay />
          <AskQuestionOverlay />
          <UsageOverlay />
        </div>
      </div>
      {import.meta.env.DEV && <AcpDebugPanel />}
      <SettingsPanel />
      <ExtensionsModal />
      <FolderTrustPrompt />
    </div>
  );
}
