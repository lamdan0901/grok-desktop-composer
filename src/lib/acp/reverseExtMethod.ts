import { XAI } from "./xaiMethods";
import type { SessionId } from "@/lib/types";
import { useQuestionStore, type AskQuestionRequest } from "@/stores/questionStore";
import { usePlanReviewStore, type ExitPlanModeRequest } from "@/stores/planReviewStore";
import { usePlanStore } from "@/stores/planStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** JSON-RPC method-not-found error (code -32601). Throw for unhandled reverse requests. */
export function methodNotFound(method: string): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw { code: -32601, message: `Method not found: ${method}` };
}

/**
 * Dispatch an agent->client reverse extension request. Returns the response
 * value (becomes the JSON-RPC result). Unhandled methods throw method_not_found
 * — never a silent no-op, since callers like x.ai/mcp/sdk_call block on it.
 */
export async function handleReverseExtMethod(
  sessionId: SessionId,
  method: string,
  params: unknown,
): Promise<unknown> {
  switch (method) {
    case XAI.askUserQuestion.method:
      return useQuestionStore
        .getState()
        .askQuestion(sessionId, params as AskQuestionRequest);

    case XAI.exitPlanMode.method: {
      const request = params as ExitPlanModeRequest;
      if (typeof request.planContent === "string" && request.planContent.trim()) {
        usePlanStore.getState().setPlan(sessionId, { content: request.planContent });
      }
      useWorkspaceStore.getState().setSessionStatus(sessionId, "plan_review");
      return usePlanReviewStore.getState().requestReview(sessionId, request);
    }

    // x.ai/mcp/sdk_call: no SDK MCP server is registered client-side. It is a
    // blocking reverse request, so it MUST return method_not_found — never a
    // silent no-op (the agent awaits a real response under timeout).
    default:
      return methodNotFound(method);
  }
}
