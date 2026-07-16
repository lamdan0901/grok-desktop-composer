import { describe, expect, it } from "vitest";
import {
  detectFileMention,
  filterFileMentions,
  replaceFileMention,
  type ProjectFileEntry,
} from "./fileMentions";

const files: ProjectFileEntry[] = [
  { path: "src/App.tsx", isDir: false },
  { path: "src/components/chat/Composer.tsx", isDir: false },
  { path: "src/components", isDir: true },
  { path: "README.md", isDir: false },
];

describe("file mentions", () => {
  it("detects the active @ token and ignores email addresses", () => {
    expect(detectFileMention("read @src/App.tsx", 17)).toMatchObject({
      range: { start: 5, end: 17 },
      query: "src/App.tsx",
    });
    expect(detectFileMention("user@example.com", 16)).toBeNull();
  });

  it("filters paths by fuzzy query and hides hidden entries by default", () => {
    expect(filterFileMentions(files, "comp").map((entry) => entry.path)).toEqual([
      "src/components",
      "src/components/chat/Composer.tsx",
    ]);
  });

  it("replaces only the mention token and leaves the rest of the prompt intact", () => {
    const context = detectFileMention("please inspect @src/App.tsx now", 26);
    expect(context).not.toBeNull();
    expect(replaceFileMention("please inspect @src/App.tsx now", context!, "src/main.ts")).toBe(
      "please inspect @src/main.ts now",
    );
  });
});
