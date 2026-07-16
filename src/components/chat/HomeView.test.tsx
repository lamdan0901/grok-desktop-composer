// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { HomeView } from "./HomeView";

const mocks = vi.hoisted(() => ({
  buildPromptContentBlocks: vi.fn(),
  sendPrompt: vi.fn(),
}));

vi.mock("@/lib/acp", () => ({
  getTabSession: () => ({ sendPrompt: mocks.sendPrompt }),
}));
vi.mock("@/lib/ensureAcpForSend", () => ({
  ensureAcpForSend: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/repositoryImages", () => ({
  buildPromptContentBlocks: mocks.buildPromptContentBlocks,
}));
vi.mock("@/hooks/useCancelThreadOnEscape", () => ({ useCancelThreadOnEscape: () => undefined }));
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
  usePromptHistory: () => ({ handleKeyDown: () => false, commitPrompt: vi.fn() }),
}));
vi.mock("@/lib/acpFs", () => ({
  listProjectFiles: vi.fn().mockResolvedValue([
    { path: "src/App.tsx", isDir: false },
  ]),
}));
vi.mock("./AccessModePill", () => ({ AccessModePill: () => null }));
vi.mock("./ModelSelectorDropdown", () => ({ ModelSelectorDropdown: () => null }));
vi.mock("./SlashCommandPicker", () => ({ SlashCommandPicker: () => null }));
vi.mock("./ComposerAttachmentStrip", () => ({
  ComposerAttachmentStrip: () => null,
  ComposerFileInput: () => null,
}));
vi.mock("./ProjectPickerDropdown", () => ({
  ProjectPickerDropdown: () => null,
  useRecordProjectOnAdd: () => vi.fn(),
}));
vi.mock("./FileMentionPicker", () => ({
  FileMentionPicker: ({ open }: { open: boolean }) =>
    open ? <div role="listbox" aria-label="File mentions" /> : null,
}));

describe("HomeView", () => {
  beforeEach(() => {
    mocks.buildPromptContentBlocks.mockReset();
    mocks.sendPrompt.mockReset();
    useWorkspaceStore.setState({
      projects: [{ id: "p1", cwd: "C:\\repo", name: "repo" }],
      sessions: [{
        id: "s1",
        projectId: "p1",
        title: "New thread",
        status: "idle",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      }],
      activeSessionId: "s1",
      activeProjectId: "p1",
    });
  });

  afterEach(cleanup);

  it("opens file mentions after typing @ in the home composer", async () => {
    render(<HomeView />);
    const input = screen.getByPlaceholderText("Do anything") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "@" } });
    await waitFor(() =>
      expect(screen.getByRole("listbox", { name: "File mentions" })).toBeTruthy(),
    );
  });

  it("builds the home prompt with the selected project before sending", async () => {
    const blocks = [
      { type: "text", text: "Read assets/example.png" },
      { type: "image", mimeType: "image/png", data: "AAEC" },
    ];
    mocks.buildPromptContentBlocks.mockResolvedValueOnce(blocks);
    render(<HomeView />);
    const input = screen.getByPlaceholderText("Do anything");

    fireEvent.change(input, { target: { value: "Read assets/example.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.sendPrompt).toHaveBeenCalledWith(
      "Read assets/example.png",
      blocks,
    ));
    expect(mocks.buildPromptContentBlocks).toHaveBeenCalledWith(
      "Read assets/example.png",
      [],
      "C:\\repo",
    );
  });

  it("retains home composer state until repository images finish loading", async () => {
    let resolveBlocks: (blocks: unknown[]) => void = () => undefined;
    mocks.buildPromptContentBlocks.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveBlocks = resolve;
      }),
    );
    const addUserMessage = vi.fn(useWorkspaceStore.getState().addUserMessage);
    useWorkspaceStore.setState({ addUserMessage });

    render(<HomeView />);
    const input = screen.getByPlaceholderText("Do anything") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Read assets/example.png" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(mocks.buildPromptContentBlocks).toHaveBeenCalledWith(
      "Read assets/example.png",
      [],
      "C:\\repo",
    ));
    expect(input.value).toBe("Read assets/example.png");
    expect(mocks.sendPrompt).not.toHaveBeenCalled();
    expect(addUserMessage).not.toHaveBeenCalled();

    resolveBlocks([
      { type: "text", text: "Read assets/example.png" },
    ]);
    await waitFor(() => expect(mocks.sendPrompt).toHaveBeenCalled());
    expect(addUserMessage).toHaveBeenCalledWith("s1", "Read assets/example.png", []);
  });
});
