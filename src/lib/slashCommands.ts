import type { AvailableCommand } from "@agentclientprotocol/sdk";

/** Alias → canonical command name (Grok CLI docs). */
export const SLASH_COMMAND_ALIASES: Record<string, string> = {
  status: "session-info",
  info: "session-info",
  yolo: "always-approve",
};

export type SlashCommandScope = "builtin" | "skill" | "alias";

export type SlashCommandEntry = {
  /** Name shown in menu (may be an alias). */
  displayName: string;
  /** Canonical name sent to the agent. */
  canonicalName: string;
  description: string;
  inputHint: string | null;
  scope: SlashCommandScope;
  isAlias: boolean;
};

export type SlashInputState = {
  open: boolean;
  query: string;
};

/** Commands handled in the desktop UI instead of forwarding to the agent. */
export const LOCAL_SLASH_COMMANDS = new Set(["context", "session-info"]);

export function resolveCanonicalSlashName(name: string): string {
  const key = name.toLowerCase();
  return SLASH_COMMAND_ALIASES[key] ?? key;
}

export function commandScope(
  cmd: AvailableCommand,
): Exclude<SlashCommandScope, "alias"> {
  const scope = (cmd._meta as { scope?: string } | null | undefined)?.scope;
  return scope === "user" || scope === "local" ? "skill" : "builtin";
}

export function inputHint(cmd: AvailableCommand): string | null {
  const input = cmd.input as { hint?: string } | null | undefined;
  return input?.hint?.trim() || null;
}

const MENU_DESCRIPTION_MAX = 96;

/** Keep skill blurbs short so menu rows do not overlap in the picker. */
export function formatSlashCommandDescription(description: string): string {
  const oneLine = description.replace(/\s+/g, " ").trim();
  if (oneLine.length <= MENU_DESCRIPTION_MAX) return oneLine;
  return `${oneLine.slice(0, MENU_DESCRIPTION_MAX).trimEnd()}…`;
}

export function entriesFromAvailableCommands(
  commands: AvailableCommand[],
): SlashCommandEntry[] {
  const byCanonical = new Map<string, AvailableCommand>();
  for (const cmd of commands) {
    byCanonical.set(cmd.name.toLowerCase(), cmd);
  }

  const entries: SlashCommandEntry[] = [];

  for (const cmd of commands) {
    entries.push({
      displayName: cmd.name,
      canonicalName: cmd.name,
      description: formatSlashCommandDescription(cmd.description),
      inputHint: inputHint(cmd),
      scope: commandScope(cmd),
      isAlias: false,
    });
  }

  for (const [alias, canonical] of Object.entries(SLASH_COMMAND_ALIASES)) {
    const cmd = byCanonical.get(canonical.toLowerCase());
    if (!cmd) continue;
    entries.push({
      displayName: alias,
      canonicalName: cmd.name,
      description: formatSlashCommandDescription(cmd.description),
      inputHint: inputHint(cmd),
      scope: "alias",
      isAlias: true,
    });
  }

  return entries.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    }),
  );
}

export function parseSlashInput(text: string): SlashInputState | null {
  if (!text.startsWith("/")) return null;
  const rest = text.slice(1);
  if (rest.includes("\n") || rest.includes(" ")) {
    return { open: false, query: "" };
  }
  return { open: true, query: rest.toLowerCase() };
}

export function formatSlashCommand(
  displayOrCanonical: string,
  args?: string,
): string {
  const canonical = resolveCanonicalSlashName(displayOrCanonical);
  const base = `/${canonical}`;
  const trimmedArgs = args?.trim();
  return trimmedArgs ? `${base} ${trimmedArgs}` : `${base} `;
}

export function slashCommandLabel(entry: SlashCommandEntry): string {
  return `/${entry.displayName}`;
}

/**
 * Fuzzy match: characters of query must appear in order in the target.
 * Higher score = better match (prefix and consecutive runs score higher).
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let run = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + run * 2 + (ti === 0 ? 4 : 0);
      run += 1;
      qi += 1;
    } else {
      run = 0;
    }
  }
  if (qi < q.length) return -1;
  if (t.startsWith(q)) score += 8;
  return score;
}

export function fuzzyFilterSlashCommands(
  entries: SlashCommandEntry[],
  query: string,
): SlashCommandEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;

  const scored = entries
    .map((entry) => {
      const nameScore = fuzzyScore(q, entry.displayName);
      const descScore = fuzzyScore(q, entry.description) * 0.6;
      const score = Math.max(nameScore, descScore);
      return { entry, score };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.entry.displayName.localeCompare(b.entry.displayName));

  return scored.map((row) => row.entry);
}

export function isLocalSlashCommand(canonicalName: string): boolean {
  return LOCAL_SLASH_COMMANDS.has(resolveCanonicalSlashName(canonicalName));
}

export function parseSlashMessage(
  text: string,
): { name: string; args: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  const space = body.search(/\s/);
  if (space === -1) {
    return { name: body, args: "" };
  }
  return {
    name: body.slice(0, space),
    args: body.slice(space + 1).trim(),
  };
}