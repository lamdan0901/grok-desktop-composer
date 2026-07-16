import { getTabSession } from "@/lib/acp";
import { useRewindStore, type RewindPoint } from "@/stores/rewindStore";
import { callRequestFeature } from "./featureDetection";
import { XAI } from "./xaiMethods";

type Call = (method: string, params: Record<string, unknown>) => Promise<unknown>;

export function normalizeRewindPoints(value: unknown): RewindPoint[] {
  const points =
    value &&
    typeof value === "object" &&
    Array.isArray((value as { points?: unknown[] }).points)
      ? (value as { points: unknown[] }).points
      : [];

  return points.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const id =
      typeof item.id === "string"
        ? item.id
        : typeof item.pointId === "string"
          ? item.pointId
          : "";
    if (!id) return [];
    return [{
      id,
      label: String(item.label ?? item.description ?? id),
      timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined,
      fileCount: typeof item.fileCount === "number" ? item.fileCount : undefined,
    }];
  });
}

function grokSessionId(tabId: string): string {
  const id = getTabSession(tabId).grokSessionId;
  if (!id) throw new Error("No grok session bound to this tab");
  return id;
}

const callFor = (tabId: string): Call =>
  (method, params) => getTabSession(tabId).extMethod(method, params);

export async function listRewindPoints(tabId: string): Promise<RewindPoint[] | null> {
  const store = useRewindStore.getState();
  store.setLoading(tabId, true);
  store.setError(tabId, null);
  try {
    const result = await callRequestFeature(tabId, XAI.rewindPoints, () =>
      callFor(tabId)(XAI.rewindPoints.method, { sessionId: grokSessionId(tabId) }),
    );
    if (!result.supported) return null;
    const points = normalizeRewindPoints(result.value);
    useRewindStore.getState().setPoints(tabId, points);
    return points;
  } catch (error) {
    useRewindStore.getState().setError(
      tabId,
      error instanceof Error ? error.message : "Failed to load rewind points",
    );
    throw error;
  } finally {
    useRewindStore.getState().setLoading(tabId, false);
  }
}

export async function executeRewind(
  tabId: string,
  pointId: string,
  call: Call = callFor(tabId),
): Promise<boolean> {
  const result = await callRequestFeature(tabId, XAI.rewindExecute, () =>
    call(XAI.rewindExecute.method, {
      sessionId: grokSessionId(tabId),
      pointId,
    }),
  );
  if (!result.supported) return false;
  await listRewindPoints(tabId);
  return true;
}
