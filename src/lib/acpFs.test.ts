import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { readProjectImage } from "./acpFs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@/lib/acp/tabSession", () => ({ getTabBoundCwd: vi.fn() }));

describe("readProjectImage", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("returns the Tauri MIME and base64 payload unchanged", async () => {
    vi.mocked(invoke).mockResolvedValue({ mimeType: "image/png", data: "AAEC" });

    await expect(readProjectImage("C:\\repo", "assets/example.png")).resolves.toEqual({
      mimeType: "image/png",
      data: "AAEC",
    });
    expect(invoke).toHaveBeenCalledWith("read_project_image", {
      root: "C:\\repo",
      path: "assets/example.png",
    });
  });
});
