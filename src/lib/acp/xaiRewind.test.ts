import { beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@/lib/acp";
import { clearFeatureCache } from "./featureDetection";
import { executeRewind, normalizeRewindPoints } from "./xaiRewind";

describe("rewind protocol", () => {
  beforeEach(() => {
    clearFeatureCache("tab-1");
    vi.restoreAllMocks();
  });

  it("normalizes point ids, labels, timestamps, and file counts", () => {
    expect(
      normalizeRewindPoints({
        points: [
          {
            id: "p1",
            label: "Before edit",
            timestamp: "2026-07-16T10:00:00Z",
            fileCount: 2,
          },
        ],
      }),
    ).toEqual([
      {
        id: "p1",
        label: "Before edit",
        timestamp: "2026-07-16T10:00:00Z",
        fileCount: 2,
      },
    ]);
  });

  it("returns false when execute is explicitly unsupported", async () => {
    vi.spyOn(acp, "getTabSession").mockReturnValue({
      grokSessionId: "grok-1",
    } as unknown as acp.TabAcpSession);
    const extMethod = vi.fn().mockRejectedValue({ code: -32601 });

    await expect(executeRewind("tab-1", "p1", extMethod)).resolves.toBe(false);
  });
});
