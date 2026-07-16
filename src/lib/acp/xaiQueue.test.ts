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
import { interjectActiveTurn, removeQueuedPrompt } from "./xaiQueue";

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
    await interjectActiveTurn("tab-1", "Do this now");

    expect(extNotification).toHaveBeenCalledWith("x.ai/queue/remove", {
      queueId: "q1",
    });
    expect(extMethod).toHaveBeenCalledWith("x.ai/interject", {
      sessionId: "grok-1",
      text: "Do this now",
    });
  });
});
