import type { ToolCallUpdate } from "@agentclientprotocol/sdk";
import { describe, expect, it } from "vitest";
import {
  extractFileDiffFromToolUpdate,
  hasFileDiffContent,
  isFileDiffTool,
  mergeFileDiffSources,
  resolveFileDiffMetadata,
} from "./fileDiff";

describe("isFileDiffTool", () => {
  it("matches write and edit tools", () => {
    expect(isFileDiffTool("Write")).toBe(true);
    expect(isFileDiffTool("StrReplace")).toBe(true);
    expect(isFileDiffTool("Read")).toBe(false);
    expect(isFileDiffTool("Glob", "search")).toBe(false);
    expect(isFileDiffTool("Tool", "edit")).toBe(true);
  });
});

describe("extractFileDiffFromToolUpdate", () => {
  it("parses ACP diff content blocks", () => {
    const source = extractFileDiffFromToolUpdate({
      toolCallId: "t1",
      locations: [{ path: "/proj/a.ts" }],
      content: [
        {
          type: "diff",
          path: "/proj/a.ts",
          oldText: "old\n",
          newText: "new\n",
        },
      ],
    });
    expect(source).toEqual({
      file: "/proj/a.ts",
      before: "old\n",
      after: "new\n",
    });
  });

  it("parses StrReplace without variant", () => {
    const source = extractFileDiffFromToolUpdate({
      toolCallId: "t3",
      locations: [{ path: "c.ts" }],
      rawInput: {
        path: "c.ts",
        old_string: "foo",
        new_string: "bar",
      },
    });
    expect(source).toEqual({
      file: "c.ts",
      before: "foo",
      after: "bar",
    });
  });

  it("parses Edit title and nested diff content", () => {
    const source = extractFileDiffFromToolUpdate({
      toolCallId: "t-edit",
      kind: "edit",
      title: "Edit `C:\\proj\\src\\a.ts`",
      content: [
        {
          type: "content",
          content: {
            type: "diff",
            path: "C:\\proj\\src\\a.ts",
            oldText: "a",
            newText: "b",
          },
        },
      ] as unknown as ToolCallUpdate["content"],
    });
    expect(source).toEqual({
      file: "C:\\proj\\src\\a.ts",
      before: "a",
      after: "b",
    });
  });

  it("parses CursorWrite rawInput", () => {
    const source = extractFileDiffFromToolUpdate({
      toolCallId: "t2",
      locations: [{ path: "b.ts" }],
      rawInput: { variant: "CursorWrite", contents: "full file" },
    });
    expect(source).toEqual({
      file: "b.ts",
      before: "",
      after: "full file",
    });
  });
});

describe("mergeFileDiffSources", () => {
  it("prefers newer after text while keeping before", () => {
    const merged = mergeFileDiffSources(
      { file: "a.ts", before: "a", after: "b" },
      { file: "a.ts", after: "c" },
    );
    expect(merged).toEqual({ file: "a.ts", before: "a", after: "c" });
  });

  it("keeps new-file diff when completed update repeats the same text", () => {
    const initial = {
      file: "test.txt",
      before: "",
      after: "hello\n",
    };
    const merged = mergeFileDiffSources(initial, {
      file: "test.txt",
      before: "hello\n",
      after: "hello\n",
    });
    expect(merged).toEqual(initial);
  });
});

describe("hasFileDiffContent", () => {
  it("returns false for identical before and after", () => {
    expect(
      hasFileDiffContent({ file: "a.ts", before: "x", after: "x" }),
    ).toBe(false);
  });

  it("returns true for new file content", () => {
    expect(
      hasFileDiffContent({ file: "a.ts", before: "", after: "new" }),
    ).toBe(true);
  });
});

describe("new file Write flow", () => {
  it("parses initial Write then ignores identical completed diff block", () => {
    const path = "C:\\proj\\new.txt";
    const content = "brand new file\n";
    const fromCall = extractFileDiffFromToolUpdate({
      toolCallId: "c1",
      title: "Write",
      rawInput: { path, contents: content },
    });
    expect(fromCall).toEqual({ file: path, before: "", after: content });

    const fromCompleted = extractFileDiffFromToolUpdate({
      toolCallId: "c1",
      kind: "edit",
      title: `Edit \`${path}\``,
      locations: [{ path }],
      content: [
        { type: "diff", path, oldText: content, newText: content },
      ] as unknown as ToolCallUpdate["content"],
    });
    expect(fromCompleted).toBeNull();

    const merged = mergeFileDiffSources(fromCall!, {
      file: path,
      before: content,
      after: content,
    });
    expect(merged).toEqual(fromCall);
    expect(hasFileDiffContent(merged)).toBe(true);
  });
});

describe("resolveFileDiffMetadata", () => {
  it("produces hunks for before/after", () => {
    const meta = resolveFileDiffMetadata({
      file: "x.ts",
      before: "line1\n",
      after: "line2\n",
    });
    expect(meta.name).toBe("x.ts");
    expect(meta.hunks.length).toBeGreaterThan(0);
    expect(meta.additionLines.join("")).toContain("line2");
  });

  it("clears no-EOF markers so the viewer skips newline warnings", () => {
    const meta = resolveFileDiffMetadata({
      file: "new.txt",
      before: "",
      after: "no trailing newline",
    });
    for (const hunk of meta.hunks) {
      expect(hunk.noEOFCRDeletions).toBe(false);
      expect(hunk.noEOFCRAdditions).toBe(false);
    }
  });
});