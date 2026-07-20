import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { notifyConversationFinished } from "./conversationNotification";

const mocks = vi.hoisted(() => ({
  isFocused: vi.fn(),
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isFocused: mocks.isFocused }),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: mocks.isPermissionGranted,
  requestPermission: mocks.requestPermission,
  sendNotification: mocks.sendNotification,
}));

describe("notifyConversationFinished", () => {
  beforeEach(() => {
    mocks.isFocused.mockReset().mockResolvedValue(false);
    mocks.isPermissionGranted.mockReset().mockResolvedValue(true);
    mocks.requestPermission.mockReset();
    mocks.sendNotification.mockReset();
    useWorkspaceStore.setState({
      sessions: [{
        id: "s1",
        projectId: "p1",
        title: "Fix notifications",
        status: "idle",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      }],
    });
  });

  it("notifies with the conversation title when the window is unfocused", async () => {
    await notifyConversationFinished("s1");

    expect(mocks.sendNotification).toHaveBeenCalledWith({
      title: "Grok finished responding",
      body: "Fix notifications",
    });
  });

  it("does nothing when the window is focused", async () => {
    mocks.isFocused.mockResolvedValueOnce(true);

    await notifyConversationFinished("s1");

    expect(mocks.isPermissionGranted).not.toHaveBeenCalled();
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("requests permission and notifies only when permission is granted", async () => {
    mocks.isPermissionGranted.mockResolvedValue(false);
    mocks.requestPermission
      .mockResolvedValueOnce("granted")
      .mockResolvedValueOnce("denied");

    await notifyConversationFinished("s1");
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);

    await notifyConversationFinished("s1");
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("absorbs native notification errors", async () => {
    mocks.isFocused.mockRejectedValueOnce(new Error("native failure"));

    await expect(notifyConversationFinished("s1")).resolves.toBeUndefined();
  });
});
