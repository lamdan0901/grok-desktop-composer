import { describe, expect, it } from "vitest";
import {
  entriesFromAvailableCommands,
  formatSlashCommandDescription,
  fuzzyFilterSlashCommands,
  fuzzyScore,
  parseSlashInput,
  resolveCanonicalSlashName,
} from "./slashCommands";
import type { AvailableCommand } from "@agentclientprotocol/sdk";

const sampleCommands: AvailableCommand[] = [
  {
    name: "session-info",
    description: "Show session details",
    input: null,
  },
  {
    name: "compact",
    description: "Compress conversation history",
    input: { hint: "optional context" },
  },
  {
    name: "help",
    description: "Grok docs",
    input: null,
    _meta: { scope: "user" },
  },
];

describe("resolveCanonicalSlashName", () => {
  it("maps aliases to canonical names", () => {
    expect(resolveCanonicalSlashName("status")).toBe("session-info");
    expect(resolveCanonicalSlashName("yolo")).toBe("always-approve");
  });

  it("returns lowercase canonical for unknown names", () => {
    expect(resolveCanonicalSlashName("Compact")).toBe("compact");
  });
});

describe("entriesFromAvailableCommands", () => {
  it("includes alias rows when canonical exists", () => {
    const entries = entriesFromAvailableCommands(sampleCommands);
    expect(entries.some((e) => e.displayName === "status" && e.isAlias)).toBe(
      true,
    );
    expect(
      entries.find((e) => e.displayName === "status")?.canonicalName,
    ).toBe("session-info");
  });
});

describe("parseSlashInput", () => {
  it("opens menu for slash prefix without space", () => {
    expect(parseSlashInput("/comp")).toEqual({ open: true, query: "comp" });
    expect(parseSlashInput("/")).toEqual({ open: true, query: "" });
  });

  it("closes menu after space", () => {
    expect(parseSlashInput("/compact keep")).toEqual({
      open: false,
      query: "",
    });
  });
});

describe("fuzzyFilterSlashCommands", () => {
  const entries = entriesFromAvailableCommands(sampleCommands);

  it("returns all entries for empty query", () => {
    expect(fuzzyFilterSlashCommands(entries, "")).toHaveLength(entries.length);
  });

  it("ranks session-info for stat query", () => {
    const filtered = fuzzyFilterSlashCommands(entries, "stat");
    expect(filtered[0]?.displayName).toBe("status");
  });

  it("matches description substrings", () => {
    const filtered = fuzzyFilterSlashCommands(entries, "compress");
    expect(filtered[0]?.canonicalName).toBe("compact");
  });
});

describe("formatSlashCommandDescription", () => {
  it("truncates long skill blurbs", () => {
    const long = "a ".repeat(80);
    expect(formatSlashCommandDescription(long).endsWith("…")).toBe(true);
    expect(formatSlashCommandDescription(long).length).toBeLessThanOrEqual(97);
  });
});

describe("fuzzyScore", () => {
  it("returns -1 when query chars are missing", () => {
    expect(fuzzyScore("zzz", "compact")).toBe(-1);
  });

  it("prefers prefix matches", () => {
    expect(fuzzyScore("com", "compact")).toBeGreaterThan(
      fuzzyScore("act", "compact"),
    );
  });
});