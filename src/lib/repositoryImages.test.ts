import { beforeEach, describe, expect, it, vi } from "vitest";
import { readProjectImage } from "@/lib/acpFs";
import {
  buildPromptContentBlocks,
  extractRepositoryImagePaths,
  isRepositoryImagePath,
} from "./repositoryImages";

vi.mock("@/lib/acpFs", () => ({ readProjectImage: vi.fn() }));

describe("repository image paths", () => {
  beforeEach(() => {
    vi.mocked(readProjectImage).mockReset();
  });

  it("extracts relative, absolute-in-project, @-selected, quoted, and nonexistent image paths", () => {
    const prompt = [
      "Read src/assets/logo.png,",
      "compare @assets/reference.webp",
      "with \"assets/my logo.svg\"",
      "and C:\\repo\\shots\\screen.JPG",
      "then missing/expected.gif",
    ].join(" ");

    expect(extractRepositoryImagePaths(prompt)).toEqual([
      "src/assets/logo.png",
      "assets/reference.webp",
      "assets/my logo.svg",
      "C:\\repo\\shots\\screen.JPG",
      "missing/expected.gif",
    ]);
  });

  it("ignores normal text and non-image paths and deduplicates exact paths", () => {
    expect(
      extractRepositoryImagePaths(
        "Read src/main.ts and README.md; use icon.png twice: icon.png",
      ),
    ).toEqual(["icon.png"]);
    expect(isRepositoryImagePath("@assets/photo.JPEG")).toBe(true);
    expect(isRepositoryImagePath("src/main.ts")).toBe(false);
  });

  it("builds one text block followed by clipboard and repository image blocks", async () => {
    vi.mocked(readProjectImage)
      .mockResolvedValueOnce({ mimeType: "image/png", data: "repo-one" })
      .mockResolvedValueOnce({ mimeType: "image/svg+xml", data: "repo-two" });

    await expect(
      buildPromptContentBlocks(
        "Compare assets/one.png with \"assets/two.svg\"",
        [{ mimeType: "image/webp", data: "clipboard" }],
        "C:\\repo",
      ),
    ).resolves.toEqual([
      { type: "text", text: "Compare assets/one.png with \"assets/two.svg\"" },
      { type: "image", mimeType: "image/webp", data: "clipboard" },
      { type: "image", mimeType: "image/png", data: "repo-one" },
      { type: "image", mimeType: "image/svg+xml", data: "repo-two" },
    ]);
    expect(readProjectImage).toHaveBeenNthCalledWith(
      1,
      "C:\\repo",
      "assets/one.png",
    );
    expect(readProjectImage).toHaveBeenNthCalledWith(
      2,
      "C:\\repo",
      "assets/two.svg",
    );
  });

  it("rejects the whole prompt when any referenced image cannot be loaded", async () => {
    vi.mocked(readProjectImage)
      .mockResolvedValueOnce({ mimeType: "image/png", data: "first" })
      .mockRejectedValueOnce(new Error("Failed to read image \"missing.png\""));

    await expect(
      buildPromptContentBlocks(
        "Compare first.png and missing.png",
        [],
        "C:\\repo",
      ),
    ).rejects.toThrow("Failed to read image \"missing.png\"");
  });
});
