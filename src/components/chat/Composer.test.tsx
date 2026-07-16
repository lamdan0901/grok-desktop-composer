// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Composer } from "./Composer";

const { mockSendPrompt } = vi.hoisted(() => ({
  mockSendPrompt: vi.fn(),
}));

vi.mock("@/lib/acp", () => ({
  getTabSession: () => ({ sendPrompt: mockSendPrompt }),
}));
vi.mock("@/lib/ensureAcpForSend", () => ({
  ensureAcpForSend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/sessionEmpty", () => ({ shouldShowHomeComposer: () => false }));
vi.mock("@/hooks/useExternallyActiveSession", () => ({
  useExternallyActiveSession: () => false,
}));
vi.mock("@/hooks/useCancelThreadOnEscape", () => ({
  useCancelThreadOnEscape: () => undefined,
}));
vi.mock("@/hooks/useComposerAccessModeCycle", () => ({
  useComposerAccessModeCycle: () => ({ handleAccessModeKeyDown: vi.fn() }),
}));
vi.mock("@/hooks/useComposerModelCycle", () => ({
  useComposerModelCycle: () => ({ handleModelKeyDown: vi.fn() }),
}));
vi.mock("@/hooks/useComposerAttachments", () => ({
  useComposerAttachments: () => ({
    attachments: [],
    atLimit: false,
    fileInputRef: { current: null },
    handlePaste: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    openFilePicker: vi.fn(),
    handleFileInputChange: vi.fn(),
  }),
}));
vi.mock("@/hooks/useSlashCommands", () => ({
  useSlashCommands: () => ({
    handleKeyDown: () => false,
    menuOpen: false,
    filtered: [],
    activeIndex: 0,
    connecting: false,
    loadingCommands: false,
    applyEntry: vi.fn(),
  }),
}));
vi.mock("@/hooks/usePromptHistory", () => ({
  usePromptHistory: () => ({
    handleKeyDown: () => false,
    commitPrompt: vi.fn(),
  }),
}));
vi.mock("./AccessModePill", () => ({ AccessModePill: () => null }));
vi.mock("./ModelSelector", () => ({ ModelSelector: () => null }));
vi.mock("./UsageBar", () => ({ UsageBar: () => null }));
vi.mock("./SlashCommandPicker", () => ({ SlashCommandPicker: () => null }));
vi.mock("./ComposerAttachmentStrip", () => ({
  ComposerAttachmentStrip: () => null,
  ComposerFileInput: () => null,
}));
vi.mock("./ComposerTextarea", () => ({
  ComposerTextarea: () => <textarea aria-label="Prompt" />,
}));

describe("Composer", () => {
  beforeEach(() => {
    mockSendPrompt.mockReset().mockResolvedValue(undefined);
    useWorkspaceStore.setState({
      projects: [{ id: "p1", cwd: "C:\\repo", name: "repo" }],
      sessions: [{
        id: "s1",
        projectId: "p1",
        title: "Session",
        grokSessionId: "grok-1",
        status: "idle",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      }],
      activeSessionId: "s1",
      activeProjectId: "p1",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("submits /compact from the compact conversation button", async () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("button", { name: "Compact conversation" }));

    await waitFor(() =>
      expect(mockSendPrompt).toHaveBeenCalledWith("/compact", expect.anything()),
    );
  });
});
