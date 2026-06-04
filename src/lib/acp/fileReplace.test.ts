import { describe, expect, it } from "vitest";
import {
  applyStrReplaceToContent,
  convertToLineEnding,
  detectLineEnding,
  looksAlreadyApplied,
  replaceInContent,
} from "./fileReplace";

describe("replaceInContent (opencode-style)", () => {
  it("replaces an exact substring", () => {
    const content = "alpha\nbeta\ngamma\n";
    expect(replaceInContent(content, "beta", "BETA")).toBe("alpha\nBETA\ngamma\n");
  });

  it("matches with line-trimmed whitespace differences", () => {
    const content = "  .foo {\n    color: red;\n  }\n";
    const oldString = ".foo {\n  color: red;\n}";
    expect(replaceInContent(content, oldString, ".foo {\n  color: blue;\n}")).toContain("color: blue");
  });

  it("normalizes CRLF in search strings to file line endings", () => {
    const content = "line1\r\nline2\r\n";
    const result = applyStrReplaceToContent(content, "line1\nline2", "done");
    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.content).toBe("done\r\n");
    }
  });

  it("errors on multiple exact matches without replaceAll", () => {
    expect(() => replaceInContent("foo\nfoo\n", "foo", "bar")).toThrow(/multiple matches/i);
  });

  it("replaces all occurrences when replaceAll is true", () => {
    expect(replaceInContent("foo\nfoo\n", "foo", "bar", true)).toBe("bar\nbar\n");
  });

  it("errors when oldString is not found", () => {
    expect(() => replaceInContent("hello", "missing", "x")).toThrow(/could not find/i);
  });
});

describe("applyStrReplaceToContent", () => {
  it("returns noop when edit was already applied (double-apply safe)", () => {
    const file = ".message__bubble {\n  border-radius: var(--radius-md);\n  line-height: 1.55;\n}\n";
    const oldString = ".message__bubble {\n  max-width: 85%;\n  border-radius: var(--radius-md);";
    const newString = ".message__bubble {\n  border-radius: var(--radius-md);";
    expect(looksAlreadyApplied(file, oldString, newString)).toBe(true);
    const result = applyStrReplaceToContent(file, oldString, newString);
    expect(result).toEqual({ status: "noop", reason: "already_applied" });
  });

  it("never treats new_string alone as the full file on failure", () => {
    const bigFile = ":root {\n  --accent: green;\n}\n\n".repeat(100);
    const result = applyStrReplaceToContent(bigFile, "not-in-file", "tiny");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/could not find/i);
    }
  });

  it("rejects identical old and new strings", () => {
    const result = applyStrReplaceToContent("abc", "abc", "abc");
    expect(result.status).toBe("error");
  });

  it("rejects empty oldString", () => {
    const result = applyStrReplaceToContent("abc", "", "xyz");
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/must not be empty/i);
    }
  });
});

describe("line ending helpers", () => {
  it("detects CRLF", () => {
    expect(detectLineEnding("a\r\nb")).toBe("\r\n");
  });

  it("converts search text to CRLF when file uses CRLF", () => {
    expect(convertToLineEnding("a\nb", "\r\n")).toBe("a\r\nb");
  });
});