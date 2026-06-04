import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { escapeBlocksThreadCancel } from "./useCancelThreadOnEscape";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUsageStore } from "@/stores/usageStore";

describe("escapeBlocksThreadCancel", () => {
  beforeEach(() => {
    useSettingsStore.setState({ settingsOpen: false });
    useUsageStore.setState({ overlayOpen: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks when settings overlay is open", () => {
    useSettingsStore.setState({ settingsOpen: true });
    expect(escapeBlocksThreadCancel()).toBe(true);
  });

  it("blocks when usage overlay is open", () => {
    useUsageStore.setState({ overlayOpen: true });
    expect(escapeBlocksThreadCancel()).toBe(true);
  });

  it("blocks when a portal dropdown is open", () => {
    vi.stubGlobal("document", {
      querySelector: (sel: string) =>
        sel === ".ui-dropdown--portal" ? {} : null,
    });
    expect(escapeBlocksThreadCancel()).toBe(true);
  });

  it("blocks when slash command picker is in the DOM", () => {
    vi.stubGlobal("document", {
      querySelector: (sel: string) =>
        sel === ".slash-command-picker" ? {} : null,
    });
    expect(escapeBlocksThreadCancel()).toBe(true);
  });

  it("allows cancel when no overlay or menu is open", () => {
    expect(escapeBlocksThreadCancel()).toBe(false);
  });
});