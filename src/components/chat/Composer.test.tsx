// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Composer } from "./Composer";

const mocks = vi.hoisted(() => ({
  attachments: [] as Array<{
    id: string;
    name: string;
    mimeType: string;
    data: string;
    previewUrl: string;
  }>,
  buildPromptContentBlocks: vi.fn(),
  sendPrompt: vi.fn(),
  clear: vi.fn(),
}));

vi.mock("@/lib/acp", () => ({
  getTabSession: () => ({ sendPrompt: mocks.sendPrompt, cancelPrompt: vi.fn() }),
}));
vi.mock("@/lib/repositoryImages", () => ({
  buildPromptContentBlocks: mocks.buildPromptContentBlocks,
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
    attachments: mocks.attachments,
    atLimit: false,
    fileInputRef: { current: null },
    handlePaste: vi.fn(),
    remove: vi.fn(),
    clear: mocks.clear,
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
vi.mock("@/hooks/useFileMentions", () => ({
  useFileMentions: () => ({
    handleKeyDown: () => false,
    menuOpen: false,
    filtered: [],
    activeIndex: 0,
    applyEntry: vi.fn(),
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
  ComposerTextarea: ({
    disabled,
    value,
    onChange,
  }: {
    disabled?: boolean;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Prompt"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

describe("Composer", () => {
  beforeEach(() => {
    mocks.buildPromptContentBlocks.mockReset();
    mocks.sendPrompt.mockReset();
    mocks.clear.mockReset();
    mocks.attachments.length = 0;
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

  it("does not render a manual compact button", () => {
    render(<Composer />);

    expect(screen.queryByRole("button", { name: "Compact conversation" })).toBeNull();
  });

  it("uses the main composer input for interjection during an active turn", () => {
    useWorkspaceStore.setState((state) => ({
      sessions: state.sessions.map((session) => ({
        ...session,
        status: "running",
      })),
    }));

    render(<Composer />);

    expect(screen.queryByRole("textbox", { name: "Active turn interjection" })).toBeNull();
    expect(screen.getByRole("button", { name: "Interject active turn" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("keeps composer state and does not send when a repository image fails to load", async () => {
    const attachment = {
      id: "image-1",
      name: "attached.png",
      mimeType: "image/png",
      data: "AAEC",
      previewUrl: "data:image/png;base64,AAEC",
    };
    mocks.attachments.push(attachment);
    mocks.buildPromptContentBlocks.mockRejectedValueOnce(
      new Error('Failed to read image "missing.png"'),
    );
    render(<Composer />);
    const input = screen.getByRole("textbox", { name: "Prompt" }) as HTMLTextAreaElement;

    fireEvent.change(input, { target: { value: "Read missing.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.buildPromptContentBlocks).toHaveBeenCalledWith(
      "Read missing.png",
      [attachment],
      "C:\\repo",
    ));
    expect(input.value).toBe("Read missing.png");
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.sendPrompt).not.toHaveBeenCalled();
    expect(useWorkspaceStore.getState().sessions[0]!.messages).toEqual([
      expect.objectContaining({ role: "error", content: 'Failed to read image "missing.png"' }),
    ]);
  });
});
