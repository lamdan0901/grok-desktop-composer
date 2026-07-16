// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { HomeView } from "./HomeView";

vi.mock("@/lib/acp", () => ({}));
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
});
