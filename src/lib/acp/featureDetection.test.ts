import { describe, expect, it, vi } from "vitest";
import {
  callRequestFeature,
  markNotificationSeen,
  isNotificationFeatureSeen,
  clearFeatureCache,
} from "./featureDetection";
import { XAI } from "./xaiMethods";

describe("feature detection", () => {
  it("caches a successful request probe per child process", async () => {
    const call = vi.fn().mockResolvedValue({ servers: [] });
    const first = await callRequestFeature("tab1", XAI.mcpList, call);
    const second = await callRequestFeature("tab1", XAI.mcpList, call);
    expect(first).toEqual({ supported: true, value: { servers: [] } });
    expect(second.supported).toBe(true);
    expect(call).toHaveBeenCalledTimes(2); // support is cached; live data is not
  });

  it("treats method_not_found as unsupported and caches the negative", async () => {
    const call = vi.fn().mockRejectedValue({ code: -32601, message: "Method not found" });
    expect(await callRequestFeature("tab2", XAI.taskList, call)).toEqual({ supported: false });
    expect(await callRequestFeature("tab2", XAI.taskList, call)).toEqual({ supported: false });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("rethrows and does not cache transient errors", async () => {
    const call = vi.fn().mockRejectedValue({ code: -32603, message: "internal" });
    await expect(callRequestFeature("tab3", XAI.taskList, call)).rejects.toMatchObject({ code: -32603 });
    await expect(callRequestFeature("tab3", XAI.taskList, call)).rejects.toMatchObject({ code: -32603 });
    expect(call).toHaveBeenCalledTimes(2); // retried, not cached
  });

  it("tracks notification-feature signals separately", () => {
    expect(isNotificationFeatureSeen("tab4", "x.ai/queue/changed")).toBe(false);
    markNotificationSeen("tab4", "x.ai/queue/changed");
    expect(isNotificationFeatureSeen("tab4", "x.ai/queue/changed")).toBe(true);
  });

  it("clears the cache for a child process", async () => {
    const call = vi.fn().mockResolvedValue({});
    await callRequestFeature("tab5", XAI.taskList, call);
    clearFeatureCache("tab5");
    await callRequestFeature("tab5", XAI.taskList, call);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
