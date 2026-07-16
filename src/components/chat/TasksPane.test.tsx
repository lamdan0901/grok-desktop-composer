// @vitest-environment jsdom
import { afterEach, describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TasksPane } from "./TasksPane";
import { useTaskStore } from "@/stores/taskStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

// listTasks probes grok on mount; stub it so the pane does not hit a real session.
vi.mock("@/lib/acp/xaiTask", () => ({
  listTasks: vi.fn().mockResolvedValue(true),
  killTask: vi.fn(),
  deleteScheduledTask: vi.fn(),
}));

describe("TasksPane", () => {
  beforeEach(() => {
    useTaskStore.setState({ tasksByTab: {}, scheduledByTab: {} });
    useWorkspaceStore.setState({ activeSessionId: "s1", sessions: [] } as never);
  });
  afterEach(() => cleanup());

  it("renders nothing when there are no tasks", () => {
    const { container } = render(<TasksPane />);
    expect(container.firstChild).toBeNull();
  });

  it("lists background tasks and scheduled tasks", () => {
    useTaskStore.setState({
      tasksByTab: { s1: [{ taskId: "t1", command: "npm run dev", kind: "task", status: "running" }] },
      scheduledByTab: { s1: [{ taskId: "sc1", prompt: "loop", humanSchedule: "every 5m" }] },
    });
    render(<TasksPane />);
    expect(screen.getByText("npm run dev")).toBeTruthy();
    expect(screen.getByText(/every 5m/)).toBeTruthy();
  });

  it("lists real subagent nodes and exposes task output", () => {
    useWorkspaceStore.setState({
      activeSessionId: "s1",
      sessions: [{ id: "s1", agentNodes: [{ id: "a1", title: "Explore", status: "running" }] }],
    } as never);
    useTaskStore.setState({
      tasksByTab: {
        s1: [
          {
            taskId: "t1",
            command: "npm run dev",
            outputFile: "/tmp/t1.log",
            kind: "task",
            status: "running",
          },
        ],
      },
    });
    render(<TasksPane />);
    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.getByTitle("Open task output")).toBeTruthy();
  });
});
