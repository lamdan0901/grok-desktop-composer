import { describe, expect, it, vi } from "vitest";
import { handleReverseExtMethod, methodNotFound } from "./reverseExtMethod";
import { useQuestionStore } from "@/stores/questionStore";
import { usePlanReviewStore } from "@/stores/planReviewStore";
import { useFolderTrustStore } from "@/stores/folderTrustStore";

describe("handleReverseExtMethod", () => {
  it("returns method_not_found for an unknown method", async () => {
    await expect(
      handleReverseExtMethod("s1", "x.ai/does_not_exist", {}),
    ).rejects.toMatchObject({ code: -32601 });
  });

  it("returns method_not_found for mcp/sdk_call (no SDK server registered)", async () => {
    await expect(
      handleReverseExtMethod("s1", "x.ai/mcp/sdk_call", { tool: "x" }),
    ).rejects.toMatchObject({ code: -32601 });
  });

  it("routes ask_user_question to the question store and resolves with the choice", async () => {
    const params = {
      sessionId: "s1",
      toolCallId: "tc1",
      mode: "default",
      questions: [{ question: "Pick?", options: [{ label: "A", description: "" }] }],
    };
    const promise = handleReverseExtMethod("s1", "x.ai/ask_user_question", params);
    await vi.waitFor(() =>
      expect(useQuestionStore.getState().pendingBySession["s1"]).toBeTruthy(),
    );
    useQuestionStore.getState().respond("s1", {
      outcome: "accepted",
      answers: { "Pick?": ["A"] },
    });
    await expect(promise).resolves.toEqual({
      outcome: "accepted",
      answers: { "Pick?": ["A"] },
    });
  });

  it("methodNotFound throws a -32601 error", () => {
    expect(() => methodNotFound("x")).toThrowError();
  });

  it("settles a pending question as cancelled on cancelSession (dispose path)", async () => {
    const promise = handleReverseExtMethod("dispose-q", "x.ai/ask_user_question", {
      sessionId: "dispose-q",
      toolCallId: "tc",
      mode: "default",
      questions: [{ question: "Q?", options: [{ label: "A", description: "" }] }],
    });
    await vi.waitFor(() =>
      expect(useQuestionStore.getState().pendingBySession["dispose-q"]).toBeTruthy(),
    );
    useQuestionStore.getState().cancelSession("dispose-q");
    await expect(promise).resolves.toEqual({ outcome: "cancelled" });
  });

  it("settles a pending plan review as abandoned on cancelSession (dispose path)", async () => {
    const promise = handleReverseExtMethod("dispose-p", "x.ai/exit_plan_mode", {
      sessionId: "dispose-p",
      toolCallId: "tc",
      planContent: "do the thing",
    });
    await vi.waitFor(() =>
      expect(usePlanReviewStore.getState().pendingBySession["dispose-p"]).toBeTruthy(),
    );
    usePlanReviewStore.getState().cancelSession("dispose-p");
    await expect(promise).resolves.toEqual({ outcome: "abandoned" });
  });

  it("blocks on folder trust and resolves with an explicit outcome", async () => {
    const promise = handleReverseExtMethod("trust-1", "x.ai/folder_trust/request", {
      folder: "C:\\repo",
      reason: "project hooks",
    });
    await vi.waitFor(() => expect(useFolderTrustStore.getState().pendingBySession["trust-1"]).toBeTruthy());
    expect(useFolderTrustStore.getState().respond("trust-1", true)).toEqual({ outcome: "approved" });
    await expect(promise).resolves.toEqual({ outcome: "approved" });
  });
});
