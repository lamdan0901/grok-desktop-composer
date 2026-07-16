// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ExtensionsModal } from "./ExtensionsModal";
import { useExtensionsStore } from "@/stores/extensionsStore";

describe("ExtensionsModal", () => {
  beforeEach(() => {
    cleanup();
    useExtensionsStore.setState({ open: true, activeTab: "skills" });
  });

  it("renders all five tabs and starts on Skills", () => {
    render(<ExtensionsModal />);
    expect(screen.getByRole("tab", { name: "Skills" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Hooks" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Plugins" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Marketplace" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "MCP" })).toBeTruthy();
  });

  it("reuses the existing MCP panel instead of duplicating it", async () => {
    render(<ExtensionsModal />);
    fireEvent.click(screen.getByRole("tab", { name: "MCP" }));
    expect(await screen.findByRole("region", { name: "MCP servers" })).toBeTruthy();
  });

  it("marks plugins and marketplace as unavailable", () => {
    render(<ExtensionsModal />);
    fireEvent.click(screen.getByRole("tab", { name: "Plugins" }));
    expect(screen.getByText(/not available yet/i)).toBeTruthy();
  });
});
