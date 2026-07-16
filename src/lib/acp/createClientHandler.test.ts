import { beforeEach, describe, expect, it, vi } from "vitest";
import { acpReadTextFile } from "@/lib/acpFs";
import { createClientHandler } from "./createClientHandler";

vi.mock("@/lib/acpFs", () => ({
  acpReadTextFile: vi.fn(),
  acpWriteTextFile: vi.fn(),
}));

describe("createClientHandler readTextFile", () => {
  beforeEach(() => {
    vi.mocked(acpReadTextFile).mockReset();
  });

  it("short-circuits image paths without invoking the text command", async () => {
    const client = createClientHandler("tab-1");

    await expect(client.readTextFile!({
      sessionId: "grok-1",
      path: "assets/example.PNG",
    })).resolves.toEqual({
      content: "Image already attached in the prompt; do not read it as text.",
    });
    expect(acpReadTextFile).not.toHaveBeenCalled();
  });

  it("keeps normal text reads unchanged", async () => {
    vi.mocked(acpReadTextFile).mockResolvedValueOnce("hello");
    const client = createClientHandler("tab-1");
    const params = { sessionId: "grok-1", path: "README.md" };

    await expect(client.readTextFile!(params)).resolves.toEqual({ content: "hello" });
    expect(acpReadTextFile).toHaveBeenCalledWith("tab-1", params);
  });
});
