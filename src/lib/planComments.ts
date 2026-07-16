import { interjectActiveTurn } from "@/lib/acp/xaiQueue";

export interface PlanComment {
  id: string;
  line: number;
  text: string;
}

export function formatPlanComments(comments: PlanComment[]): string {
  return [...comments]
    .filter((comment) => comment.text.trim())
    .sort((a, b) => a.line - b.line || a.id.localeCompare(b.id))
    .map((comment) => `Line ${comment.line}: ${comment.text.trim()}`)
    .join("\n");
}

export async function sendApprovedPlanComments(
  sessionId: string,
  comments: PlanComment[],
): Promise<void> {
  const text = formatPlanComments(comments);
  if (!text) return;
  if (!(await interjectActiveTurn(sessionId, text))) {
    throw new Error("Grok does not support plan comment interjection");
  }
}
