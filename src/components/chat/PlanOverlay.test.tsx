// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@/lib/acp";
import { clearFeatureCache } from "@/lib/acp/featureDetection";
import { usePlanReviewStore } from "@/stores/planReviewStore";
import { usePlanStore } from "@/stores/planStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { PlanOverlay } from "./PlanOverlay";

describe("PlanOverlay line comments", () => {
  beforeEach(() => {
    clearFeatureCache("s1");
    useWorkspaceStore.setState({
      projects: [{ id: "p1", cwd: "C:\\repo", name: "repo" }],
      sessions: [{
        id: "s1",
        projectId: "p1",
        title: "Plan",
        grokSessionId: "grok-1",
        status: "plan_review",
        messages: [],
        acpState: "ready",
        agentNodes: [],
      }],
      activeSessionId: "s1",
      activeProjectId: "p1",
    });
    usePlanStore.setState({
      bySession: {
        s1: { path: null, content: "First line\nSecond line", loading: false, error: null },
      },
    });
    usePlanReviewStore.setState({ pendingBySession: {}, commentsBySession: {} } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function addSecondLineComment() {
    fireEvent.click(screen.getByRole("button", { name: "Add comment to line 2" }));
    fireEvent.change(screen.getByLabelText("Comment for line 2"), {
      target: { value: "Use the shared helper." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save line comment" }));
  }

  it("returns line comments as cancelled feedback without changing the response shape", async () => {
    const response = usePlanReviewStore.getState().requestReview("s1", {
      sessionId: "grok-1",
      toolCallId: "tool-1",
    });
    render(<PlanOverlay />);
    await addSecondLineComment();

    fireEvent.click(screen.getByText("Revise plan"));

    await expect(response).resolves.toEqual({
      outcome: "cancelled",
      feedback: "Line 2: Use the shared helper.",
    });
  });

  it("approves first then sends comments through x.ai/interject", async () => {
    const extMethod = vi.fn().mockResolvedValue({});
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extMethod,
    } as unknown as acp.TabAcpSession);
    const response = usePlanReviewStore.getState().requestReview("s1", {
      sessionId: "grok-1",
      toolCallId: "tool-1",
    });
    render(<PlanOverlay />);
    await addSecondLineComment();

    fireEvent.click(screen.getByText("Approve & build"));

    await expect(response).resolves.toEqual({ outcome: "approved" });
    await waitFor(() =>
      expect(extMethod).toHaveBeenCalledWith("x.ai/interject", {
        sessionId: "grok-1",
        text: "Line 2: Use the shared helper.",
      }),
    );
  });
});
