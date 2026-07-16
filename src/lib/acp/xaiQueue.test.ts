import { beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@/lib/acp";
import {
  clearFeatureCache,
  markNotificationSeen,
} from "./featureDetection";
import {
  ingestQueueSnapshot,
  useQueueStore,
} from "@/stores/queueStore";
import { routeExtNotification } from "./extNotificationRouter";
import {
  clearQueuedPrompts,
  interjectActiveTurn,
  promoteQueuedPrompt,
  removeQueuedPrompt,
  reorderQueuedPrompt,
} from "./xaiQueue";

describe("prompt queue protocol", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
    useQueueStore.setState({ bySession: {} });
    vi.restoreAllMocks();
  });

  it("replaces stale queue entries from x.ai/queue/changed", () => {
    ingestQueueSnapshot("s1", { queue: [{ id: "q1", text: "old" }] });
    ingestQueueSnapshot("s1", { queue: [{ id: "q2", text: "new" }] });

    expect(useQueueStore.getState().bySession.s1).toEqual([
      { id: "q2", text: "new", position: 0, status: undefined },
    ]);
  });

  it("routes queue snapshots into the authoritative store", () => {
    expect(
      routeExtNotification("tab-1", "x.ai/queue/changed", {
        queue: [{ id: "q1", text: "queued" }],
      }),
    ).toBe(true);

    expect(useQueueStore.getState().bySession["tab-1"]).toEqual([
      { id: "q1", text: "queued", position: 0, status: undefined },
    ]);
  });

  it("uses a notification for queue mutation and a request for active interject", async () => {
    const extNotification = vi.fn().mockResolvedValue(undefined);
    const extMethod = vi.fn().mockResolvedValue({});
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
      extNotification,
      extMethod,
    } as unknown as acp.TabAcpSession);
    markNotificationSeen("tab-1", "x.ai/queue/changed");

    await removeQueuedPrompt("tab-1", "q1");
    await reorderQueuedPrompt("tab-1", "q1", 2);
    await clearQueuedPrompts("tab-1");
    await promoteQueuedPrompt("tab-1", "q1");
    await interjectActiveTurn("tab-1", "Do this now");

    expect(extNotification).toHaveBeenCalledWith("x.ai/queue/remove", {
      queueId: "q1",
    });
    expect(extNotification).toHaveBeenCalledWith("x.ai/queue/reorder", {
      queueId: "q1",
      position: 2,
    });
    expect(extNotification).toHaveBeenCalledWith("x.ai/queue/clear", {
      sessionId: "grok-1",
    });
    expect(extNotification).toHaveBeenCalledWith("x.ai/queue/interject", {
      queueId: "q1",
    });
    expect(extMethod).toHaveBeenCalledWith("x.ai/interject", {
      sessionId: "grok-1",
      text: "Do this now",
    });
  });
});
