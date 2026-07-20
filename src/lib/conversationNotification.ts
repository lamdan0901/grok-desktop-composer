import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { SessionId } from "@/lib/types";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export async function notifyConversationFinished(
  sessionId: SessionId,
): Promise<void> {
  try {
    if (await getCurrentWindow().isFocused()) return;

    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      permissionGranted = (await requestPermission()) === "granted";
    }
    if (!permissionGranted) return;

    const session = useWorkspaceStore
      .getState()
      .sessions.find((candidate) => candidate.id === sessionId);
    if (!session) return;

    sendNotification({
      title: "Grok finished responding",
      body: session.title,
    });
  } catch {
    // Notifications are best effort and must not affect a completed response.
  }
}
