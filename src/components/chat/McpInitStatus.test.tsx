// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useMcpStore } from "@/stores/mcpStore";
import { McpInitStatus } from "./McpInitStatus";

describe("McpInitStatus", () => {
  beforeEach(() => useMcpStore.setState({ serversByTab: {}, initializationByTab: {} }));
  afterEach(cleanup);

  it("hides when no servers are initializing", () => {
    const { container } = render(<McpInitStatus tabId="tabA" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders running progress", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: { phase: "running", total: 4, connected: 2, failures: {} },
      },
    });
    render(<McpInitStatus tabId="tabA" />);
    expect(screen.getByRole("status")).toHaveTextContent("Starting MCP servers 2/4…");
  });

  it("hides completed initialization when every server succeeded", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: { phase: "complete", total: 4, connected: 4, failures: {} },
      },
    });

    const { container } = render(<McpInitStatus tabId="tabA" />);

    expect(container.firstChild).toBeNull();
  });

  it("renders one failed server name", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: {
          phase: "complete",
          total: 4,
          connected: 3,
          failures: { github: "unavailable" },
        },
      },
    });

    render(<McpInitStatus tabId="tabA" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 MCP server failed: github",
    );
  });

  it("renders the failed count and server names", () => {
    useMcpStore.setState({
      serversByTab: {},
      initializationByTab: {
        tabA: {
          phase: "complete",
          total: 4,
          connected: 2,
          failures: { github: "unavailable", atlassian: "needsauth" },
        },
      },
    });
    render(<McpInitStatus tabId="tabA" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 MCP servers failed: github, atlassian",
    );
  });
});
